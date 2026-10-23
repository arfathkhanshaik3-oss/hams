import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { pageMeta, parsePagination } from '../utils/pagination.js';
import { addDays, dateKey, dbDate, toClinicParts, todayStr, weekdayOf, zonedToUtc } from '../utils/time.js';
import { hashPassword } from './authService.js';
import { getSettings } from './settingsService.js';
import { getAvailableSlots, SLOT_HOLDING_STATUSES } from './slotService.js';
import { cancelAppointment } from './appointmentService.js';

const doctorInclude = {
  user: { select: { id: true, fullName: true, email: true, phone: true, isActive: true } },
  specialization: true,
  schedules: { orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] },
};

export const toDoctorDTO = (d, { includeAccount = false } = {}) => ({
  id: d.id,
  fullName: d.user.fullName,
  specialization: { id: d.specialization.id, name: d.specialization.name },
  consultationFee: Number(d.consultationFee),
  consultationMinutes: d.consultationMinutes,
  experienceYears: d.experienceYears,
  qualification: d.qualification,
  bio: d.bio,
  room: d.room,
  isActive: d.user.isActive,
  schedule: d.schedules.map((s) => ({ id: s.id, weekday: s.weekday, startTime: s.startTime, endTime: s.endTime, slotMinutes: s.slotMinutes })),
  ...(includeAccount ? { userId: d.user.id, email: d.user.email, phone: d.user.phone } : {}),
});

export async function listDoctors(query, { adminView = false } = {}) {
  const { page, limit, skip, take } = parsePagination(query, { defaultLimit: 9, maxLimit: 50 });
  const settings = await getSettings();
  const where = {
    user: { ...(adminView && query.status !== undefined ? { isActive: query.status === 'active' } : adminView ? {} : { isActive: true }) },
    ...(query.specializationId ? { specializationId: query.specializationId } : {}),
    ...(query.search
      ? {
          OR: [
            { user: { fullName: { contains: query.search, mode: 'insensitive' } } },
            { specialization: { name: { contains: query.search, mode: 'insensitive' } } },
            { qualification: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  if (query.availableOn) {
    // Only doctors who work that weekday, are not on leave, and the clinic is open
    const weekday = weekdayOf(query.availableOn);
    if (settings.closedWeekdays.includes(weekday)) where.id = { in: [] };
    else {
      where.schedules = { some: { weekday } };
      where.NOT = { leaves: { some: { startDate: { lte: dbDate(query.availableOn) }, endDate: { gte: dbDate(query.availableOn) } } } };
    }
  }
  const [rows, total] = await Promise.all([
    prisma.doctorProfile.findMany({ where, include: doctorInclude, orderBy: { user: { fullName: 'asc' } }, skip, take }),
    prisma.doctorProfile.count({ where }),
  ]);
  const items = rows.map((d) => toDoctorDTO(d, { includeAccount: adminView }));
  if (query.availableOn) {
    await Promise.all(
      items.map(async (item) => {
        const r = await getAvailableSlots(item.id, query.availableOn, { settings });
        item.freeSlots = r.slots.filter((s) => s.available).length;
      }),
    );
  }
  return { items, meta: pageMeta(total, page, limit) };
}

export async function getDoctor(id, { adminView = false } = {}) {
  const d = await prisma.doctorProfile.findUnique({ where: { id }, include: doctorInclude });
  if (!d || (!adminView && !d.user.isActive)) throw new AppError(404, 'NOT_FOUND', 'Doctor not found.');
  return toDoctorDTO(d, { includeAccount: adminView });
}

export async function createDoctor(data, req) {
  const spec = await prisma.specialization.findUnique({ where: { id: data.specializationId } });
  if (!spec) throw new AppError(400, 'INVALID_SPECIALIZATION', 'Specialization not found.', { specializationId: 'Choose a specialization' });
  if (await prisma.user.findUnique({ where: { email: data.email } })) {
    throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists.', { email: 'Email already registered' });
  }
  const created = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash: await hashPassword(data.password),
      role: 'DOCTOR',
      fullName: data.fullName,
      phone: data.phone,
      doctorProfile: {
        create: {
          specializationId: data.specializationId,
          consultationFee: data.consultationFee,
          consultationMinutes: data.consultationMinutes,
          experienceYears: data.experienceYears,
          qualification: data.qualification,
          bio: data.bio,
          room: data.room,
        },
      },
    },
    include: { doctorProfile: true },
  });
  return { doctorId: created.doctorProfile.id, userId: created.id };
}

export async function updateDoctor(id, data) {
  const d = await prisma.doctorProfile.findUnique({ where: { id }, include: { user: true } });
  if (!d) throw new AppError(404, 'NOT_FOUND', 'Doctor not found.');
  if (data.specializationId && !(await prisma.specialization.findUnique({ where: { id: data.specializationId } }))) {
    throw new AppError(400, 'INVALID_SPECIALIZATION', 'Specialization not found.', { specializationId: 'Choose a specialization' });
  }
  if (data.email && data.email !== d.user.email && (await prisma.user.findUnique({ where: { email: data.email } }))) {
    throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists.', { email: 'Email already registered' });
  }
  await prisma.$transaction(async (tx) => {
    const u = {};
    for (const k of ['fullName', 'email', 'phone']) if (data[k] !== undefined) u[k] = data[k];
    if (Object.keys(u).length) await tx.user.update({ where: { id: d.userId }, data: u });
    const p = {};
    for (const k of ['specializationId', 'consultationFee', 'consultationMinutes', 'experienceYears', 'qualification', 'bio', 'room']) {
      if (data[k] !== undefined) p[k] = data[k];
    }
    if (Object.keys(p).length) await tx.doctorProfile.update({ where: { id }, data: p });
  });
  return getDoctor(id, { adminView: true });
}

export async function setDoctorActive(id, isActive) {
  const d = await prisma.doctorProfile.findUnique({ where: { id } });
  if (!d) throw new AppError(404, 'NOT_FOUND', 'Doctor not found.');
  await prisma.user.update({ where: { id: d.userId }, data: { isActive } });
  const settings = await getSettings();
  const futureAppointments = await prisma.appointment.count({
    where: { doctorId: id, startsAt: { gte: new Date() }, status: { in: ['BOOKED', 'CONFIRMED'] } },
  });
  return { id, isActive, futureAppointments, note: !isActive && futureAppointments ? `${futureAppointments} upcoming appointment(s) remain and should be cancelled or reassigned.` : undefined, timeZone: settings.timeZone };
}

/* ---------------- schedule & leave ---------------- */

// Doctors may only manage their own schedule; admins may manage anyone's.
export async function assertCanManageDoctor(actor, doctorId) {
  const d = await prisma.doctorProfile.findUnique({ where: { id: doctorId }, select: { id: true, userId: true } });
  if (!d) throw new AppError(404, 'NOT_FOUND', 'Doctor not found.');
  if (actor.role === 'DOCTOR' && d.userId !== actor.id) throw new AppError(403, 'FORBIDDEN', 'You can only manage your own schedule.');
  if (actor.role !== 'DOCTOR' && actor.role !== 'ADMIN') throw new AppError(403, 'FORBIDDEN', 'You do not have permission to do that.');
  return d;
}

export async function getSchedule(doctorId) {
  const settings = await getSettings();
  const d = await prisma.doctorProfile.findUnique({
    where: { id: doctorId },
    include: {
      schedules: { orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] },
      leaves: { where: { endDate: { gte: dbDate(todayStr(settings.timeZone)) } }, orderBy: { startDate: 'asc' } },
    },
  });
  if (!d) throw new AppError(404, 'NOT_FOUND', 'Doctor not found.');
  return {
    schedule: d.schedules.map((s) => ({ id: s.id, weekday: s.weekday, startTime: s.startTime, endTime: s.endTime, slotMinutes: s.slotMinutes })),
    leaves: d.leaves.map((l) => ({ id: l.id, startDate: dateKey(l.startDate), endDate: dateKey(l.endDate), reason: l.reason })),
  };
}

export async function replaceSchedule(doctorId, sessions) {
  const settings = await getSettings();
  // Validate each session and overlaps within the same weekday
  const byDay = new Map();
  for (const s of sessions) {
    if (s.startTime >= s.endTime) throw new AppError(400, 'INVALID_SCHEDULE', 'Each session must end after it starts.');
    if (s.startTime < settings.opensAt || s.endTime > settings.closesAt) {
      throw new AppError(400, 'OUTSIDE_CLINIC_HOURS', `Sessions must be within clinic hours (${settings.opensAt} - ${settings.closesAt}).`);
    }
    const list = byDay.get(s.weekday) ?? [];
    for (const o of list) {
      if (s.startTime < o.endTime && o.startTime < s.endTime) throw new AppError(400, 'OVERLAPPING_SESSIONS', 'Sessions on the same day cannot overlap.');
    }
    list.push(s);
    byDay.set(s.weekday, list);
  }
  await prisma.$transaction(async (tx) => {
    await tx.doctorSchedule.deleteMany({ where: { doctorId } });
    if (sessions.length) await tx.doctorSchedule.createMany({ data: sessions.map((s) => ({ ...s, doctorId })) });
  });

  // Tell the caller if existing future bookings no longer fit the new schedule
  const future = await prisma.appointment.findMany({
    where: { doctorId, startsAt: { gte: new Date() }, status: { in: ['BOOKED', 'CONFIRMED'] } },
    select: { startsAt: true, appointmentDate: true },
  });
  const orphaned = future.filter((a) => {
    const p = toClinicParts(a.startsAt, settings.timeZone);
    return !sessions.some((s) => s.weekday === p.weekday && p.time >= s.startTime && p.time < s.endTime);
  }).length;
  const schedule = await getSchedule(doctorId);
  return { ...schedule, warnings: orphaned ? [`${orphaned} existing appointment(s) fall outside the new schedule. They were not changed - review them in Appointments.`] : [] };
}

export async function addLeave(actor, doctorId, { startDate, endDate, reason, cancelAppointments }) {
  const settings = await getSettings();
  if (endDate < startDate) throw new AppError(400, 'INVALID_DATES', 'End date cannot be before the start date.', { endDate: 'Must be on or after start date' });
  if (endDate < todayStr(settings.timeZone)) throw new AppError(400, 'INVALID_DATES', 'Leave must include today or a future date.');
  const from = zonedToUtc(startDate, '00:00', settings.timeZone);
  const to = zonedToUtc(addDays(endDate, 1), '00:00', settings.timeZone);
  const affected = await prisma.appointment.findMany({
    where: { doctorId, startsAt: { gte: from, lt: to }, status: { in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'WAITING'] } },
    select: { id: true },
  });
  if (affected.length && !cancelAppointments) {
    throw new AppError(409, 'APPOINTMENTS_EXIST', `${affected.length} active appointment(s) fall in this period. Choose to cancel them (patients are notified) or pick other dates.`, { count: affected.length });
  }
  const leave = await prisma.doctorLeave.create({ data: { doctorId, startDate: dbDate(startDate), endDate: dbDate(endDate), reason } });
  for (const a of affected) await cancelAppointment({ actor, id: a.id, reason: 'Doctor is unavailable on this date' });
  return { id: leave.id, startDate, endDate, reason: leave.reason, cancelledAppointments: affected.length };
}

export async function removeLeave(doctorId, leaveId) {
  const result = await prisma.doctorLeave.deleteMany({ where: { id: leaveId, doctorId } });
  if (result.count === 0) throw new AppError(404, 'NOT_FOUND', 'Leave entry not found.');
}

export { SLOT_HOLDING_STATUSES };
