import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { addDays, addMinutes, dateKey, dbDate, toClinicParts, todayStr, weekdayOf, zonedToUtc } from '../utils/time.js';
import { getSettings } from './settingsService.js';

// Statuses that hold a slot (matches the partial unique index in constraints.sql)
export const SLOT_HOLDING_STATUSES = ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'WAITING', 'CALLED', 'IN_CONSULTATION', 'COMPLETED'];

/**
 * Pure function: builds the slot grid for one doctor on one date.
 * Slots come from the doctor's weekly schedule, clipped to clinic hours,
 * minus clinic closed days, doctor leave, past times and already-taken slots.
 */
export function buildDaySlots({ schedules, leaves, settings, dateStr, takenMs, now }) {
  const tz = settings.timeZone;
  const weekday = weekdayOf(dateStr);
  if (settings.closedWeekdays.includes(weekday)) return { closed: true, reason: 'CLINIC_CLOSED', slots: [] };
  const onLeave = leaves.some((l) => dateStr >= dateKey(l.startDate) && dateStr <= dateKey(l.endDate));
  if (onLeave) return { closed: true, reason: 'DOCTOR_ON_LEAVE', slots: [] };

  const opens = zonedToUtc(dateStr, settings.opensAt, tz);
  const closes = zonedToUtc(dateStr, settings.closesAt, tz);
  const sessions = schedules.filter((s) => s.weekday === weekday).sort((a, b) => a.startTime.localeCompare(b.startTime));
  if (sessions.length === 0) return { closed: true, reason: 'NOT_WORKING', slots: [] };

  const slots = [];
  for (const s of sessions) {
    let cursor = zonedToUtc(dateStr, s.startTime, tz);
    const end = zonedToUtc(dateStr, s.endTime, tz);
    for (;;) {
      const slotEnd = addMinutes(cursor, s.slotMinutes);
      if (slotEnd > end) break;
      if (cursor >= opens && slotEnd <= closes) {
        let available = true;
        let reason = null;
        if (cursor <= now) {
          available = false;
          reason = 'PAST';
        } else if (takenMs.has(cursor.getTime())) {
          available = false;
          reason = 'BOOKED';
        }
        slots.push({ startsAt: cursor, endsAt: slotEnd, time: toClinicParts(cursor, tz).time, available, reason });
      }
      cursor = slotEnd;
    }
  }
  return { closed: slots.length === 0, reason: slots.length === 0 ? 'NOT_WORKING' : null, slots };
}

export async function getAvailableSlots(doctorId, dateStr, { client = prisma, now = new Date(), settings } = {}) {
  const cfg = settings ?? (await getSettings(client));
  const doctor = await client.doctorProfile.findUnique({
    where: { id: doctorId },
    include: { user: { select: { isActive: true } }, schedules: true, leaves: true },
  });
  if (!doctor || !doctor.user.isActive) throw new AppError(404, 'NOT_FOUND', 'Doctor not found.');

  const today = todayStr(cfg.timeZone, now);
  const base = { date: dateStr, doctorId, closed: false, reason: null, slots: [] };
  if (dateStr < today) return { ...base, closed: true, reason: 'PAST_DATE' };
  if (dateStr > addDays(today, cfg.maxAdvanceBookingDays)) return { ...base, closed: true, reason: 'TOO_FAR' };

  const dayStart = zonedToUtc(dateStr, '00:00', cfg.timeZone);
  const dayEnd = zonedToUtc(addDays(dateStr, 1), '00:00', cfg.timeZone);
  const booked = await client.appointment.findMany({
    where: { doctorId, startsAt: { gte: dayStart, lt: dayEnd }, status: { in: SLOT_HOLDING_STATUSES } },
    select: { startsAt: true },
  });
  const takenMs = new Set(booked.map((a) => a.startsAt.getTime()));
  const result = buildDaySlots({ schedules: doctor.schedules, leaves: doctor.leaves, settings: cfg, dateStr, takenMs, now });
  return { ...base, ...result };
}

export { dbDate };
