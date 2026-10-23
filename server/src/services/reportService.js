import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { addDays, dateKey, dbDate, minutesBetween, todayStr } from '../utils/time.js';
import { average, dailyStatusCounts, waitMinutes } from './dashboardService.js';
import { getSettings } from './settingsService.js';

async function range(query) {
  const settings = await getSettings();
  const today = todayStr(settings.timeZone);
  const to = query.to ?? today;
  const from = query.from ?? addDays(to, -29);
  if (from > to) throw new AppError(400, 'VALIDATION_ERROR', 'The start date must be before the end date.', { from: 'Must be on or before the end date' });
  if (new Date(to) - new Date(from) > 366 * 86400000) throw new AppError(400, 'VALIDATION_ERROR', 'Choose a range of at most one year.', { to: 'Range too long' });
  return { from, to };
}

export async function trends(query) {
  const { from, to } = await range(query);
  const days = await dailyStatusCounts({}, from, to);
  const totals = days.reduce((t, d) => ({ total: t.total + d.total, completed: t.completed + d.completed, cancelled: t.cancelled + d.cancelled, noShow: t.noShow + d.noShow }), { total: 0, completed: 0, cancelled: 0, noShow: 0 });
  return { from, to, days, totals };
}

export async function workload(query) {
  const { from, to } = await range(query);
  const where = { appointmentDate: { gte: dbDate(from), lte: dbDate(to) } };
  const [groups, doctors, entries] = await Promise.all([
    prisma.appointment.groupBy({ by: ['doctorId', 'status'], where, _count: { _all: true } }),
    prisma.doctorProfile.findMany({ include: { user: { select: { fullName: true } }, specialization: true } }),
    prisma.queueEntry.findMany({ where: { queueDate: where.appointmentDate, startedAt: { not: null }, completedAt: { not: null } }, select: { doctorId: true, startedAt: true, completedAt: true } }),
  ]);
  const rows = doctors
    .map((d) => {
      const mine = groups.filter((g) => g.doctorId === d.id);
      const n = (s) => mine.find((g) => g.status === s)?._count._all ?? 0;
      const total = mine.reduce((a, g) => a + g._count._all, 0);
      const durations = entries.filter((e) => e.doctorId === d.id).map((e) => minutesBetween(e.startedAt, e.completedAt));
      return { doctorId: d.id, fullName: d.user.fullName, specialization: d.specialization.name, total, completed: n('COMPLETED'), cancelled: n('CANCELLED'), noShow: n('NO_SHOW'), avgConsultationMinutes: average(durations) };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
  return { from, to, doctors: rows };
}

export async function waitingTimes(query) {
  const { from, to } = await range(query);
  const entries = await prisma.queueEntry.findMany({
    where: { queueDate: { gte: dbDate(from), lte: dbDate(to) }, checkedInAt: { not: null }, calledAt: { not: null } },
    select: { doctorId: true, queueDate: true, checkedInAt: true, calledAt: true },
  });
  const valid = entries.map((e) => ({ ...e, wait: waitMinutes(e) })).filter((e) => e.wait !== null && e.wait >= 0);
  const doctors = await prisma.doctorProfile.findMany({ include: { user: { select: { fullName: true } } } });
  const perDoctor = doctors
    .map((d) => ({ doctorId: d.id, fullName: d.user.fullName, avgWaitMinutes: average(valid.filter((e) => e.doctorId === d.id).map((e) => e.wait)), samples: valid.filter((e) => e.doctorId === d.id).length }))
    .filter((r) => r.samples > 0)
    .sort((a, b) => b.avgWaitMinutes - a.avgWaitMinutes);
  const perDay = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const w = valid.filter((e) => dateKey(e.queueDate) === d).map((e) => e.wait);
    perDay.push({ date: d, avgWaitMinutes: average(w), samples: w.length });
  }
  return { from, to, overallAvgWaitMinutes: average(valid.map((e) => e.wait)), samples: valid.length, perDoctor, perDay };
}

export async function cancellations(query) {
  const { from, to } = await range(query);
  const rows = await prisma.appointment.findMany({
    where: { status: 'CANCELLED', appointmentDate: { gte: dbDate(from), lte: dbDate(to) } },
    include: { doctor: { include: { user: { select: { fullName: true } } } }, patient: { include: { user: { select: { fullName: true } } } } },
    orderBy: { updatedAt: 'desc' },
  });
  const ids = [...new Set(rows.map((r) => r.cancelledById).filter(Boolean))];
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, role: true } });
  const roleOf = new Map(users.map((u) => [u.id, u.role]));
  const byRole = {};
  const byDayMap = new Map();
  for (const r of rows) {
    const role = roleOf.get(r.cancelledById) ?? 'SYSTEM';
    byRole[role] = (byRole[role] ?? 0) + 1;
    const d = dateKey(r.appointmentDate);
    byDayMap.set(d, (byDayMap.get(d) ?? 0) + 1);
  }
  const completed = await prisma.appointment.count({ where: { status: 'COMPLETED', appointmentDate: { gte: dbDate(from), lte: dbDate(to) } } });
  return {
    from,
    to,
    totalCancelled: rows.length,
    totalCompleted: completed,
    byRole: Object.entries(byRole).map(([role, count]) => ({ role, count })),
    byDay: emptyFill(from, to, byDayMap),
    recent: rows.slice(0, 20).map((r) => ({ reference: r.reference, date: dateKey(r.appointmentDate), doctor: r.doctor.user.fullName, patient: r.patient.user.fullName, cancelledByRole: roleOf.get(r.cancelledById) ?? 'SYSTEM', reason: r.cancelReason })),
  };
}

function emptyFill(from, to, map) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push({ date: d, count: map.get(d) ?? 0 });
  return out;
}
