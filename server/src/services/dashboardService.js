import { prisma } from '../config/prisma.js';
import { addDays, dbDate, dateKey, minutesBetween, todayStr } from '../utils/time.js';
import { appointmentInclude, OPEN_STATUSES, toAppointmentDTO } from './appointmentService.js';
import { buildQueueState, getOverview } from './queueService.js';
import { getSettings } from './settingsService.js';

const emptyDays = (from, to) => {
  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
};

// groupBy rows -> one object per day with counts per status
export async function dailyStatusCounts(where, from, to) {
  const rows = await prisma.appointment.groupBy({
    by: ['appointmentDate', 'status'],
    where: { ...where, appointmentDate: { gte: dbDate(from), lte: dbDate(to) } },
    _count: { _all: true },
  });
  const map = new Map(emptyDays(from, to).map((d) => [d, { date: d, total: 0, completed: 0, cancelled: 0, noShow: 0 }]));
  for (const r of rows) {
    const day = map.get(dateKey(r.appointmentDate));
    if (!day) continue;
    const n = r._count._all;
    day.total += n;
    if (r.status === 'COMPLETED') day.completed += n;
    if (r.status === 'CANCELLED') day.cancelled += n;
    if (r.status === 'NO_SHOW') day.noShow += n;
  }
  return [...map.values()];
}

export const waitMinutes = (e) => (e.checkedInAt && e.calledAt ? minutesBetween(e.checkedInAt, e.calledAt) : null);
export const average = (arr) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null);

export async function patientDashboard(user) {
  const settings = await getSettings();
  const today = todayStr(settings.timeZone);
  const profile = await prisma.patientProfile.findUnique({ where: { userId: user.id } });
  const base = { patientId: profile.id };
  const [upcoming, upcomingCount, completed, cancelled, unread] = await Promise.all([
    prisma.appointment.findMany({ where: { ...base, status: { in: OPEN_STATUSES }, endsAt: { gte: new Date() } }, include: appointmentInclude, orderBy: { startsAt: 'asc' }, take: 3 }),
    prisma.appointment.count({ where: { ...base, status: { in: OPEN_STATUSES }, endsAt: { gte: new Date() } } }),
    prisma.appointment.count({ where: { ...base, status: 'COMPLETED' } }),
    prisma.appointment.count({ where: { ...base, status: 'CANCELLED' } }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  const items = upcoming.map((a) => toAppointmentDTO(a, 'PATIENT'));
  return {
    counts: { upcoming: upcomingCount, completed, cancelled },
    unreadNotifications: unread,
    upcoming: items,
    today: items.find((a) => a.appointmentDate === today) ?? null,
  };
}

export async function doctorDashboard(user) {
  const settings = await getSettings();
  const today = todayStr(settings.timeZone);
  const doctor = await prisma.doctorProfile.findUnique({ where: { userId: user.id }, include: { user: { select: { fullName: true } } } });
  const state = await buildQueueState(doctor, today);
  const trend = await dailyStatusCounts({ doctorId: doctor.id }, addDays(today, -6), today);
  const todayList = await prisma.appointment.findMany({
    where: { doctorId: doctor.id, appointmentDate: dbDate(today), status: { in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'WAITING'] } },
    include: appointmentInclude,
    orderBy: { startsAt: 'asc' },
    take: 5,
  });
  return {
    date: today,
    counts: {
      total: state.totalToday,
      waiting: state.waiting.length,
      upcoming: state.upcoming.length,
      completed: state.counts.COMPLETED ?? 0,
      cancelled: state.counts.CANCELLED ?? 0,
      noShow: state.counts.NO_SHOW ?? 0,
    },
    doctorStatus: state.doctorStatus,
    current: state.current,
    nextWaiting: state.waiting[0] ?? null,
    avgConsultationMinutes: state.avgConsultationMinutes,
    trend,
    nextAppointments: todayList.map((a) => toAppointmentDTO(a, 'DOCTOR')),
  };
}

export async function receptionistDashboard() {
  const settings = await getSettings();
  const today = todayStr(settings.timeZone);
  const overview = await getOverview({ date: today });
  const sum = (k) => overview.doctors.reduce((s, d) => s + d[k], 0);
  const walkIns = await prisma.appointment.count({ where: { appointmentDate: dbDate(today), type: 'WALK_IN', status: { not: 'CANCELLED' } } });
  const arrivals = await prisma.queueEntry.count({ where: { queueDate: dbDate(today), checkedInAt: { not: null } } });
  return {
    date: today,
    totals: { appointments: sum('total'), expectedToArrive: sum('upcoming'), waiting: sum('waiting'), inProgress: sum('inProgress'), completed: sum('completed'), cancelled: sum('cancelled'), noShow: sum('noShow'), walkIns, arrivals },
    doctors: overview.doctors,
  };
}

export async function adminDashboard() {
  const settings = await getSettings();
  const today = todayStr(settings.timeZone);
  const t = dbDate(today);
  const [patients, doctors, todayCounts, trend, entries30, workload] = await Promise.all([
    prisma.user.count({ where: { role: 'PATIENT', isActive: true } }),
    prisma.user.count({ where: { role: 'DOCTOR', isActive: true } }),
    prisma.appointment.groupBy({ by: ['status'], where: { appointmentDate: t }, _count: { _all: true } }),
    dailyStatusCounts({}, addDays(today, -13), today),
    prisma.queueEntry.findMany({ where: { queueDate: { gte: dbDate(addDays(today, -29)), lte: t }, checkedInAt: { not: null }, calledAt: { not: null } }, select: { checkedInAt: true, calledAt: true, queueDate: true } }),
    prisma.appointment.groupBy({ by: ['doctorId', 'status'], where: { appointmentDate: t }, _count: { _all: true } }),
  ]);
  const byStatus = Object.fromEntries(todayCounts.map((r) => [r.status, r._count._all]));
  const totalToday = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const waits = entries30.map(waitMinutes).filter((m) => m !== null && m >= 0);
  const todayWaits = entries30.filter((e) => dateKey(e.queueDate) === today).map(waitMinutes).filter((m) => m !== null && m >= 0);

  const docs = await prisma.doctorProfile.findMany({ where: { user: { isActive: true } }, include: { user: { select: { fullName: true } }, specialization: true } });
  const workloadToday = docs
    .map((d) => {
      const mine = workload.filter((w) => w.doctorId === d.id);
      const n = (s) => mine.filter((w) => s.includes(w.status)).reduce((a, w) => a + w._count._all, 0);
      return { doctorId: d.id, fullName: d.user.fullName, specialization: d.specialization.name, total: mine.reduce((a, w) => a + w._count._all, 0), completed: n(['COMPLETED']), waiting: n(['CHECKED_IN', 'WAITING']) };
    })
    .sort((a, b) => b.total - a.total);

  return {
    date: today,
    totals: {
      patients,
      activeDoctors: doctors,
      todayAppointments: totalToday,
      completedToday: byStatus.COMPLETED ?? 0,
      cancelledToday: byStatus.CANCELLED ?? 0,
      noShowToday: byStatus.NO_SHOW ?? 0,
      waitingNow: (byStatus.CHECKED_IN ?? 0) + (byStatus.WAITING ?? 0),
      inConsultationNow: (byStatus.CALLED ?? 0) + (byStatus.IN_CONSULTATION ?? 0),
    },
    avgWaitMinutesToday: average(todayWaits),
    avgWaitMinutes30d: average(waits),
    waitSamples30d: waits.length,
    trend,
    workloadToday,
    queueActivityToday: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
  };
}
