import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { pageMeta, parsePagination } from '../utils/pagination.js';
import { isValidTimeZone } from '../utils/time.js';
import { hashPassword, publicUser } from './authService.js';
import { getSettings } from './settingsService.js';

export async function listUsers(query) {
  const { page, limit, skip, take } = parsePagination(query, { defaultLimit: 10 });
  const where = {
    ...(query.role ? { role: query.role } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.search
      ? { OR: [{ fullName: { contains: query.search, mode: 'insensitive' } }, { email: { contains: query.search, mode: 'insensitive' } }, { phone: { contains: query.search } }] }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { [query.sort ?? 'createdAt']: query.order ?? 'desc' }, skip, take }),
    prisma.user.count({ where }),
  ]);
  return { items: rows.map((u) => ({ ...publicUser(u), createdAt: u.createdAt })), meta: pageMeta(total, page, limit) };
}

export async function createUser(data) {
  if (await prisma.user.findUnique({ where: { email: data.email } })) {
    throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists.', { email: 'Email already registered' });
  }
  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash: await hashPassword(data.password),
      role: data.role,
      fullName: data.fullName,
      phone: data.phone,
      ...(data.role === 'PATIENT' ? { patientProfile: { create: {} } } : {}),
    },
  });
  return { ...publicUser(user), createdAt: user.createdAt };
}

export async function updateUser(id, data) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');
  if (data.email && data.email !== user.email && (await prisma.user.findUnique({ where: { email: data.email } }))) {
    throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists.', { email: 'Email already registered' });
  }
  const updated = await prisma.user.update({ where: { id }, data });
  return { ...publicUser(updated), createdAt: updated.createdAt };
}

export async function setUserActive(actor, id, isActive) {
  if (actor.id === id && !isActive) throw new AppError(409, 'SELF_DEACTIVATION', 'You cannot deactivate your own account.');
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');
  if (!isActive && user.role === 'ADMIN') {
    const others = await prisma.user.count({ where: { role: 'ADMIN', isActive: true, NOT: { id } } });
    if (others === 0) throw new AppError(409, 'LAST_ADMIN', 'At least one active administrator is required.');
  }
  const updated = await prisma.user.update({ where: { id }, data: { isActive } });
  return { ...publicUser(updated), createdAt: updated.createdAt };
}

export async function resetPassword(id, password) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');
  await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
  return { id };
}

export async function listAuditLogs(query) {
  const { page, limit, skip, take } = parsePagination(query, { defaultLimit: 20 });
  const where = {
    ...(query.action ? { action: { contains: query.action, mode: 'insensitive' } } : {}),
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.actorId ? { actorId: query.actorId } : {}),
    ...(query.from || query.to
      ? { createdAt: { ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}), ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}) } }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ where, include: { actor: { select: { fullName: true, role: true } } }, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.auditLog.count({ where }),
  ]);
  return {
    items: rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      details: r.details,
      ipAddress: r.ipAddress,
      createdAt: r.createdAt,
      actor: r.actor ? { fullName: r.actor.fullName, role: r.actor.role } : null,
    })),
    meta: pageMeta(total, page, limit),
  };
}

export async function readSettings() {
  return getSettings();
}

export async function saveSettings(data) {
  if (data.opensAt >= data.closesAt) throw new AppError(400, 'VALIDATION_ERROR', 'Closing time must be after opening time.', { closesAt: 'Must be after opening time' });
  if (!isValidTimeZone(data.timeZone)) throw new AppError(400, 'VALIDATION_ERROR', 'Unknown time zone.', { timeZone: 'Use an IANA name like Asia/Kolkata' });
  await getSettings();
  return prisma.clinicSettings.update({ where: { id: 1 }, data: { ...data, closedWeekdays: [...new Set(data.closedWeekdays)].sort() } });
}
