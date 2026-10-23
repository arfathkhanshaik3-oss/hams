import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { emitToUser } from '../sockets/io.js';
import { pageMeta, parsePagination } from '../utils/pagination.js';

export async function notify(userId, { title, message, type = 'INFO', appointmentId = null }) {
  if (!userId) return null;
  try {
    const n = await prisma.notification.create({ data: { userId, title, message, type, appointmentId } });
    emitToUser(userId, 'notification:new', { id: n.id, title: n.title, message: n.message, type: n.type, createdAt: n.createdAt });
    return n;
  } catch (err) {
    console.error('[notify] failed:', err?.message);
    return null;
  }
}

export async function listNotifications(userId, query) {
  const { page, limit, skip, take } = parsePagination(query, { defaultLimit: 20 });
  const where = { userId, ...(query.unread === 'true' ? { readAt: null } : {}) };
  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { items, unread, meta: pageMeta(total, page, limit) };
}

export async function markRead(userId, id) {
  const result = await prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
  if (result.count === 0) {
    const exists = await prisma.notification.findFirst({ where: { id, userId } });
    if (!exists) throw new AppError(404, 'NOT_FOUND', 'Notification not found.');
  }
}

export const markAllRead = (userId) =>
  prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
