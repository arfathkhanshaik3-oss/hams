import { prisma } from '../config/prisma.js';

// Writes an audit record. It must never break the main request, and it must
// never contain patient medical details - only who did what to which record.
export async function audit(req, { action, entityType, entityId, details }) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: req?.user?.id ?? null,
        action,
        entityType,
        entityId: entityId ?? null,
        details: details ?? undefined,
        ipAddress: req?.ip ?? null,
      },
    });
  } catch (err) {
    console.error('[audit] failed to write audit log:', err?.message);
  }
}
