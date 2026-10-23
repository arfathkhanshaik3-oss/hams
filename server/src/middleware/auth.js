import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const TOKEN_COOKIE = 'hams_token';

function readToken(req) {
  if (req.cookies?.[TOKEN_COOKIE]) return req.cookies[TOKEN_COOKIE];
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

// The role and active flag are always re-read from the database,
// never trusted from the token alone, so deactivation takes effect at once.
async function loadUser(token) {
  const payload = jwt.verify(token, env.jwtSecret);
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, role: true, fullName: true, isActive: true },
  });
  if (!user || !user.isActive) throw new AppError(401, 'UNAUTHENTICATED', 'Your session is no longer valid. Please log in again.');
  return user;
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = readToken(req);
  if (!token) throw new AppError(401, 'UNAUTHENTICATED', 'Please log in to continue.');
  req.user = await loadUser(token); // JWT errors are mapped by the error handler
  next();
});

export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = readToken(req);
  if (token) {
    try {
      req.user = await loadUser(token);
    } catch {
      req.user = undefined;
    }
  }
  next();
});

export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHENTICATED', 'Please log in to continue.'));
  if (!roles.includes(req.user.role)) {
    return next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action.'));
  }
  return next();
};

export const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

export const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: env.cookieSecure,
  maxAge: 8 * 60 * 60 * 1000,
  path: '/',
});
