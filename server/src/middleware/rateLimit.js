import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const make = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.rateLimitDisabled,
    message: { error: { code: 'RATE_LIMITED', message } },
  });

// Brute-force protection for login / register / password change
export const authLimiter = make(15 * 60 * 1000, 20, 'Too many attempts. Please wait 15 minutes and try again.');
// Generic safety net for the whole API
export const apiLimiter = make(60 * 1000, 600, 'Too many requests. Please slow down.');
