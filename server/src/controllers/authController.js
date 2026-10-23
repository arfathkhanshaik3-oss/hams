import { asyncHandler } from '../utils/asyncHandler.js';
import { cookieOptions, signToken, TOKEN_COOKIE } from '../middleware/auth.js';
import * as auth from '../services/authService.js';
import * as profiles from '../services/profileService.js';
import { audit } from '../services/auditService.js';

export const register = asyncHandler(async (req, res) => {
  // Role is never read from the request: public registration always creates a PATIENT
  const user = await auth.registerPatient(req.body);
  res.cookie(TOKEN_COOKIE, signToken(user), cookieOptions());
  res.status(201).json({ user: auth.publicUser(user) });
});

export const login = asyncHandler(async (req, res) => {
  const user = await auth.verifyLogin(req.body.email, req.body.password);
  res.cookie(TOKEN_COOKIE, signToken(user), cookieOptions());
  if (user.role === 'ADMIN') await audit({ user, ip: req.ip }, { action: 'ADMIN_LOGIN', entityType: 'User', entityId: user.id });
  res.json({ user: auth.publicUser(user) });
});

export const logout = (_req, res) => {
  res.clearCookie(TOKEN_COOKIE, { ...cookieOptions(), maxAge: undefined });
  res.json({ message: 'Logged out' });
};

export const me = asyncHandler(async (req, res) => {
  res.json({ user: await profiles.getProfile(req.user.id) });
});

export const getProfile = me;

export const updateProfile = asyncHandler(async (req, res) => {
  res.json({ user: await profiles.updateProfile(req.user, req.body) });
});

export const changePassword = asyncHandler(async (req, res) => {
  await auth.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
  res.json({ message: 'Password changed' });
});
