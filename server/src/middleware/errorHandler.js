import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export const notFoundHandler = (req, _res, next) =>
  next(new AppError(404, 'NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`));

// Central place where every error becomes { error: { code, message, details } }.
// Stack traces and internal details are never sent to the client in production.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong on our side. Please try again.';
  let details;

  if (err instanceof AppError) {
    ({ status, code, message, details } = err);
  } else if (err instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Please check the highlighted fields.';
    details = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_';
      if (!details[key]) details[key] = issue.message;
    }
  } else if (err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError') {
    status = 401;
    code = 'UNAUTHENTICATED';
    message = err.name === 'TokenExpiredError' ? 'Your session has expired. Please log in again.' : 'Invalid session. Please log in again.';
  } else if (err?.code === 'P2002') {
    status = 409;
    code = 'CONFLICT';
    message = 'That record already exists or the time was just taken.';
  } else if (err?.code === 'P2025') {
    status = 404;
    code = 'NOT_FOUND';
    message = 'Record not found.';
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    code = 'BAD_JSON';
    message = 'Request body is not valid JSON.';
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large.';
  }

  if (status >= 500) {
    // Log the error type/message only - never request bodies (may contain patient data)
    console.error(`[error] ${req.method} ${req.path}:`, err?.code || err?.name, err?.message);
    if (!env.isProd && !env.isTest) console.error(err?.stack);
  }
  res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
};
