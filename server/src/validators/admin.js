import { z } from 'zod';
import * as c from './common.js';

export const listUsersQuery = z.object({
  ...c.pagination,
  role: z.enum(['PATIENT', 'DOCTOR', 'RECEPTIONIST', 'ADMIN']).optional(),
  isActive: c.optionalBool,
  search: c.optionalText(80, 'Search'),
  sort: z.enum(['createdAt', 'fullName', 'email']).default('createdAt'),
  order: c.sortOrder.default('desc'),
});

export const createUserSchema = z.object({
  fullName: c.text(2, 80, 'Full name'),
  email: c.email,
  password: c.password,
  phone: c.optionalPhone,
  role: z.enum(['PATIENT', 'RECEPTIONIST', 'ADMIN'], { errorMap: () => ({ message: 'Choose a role (doctors are created in Doctor Management)' }) }),
});

export const updateUserSchema = z
  .object({ fullName: c.text(2, 80, 'Full name'), email: c.email, phone: c.optionalPhone })
  .partial()
  .refine((o) => Object.keys(o).length > 0, 'Nothing to update');

export const resetPasswordSchema = z.object({ password: c.password });

export const auditQuery = z.object({
  ...c.pagination,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  action: c.optionalText(60, 'Action'),
  entityType: c.optionalText(40, 'Entity'),
  actorId: z.preprocess((v) => (v === '' ? undefined : v), c.uuid.optional()),
  from: c.optionalDateStr,
  to: c.optionalDateStr,
});

export const specializationSchema = z.object({ name: c.text(2, 60, 'Name'), description: c.optionalText(300, 'Description') });
export const specializationUpdateSchema = specializationSchema.partial().refine((o) => Object.keys(o).length > 0, 'Nothing to update');

export const settingsSchema = z.object({
  clinicName: c.text(2, 80, 'Clinic name'),
  opensAt: c.timeStr,
  closesAt: c.timeStr,
  timeZone: c.text(3, 60, 'Time zone'),
  closedWeekdays: z.array(z.coerce.number().int().min(0).max(6)).max(7),
  cancellationCutoffHours: z.coerce.number().int().min(0).max(72),
  lateGraceMinutes: z.coerce.number().int().min(0).max(120),
  noShowAfterMinutes: z.coerce.number().int().min(5).max(480),
  maxAdvanceBookingDays: z.coerce.number().int().min(1).max(365),
  maxDailyWalkIns: z.coerce.number().int().min(0).max(200),
  maxReschedules: z.coerce.number().int().min(0).max(10),
});

export const reportQuery = z.object({ from: c.optionalDateStr, to: c.optionalDateStr });
export const notificationQuery = z.object({ ...c.pagination, limit: z.coerce.number().int().min(1).max(50).default(20), unread: z.enum(['true', 'false']).optional() });
