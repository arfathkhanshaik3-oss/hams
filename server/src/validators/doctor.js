import { z } from 'zod';
import * as c from './common.js';

export const listDoctorsQuery = z.object({
  ...c.pagination,
  limit: z.coerce.number().int().min(1).max(50).default(9),
  search: c.optionalText(80, 'Search'),
  specializationId: z.preprocess((v) => (v === '' ? undefined : v), c.uuid.optional()),
  availableOn: c.optionalDateStr,
  status: z.enum(['active', 'inactive']).optional(),
});

export const slotsQuery = z.object({ date: c.dateStr });

const sessionSchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  startTime: c.timeStr,
  endTime: c.timeStr,
  slotMinutes: z.coerce.number().int().min(5, 'Minimum 5 minutes').max(120, 'Maximum 120 minutes'),
});
export const scheduleSchema = z.object({ sessions: z.array(sessionSchema).max(28, 'Too many sessions') });

export const leaveSchema = z.object({
  startDate: c.dateStr,
  endDate: c.dateStr,
  reason: c.optionalText(160, 'Reason'),
  cancelAppointments: z.boolean().optional().default(false),
});
export const leaveParams = z.object({ id: c.uuid, leaveId: c.uuid });

const doctorFields = {
  fullName: c.text(2, 80, 'Full name'),
  phone: c.optionalPhone,
  specializationId: c.uuid,
  consultationFee: z.coerce.number().min(0, 'Fee cannot be negative').max(100000),
  consultationMinutes: z.coerce.number().int().min(5).max(120),
  experienceYears: z.coerce.number().int().min(0).max(70),
  qualification: c.optionalText(160, 'Qualification'),
  bio: c.optionalText(1000, 'Bio'),
  room: c.optionalText(30, 'Room'),
};

export const createDoctorSchema = z.object({
  ...doctorFields,
  email: c.email,
  password: c.password,
  consultationMinutes: doctorFields.consultationMinutes.default(15),
  experienceYears: doctorFields.experienceYears.default(0),
});

export const updateDoctorSchema = z
  .object({ ...doctorFields, email: c.email })
  .partial()
  .refine((o) => Object.keys(o).length > 0, 'Nothing to update');

export const statusSchema = z.object({ isActive: z.boolean({ required_error: 'isActive is required' }) });
