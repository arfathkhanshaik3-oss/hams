import { z } from 'zod';
import * as c from './common.js';

export const doctorParam = z.object({ doctorId: z.union([c.uuid, z.literal('me')]) });
export const entryParam = z.object({ entryId: c.uuid });
export const appointmentParam = z.object({ appointmentId: c.uuid });
export const dateQuery = z.object({ date: c.optionalDateStr });

export const walkInSchema = z.object({
  patientId: c.uuid,
  doctorId: c.uuid,
  reasonForVisit: c.optionalText(300, 'Reason for visit'),
});

export const reasonSchema = z.object({ reason: c.text(3, 300, 'Reason') });
export const reorderSchema = z.object({
  position: z.coerce.number().int().min(1, 'Position starts at 1').max(200),
  reason: c.text(3, 300, 'Reason'),
});

export const patientSearchQuery = z.object({ ...c.pagination, search: c.optionalText(80, 'Search') });
export const createPatientSchema = z.object({
  fullName: c.text(2, 80, 'Full name'),
  phone: c.phone,
  email: z.preprocess((v) => (v === '' || v === null ? undefined : v), c.email.optional()),
  dateOfBirth: c.optionalDob,
  gender: c.optionalGender,
  address: c.optionalText(250, 'Address'),
  emergencyContact: c.optionalText(120, 'Emergency contact'),
});
