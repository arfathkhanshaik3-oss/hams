import { AppError } from './AppError.js';

// Serializable transactions can fail when two requests race (Prisma code P2034),
// and unique indexes can reject the loser (P2002). Both are safe to retry:
// on the next attempt the loser sees the winner's data and fails cleanly.
const RETRYABLE = new Set(['P2034', 'P2002']);

export async function withRetry(fn, attempts = 10) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn(i);
    } catch (err) {
      if (!RETRYABLE.has(err?.code)) throw err;
      lastError = err;
      await new Promise((r) => setTimeout(r, 15 + Math.random() * 60 * (i + 1)));
    }
  }
  if (lastError?.code === 'P2002') {
    throw new AppError(409, 'CONFLICT', 'That time was just taken. Please choose another one.');
  }
  throw new AppError(409, 'CONFLICT', 'The system is busy. Please try again.');
}

export const SERIALIZABLE = { isolationLevel: 'Serializable', maxWait: 10000, timeout: 15000 };
