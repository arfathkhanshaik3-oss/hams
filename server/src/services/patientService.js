import crypto from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { pageMeta, parsePagination } from '../utils/pagination.js';
import { ageFromDob, dateKey } from '../utils/time.js';
import { audit } from './auditService.js';
import { hashPassword } from './authService.js';

const toPatientDTO = (p) => ({
  id: p.id,
  fullName: p.user.fullName,
  phone: p.user.phone,
  email: p.user.email.endsWith('@walkin.local') ? null : p.user.email,
  gender: p.gender,
  dateOfBirth: p.dateOfBirth ? dateKey(p.dateOfBirth) : null,
  age: ageFromDob(p.dateOfBirth),
  address: p.address,
  emergencyContact: p.emergencyContact,
  createdByStaff: p.createdByStaff,
  isActive: p.user.isActive,
});

const include = { user: { select: { fullName: true, phone: true, email: true, isActive: true } } };

export async function searchPatients(query) {
  const { page, limit, skip, take } = parsePagination(query, { defaultLimit: 10 });
  const s = query.search;
  const where = {
    user: { isActive: true },
    ...(s
      ? {
          OR: [
            { user: { fullName: { contains: s, mode: 'insensitive' } } },
            { user: { phone: { contains: s } } },
            { user: { email: { contains: s, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.patientProfile.findMany({ where, include, orderBy: { user: { fullName: 'asc' } }, skip, take }),
    prisma.patientProfile.count({ where }),
  ]);
  return { items: rows.map(toPatientDTO), meta: pageMeta(total, page, limit) };
}

export async function getPatient(id) {
  const p = await prisma.patientProfile.findUnique({ where: { id }, include });
  if (!p) throw new AppError(404, 'NOT_FOUND', 'Patient not found.');
  return toPatientDTO(p);
}

// Walk-in patients get an account that nobody can log in to until an admin sets a password.
export async function createWalkInPatient(data, req) {
  const dup = await prisma.patientProfile.findFirst({
    where: { user: { phone: data.phone, fullName: { equals: data.fullName, mode: 'insensitive' } } },
    include,
  });
  if (dup) {
    throw new AppError(409, 'DUPLICATE_PATIENT', 'A patient with this name and phone number already exists. Select them from the search instead.', { existingPatientId: dup.id });
  }
  if (data.email && (await prisma.user.findUnique({ where: { email: data.email } }))) {
    throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists. Search for the patient instead.', { email: 'Email already registered' });
  }
  const email = data.email ?? `walkin-${crypto.randomUUID()}@walkin.local`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(crypto.randomBytes(24).toString('hex')),
      role: 'PATIENT',
      fullName: data.fullName,
      phone: data.phone,
      patientProfile: {
        create: {
          dateOfBirth: data.dateOfBirth ? new Date(`${data.dateOfBirth}T00:00:00.000Z`) : null,
          gender: data.gender ?? null,
          address: data.address ?? null,
          emergencyContact: data.emergencyContact ?? null,
          createdByStaff: true,
        },
      },
    },
    include: { patientProfile: { include } },
  });
  await audit(req, { action: 'PATIENT_REGISTERED_BY_STAFF', entityType: 'PatientProfile', entityId: user.patientProfile.id });
  return toPatientDTO(user.patientProfile);
}
