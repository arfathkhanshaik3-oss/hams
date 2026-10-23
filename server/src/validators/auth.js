import { z } from 'zod';
import * as c from './common.js';

export const registerSchema = z.object({
  fullName: c.text(2, 80, 'Full name'),
  email: c.email,
  password: c.password,
  phone: c.phone,
  dateOfBirth: c.optionalDob,
  gender: c.optionalGender,
});

export const loginSchema = z.object({
  email: c.email,
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required').max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: c.password,
});

export const updateProfileSchema = z.object({
  fullName: c.text(2, 80, 'Full name').optional(),
  phone: c.optionalPhone,
  dateOfBirth: c.optionalDob,
  gender: c.optionalGender,
  address: c.optionalText(250, 'Address'),
  emergencyContact: c.optionalText(120, 'Emergency contact'),
  bio: c.optionalText(1000, 'Bio'),
  qualification: c.optionalText(160, 'Qualification'),
});
