import crypto from 'node:crypto';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { hashPassword } from '../src/services/authService.js';
import { addDays, addMinutes, dbDate, toClinicParts, todayStr, zonedToUtc } from '../src/utils/time.js';

// SAFETY: these tests wipe every table. Never let them run against the real database.
const dbName = new URL(process.env.DATABASE_URL).pathname.replace('/', '');
if (!/test/i.test(dbName)) {
  throw new Error(`Refusing to run tests: database "${dbName}" does not look like a test database. Use a database whose name contains "test" (see .env.test.example).`);
}

export { app, prisma };
export const TZ = 'Asia/Kolkata';
export const PASSWORD = 'Passw0rd1';

export const today = () => todayStr(TZ);
export const dayPlus = (n) => addDays(today(), n);
export const at = (dateStr, hhmm) => zonedToUtc(dateStr, hhmm, TZ);
export const slotIso = (dateStr, hhmm) => at(dateStr, hhmm).toISOString();

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "AuditLog","Notification","QueueEntry","Appointment","DoctorLeave","DoctorSchedule","DoctorProfile","PatientProfile","User","Specialization","ClinicSettings" CASCADE',
  );
}

export async function setSettings(data) {
  return prisma.clinicSettings.update({ where: { id: 1 }, data });
}

export async function makeUser({ role, email, fullName, phone = '+91 90000 00000', isActive = true }) {
  const passwordHash = await hashPassword(PASSWORD);
  const user = await prisma.user.create({
    data: { email, passwordHash, role, fullName, phone, isActive, ...(role === 'PATIENT' ? { patientProfile: { create: {} } } : {}) },
    include: { patientProfile: true },
  });
  return { ...user, profileId: user.patientProfile?.id };
}

export async function makeDoctor({ email, fullName, specializationId, fee = 500, mins = 15 }) {
  const passwordHash = await hashPassword(PASSWORD);
  const user = await prisma.user.create({
    data: {
      email, passwordHash, role: 'DOCTOR', fullName, phone: '+91 90000 11111',
      doctorProfile: { create: { specializationId, consultationFee: fee, consultationMinutes: mins, room: '101' } },
    },
    include: { doctorProfile: true },
  });
  // Works every day, around the clock, so tests give the same result at any time of day
  await prisma.doctorSchedule.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ doctorId: user.doctorProfile.id, weekday, startTime: '00:00', endTime: '23:59', slotMinutes: 15 })),
  });
  return { ...user, profileId: user.doctorProfile.id };
}

/** Empty database + clinic open 24/7 + 1 admin, 1 receptionist, 2 doctors, 2 patients */
export async function createWorld() {
  await resetDb();
  await prisma.clinicSettings.create({ data: { id: 1, opensAt: '00:00', closesAt: '23:59', timeZone: TZ, closedWeekdays: [], cancellationCutoffHours: 2 } });
  const spec = await prisma.specialization.create({ data: { name: 'General Medicine' } });
  const spec2 = await prisma.specialization.create({ data: { name: 'Cardiology' } });
  const admin = await makeUser({ role: 'ADMIN', email: 'admin@test.dev', fullName: 'Test Admin' });
  const reception = await makeUser({ role: 'RECEPTIONIST', email: 'reception@test.dev', fullName: 'Test Receptionist' });
  const docA = await makeDoctor({ email: 'doca@test.dev', fullName: 'Dr. Alpha', specializationId: spec.id });
  const docB = await makeDoctor({ email: 'docb@test.dev', fullName: 'Dr. Bravo', specializationId: spec2.id, fee: 900 });
  const patA = await makeUser({ role: 'PATIENT', email: 'pata@test.dev', fullName: 'Pat Alpha' });
  const patB = await makeUser({ role: 'PATIENT', email: 'patb@test.dev', fullName: 'Pat Bravo' });
  return { spec, spec2, admin, reception, docA, docB, patA, patB };
}

export async function extraPatients(n, prefix = 'extra') {
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(await makeUser({ role: 'PATIENT', email: `${prefix}${i}@test.dev`, fullName: `${prefix} Patient ${i}`, phone: `+91 90000 5${String(i).padStart(4, '0')}` }));
  return out;
}

/** A supertest agent that is logged in (keeps the cookie, like a browser) */
export async function login(email, password = PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}
export const anonymous = () => request(app);

/**
 * Inserts an appointment (and its queue entry) for TODAY directly in the database.
 * Slots are early in the day (00:15, 00:30 ...), so the helper behaves the same at any time of day.
 */
export async function insertTodayAppointment({ doctor, patient, index, status = 'BOOKED', type = 'ONLINE' }) {
  const startsAt = addMinutes(at(today(), '00:00'), (index + 1) * 15);
  return insertAppointment({ doctor, patient, startsAt, status, type });
}

export async function insertAppointment({ doctor, patient, startsAt, status = 'BOOKED', type = 'ONLINE' }) {
  const date = toClinicParts(startsAt, TZ).date;
  const appointmentDate = dbDate(date);
  const agg = await prisma.queueEntry.aggregate({ where: { doctorId: doctor.profileId, queueDate: appointmentDate }, _max: { queueNumber: true } });
  return prisma.appointment.create({
    data: {
      reference: `APT-${date.replaceAll('-', '')}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      doctorId: doctor.profileId, patientId: patient.profileId, startsAt, endsAt: addMinutes(startsAt, 15), appointmentDate, status, type,
      queueEntry: { create: { doctorId: doctor.profileId, queueDate: appointmentDate, queueNumber: (agg._max.queueNumber ?? 0) + 1, sortKey: startsAt } },
    },
    include: { queueEntry: true },
  });
}

export const bookBody = (doctor, date, time, extra = {}) => ({ doctorId: doctor.profileId, startsAt: slotIso(date, time), ...extra });
