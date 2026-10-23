import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

// Compared against when the email does not exist, so response time does not reveal
// which emails are registered.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export const hashPassword = (plain) => bcrypt.hash(plain, env.bcryptRounds);

export const publicUser = (u) => ({
  id: u.id,
  email: u.email.endsWith('@walkin.local') ? null : u.email,
  fullName: u.fullName,
  role: u.role,
  phone: u.phone,
  isActive: u.isActive,
});

export async function registerPatient(data) {
  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists.', { email: 'Email already registered' });
  const passwordHash = await hashPassword(data.password);
  try {
    return await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        role: 'PATIENT',
        fullName: data.fullName,
        phone: data.phone,
        patientProfile: {
          create: {
            dateOfBirth: data.dateOfBirth ? new Date(`${data.dateOfBirth}T00:00:00.000Z`) : null,
            gender: data.gender ?? null,
          },
        },
      },
    });
  } catch (err) {
    if (err?.code === 'P2002') throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists.', { email: 'Email already registered' });
    throw err;
  }
}

export async function verifyLogin(email, password) {
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
  if (!user.isActive) throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been deactivated. Please contact the clinic.');
  return user;
}

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const ok = user && (await bcrypt.compare(currentPassword, user.passwordHash));
  if (!ok) throw new AppError(400, 'INVALID_CREDENTIALS', 'Current password is incorrect.', { currentPassword: 'Incorrect password' });
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
}
