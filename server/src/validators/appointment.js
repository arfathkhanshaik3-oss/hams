import { z } from 'zod';
import * as c from './common.js';

export const bookSchema = z.object({
  doctorId: c.uuid,
  patientId: c.uuid.optional(), // only used by receptionists; ignored for patients
  startsAt: c.isoDateTime,
  reasonForVisit: c.optionalText(300, 'Reason for visit'),
});

export const listAppointmentsQuery = z.object({
  ...c.pagination,
  status: z
    .string()
    .optional()
    .refine(
      (v) => !v || v.split(',').every((s) => ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'WAITING', 'CALLED', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(s)),
      'Unknown status',
    ),
  type: z.enum(['ONLINE', 'WALK_IN', 'STAFF_BOOKED']).optional(),
  doctorId: z.preprocess((v) => (v === '' ? undefined : v), c.uuid.optional()),
  date: c.optionalDateStr,
  from: c.optionalDateStr,
  to: c.optionalDateStr,
  scope: z.enum(['upcoming', 'past']).optional(),
  search: c.optionalText(80, 'Search'),
  sort: z.enum(['startsAt', 'createdAt']).default('startsAt'),
  order: c.sortOrder.default('desc'),
});

export const cancelSchema = z.object({ reason: c.optionalText(300, 'Reason') });
export const rescheduleSchema = z.object({ startsAt: c.isoDateTime });
export const statusChangeSchema = z.object({
  status: z.enum(['CONFIRMED', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED']),
  reason: c.optionalText(300, 'Reason'),
});
