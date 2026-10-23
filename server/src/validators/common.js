import { z } from 'zod';
import { cleanText } from '../utils/sanitize.js';
import { isValidDateStr } from '../utils/time.js';

export const text = (min, max, label = 'This field') =>
  z.preprocess(
    cleanText,
    z.string({ required_error: `${label} is required`, invalid_type_error: `${label} must be text` })
      .min(min, min === 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
      .max(max, `${label} must be at most ${max} characters`),
  );

export const optionalText = (max, label) =>
  z.preprocess(
    (v) => (v === '' || v === null ? undefined : cleanText(v)),
    z.string().max(max, `${label} must be at most ${max} characters`).optional(),
  );

export const uuid = z.string().uuid('Invalid id');
export const idParam = z.object({ id: uuid });
export const dateStr = z
  .string({ required_error: 'Date is required' })
  .refine(isValidDateStr, 'Use the format YYYY-MM-DD');
export const optionalDateStr = z.preprocess((v) => (v === '' ? undefined : v), dateStr.optional());
export const timeStr = z
  .string({ required_error: 'Time is required' })
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use the format HH:mm');
export const isoDateTime = z
  .string({ required_error: 'Date and time is required' })
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date and time');

export const email = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
  z.string({ required_error: 'Email is required' }).email('Enter a valid email address').max(120),
);

// bcrypt only uses the first 72 bytes, so we cap at 72
export const password = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

export const phone = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim() : v),
  z.string().regex(/^\+?[0-9 ()-]{7,18}$/, 'Enter a valid phone number'),
);
export const optionalPhone = z.preprocess(
  (v) => (v === '' || v === null ? undefined : typeof v === 'string' ? v.trim() : v),
  z.string().regex(/^\+?[0-9 ()-]{7,18}$/, 'Enter a valid phone number').optional(),
);

export const gender = z.enum(['MALE', 'FEMALE', 'OTHER']);
export const optionalGender = z.preprocess((v) => (v === '' || v === null ? undefined : v), gender.optional());
export const optionalDob = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  dateStr.refine((d) => d <= new Date().toISOString().slice(0, 10), 'Date of birth cannot be in the future').optional(),
);

export const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
};
export const sortOrder = z.enum(['asc', 'desc']).default('asc');
export const optionalBool = z.preprocess(
  (v) => (v === 'true' || v === true ? true : v === 'false' || v === false ? false : undefined),
  z.boolean().optional(),
);
