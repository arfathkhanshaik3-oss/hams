import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { SERIALIZABLE, withRetry } from '../utils/retry.js';
import { addMinutes, ageFromDob, dateKey, dbDate, minutesBetween, todayStr, zonedToUtc } from '../utils/time.js';
import { emitQueueUpdated } from '../sockets/io.js';
import { audit } from './auditService.js';
import {
  appointmentInclude,
  createBooking,
  emitAppointmentChange,
  loadForActor,
  toAppointmentDTO,
  transitionAppointment,
} from './appointmentService.js';
import { notify } from './notificationService.js';
import { getSettings } from './settingsService.js';
import { getAvailableSlots } from './slotService.js';

/*
 * QUEUE RULES (also documented in README)
 *  - Queue number = a token handed out at booking (1,2,3... per doctor per day). It is NOT the calling order.
 *  - Calling order = sortKey among patients who are present (CHECKED_IN or WAITING):
 *      on-time appointment  -> slot start time
 *      walk-in              -> the free slot they were given (or arrival time if there was none)
 *      late arrival         -> arrival time (loses their slot priority)
 *      skipped patient      -> the moment they were skipped (goes to the back)
 *  - A second skip becomes NO_SHOW. Receptionists can also mark NO_SHOW manually, and a background job
 *    marks never-arrived patients NO_SHOW noShowAfterMinutes after their slot ended.
 */
const PRESENT = ['CHECKED_IN', 'WAITING'];

const entryInclude = {
  appointment: { include: { patient: { include: { user: { select: { id: true, fullName: true, phone: true } } } } } },
};

export function toQueueItem(e) {
  const a = e.appointment;
  return {
    entryId: e.id,
    appointmentId: a.id,
    reference: a.reference,
    queueNumber: e.queueNumber,
    status: a.status,
    type: a.type,
    startsAt: a.startsAt,
    reasonForVisit: a.reasonForVisit,
    isLate: e.isLate,
    skipCount: e.skipCount,
    checkedInAt: e.checkedInAt,
    calledAt: e.calledAt,
    startedAt: e.startedAt,
    completedAt: e.completedAt,
    patient: { id: a.patient.id, fullName: a.patient.user.fullName, phone: a.patient.user.phone, age: ageFromDob(a.patient.dateOfBirth), gender: a.patient.gender },
  };
}

/** Average consultation length: last 20 completed visits if we have >= 5, otherwise the doctor's configured minutes. */
export async function getAverageConsultation(client, doctor) {
  const recent = await client.queueEntry.findMany({
    where: { doctorId: doctor.id, startedAt: { not: null }, completedAt: { not: null } },
    orderBy: { completedAt: 'desc' },
    take: 20,
    select: { startedAt: true, completedAt: true },
  });
  if (recent.length >= 5) {
    const mean = recent.reduce((sum, r) => sum + minutesBetween(r.startedAt, r.completedAt), 0) / recent.length;
    return { minutes: Math.max(1, Math.round(mean)), source: 'recent_average', samples: recent.length };
  }
  return { minutes: doctor.consultationMinutes, source: 'configured', samples: recent.length };
}

const ESTIMATE_NOTE = 'Estimated waiting time = remaining time of the current consultation + (patients ahead x average consultation length). It is an estimate, not a guaranteed time.';

export async function buildQueueState(doctor, dateStr, client = prisma) {
  const entries = await client.queueEntry.findMany({
    where: { doctorId: doctor.id, queueDate: dbDate(dateStr) },
    include: entryInclude,
    orderBy: [{ sortKey: 'asc' }, { queueNumber: 'asc' }],
  });
  const avg = await getAverageConsultation(client, doctor);
  const now = new Date();
  const status = (e) => e.appointment.status;

  const inRoom = entries.find((e) => status(e) === 'IN_CONSULTATION');
  const called = entries.find((e) => status(e) === 'CALLED');
  const current = inRoom ?? called ?? null;
  let currentRemaining = 0;
  if (inRoom) currentRemaining = Math.max(0, avg.minutes - minutesBetween(inRoom.startedAt ?? now, now));
  else if (called) currentRemaining = avg.minutes;

  const present = entries.filter((e) => PRESENT.includes(status(e)));
  const waiting = present.map((e, i) => ({
    ...toQueueItem(e),
    position: i + 1,
    estimatedWaitMinutes: Math.round(currentRemaining + i * avg.minutes),
  }));
  const upcoming = entries.filter((e) => ['BOOKED', 'CONFIRMED'].includes(status(e))).map(toQueueItem);
  const finished = entries
    .filter((e) => ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status(e)))
    .map(toQueueItem)
    .sort((a, b) => a.queueNumber - b.queueNumber);

  const counts = {};
  for (const e of entries) counts[status(e)] = (counts[status(e)] ?? 0) + 1;

  let doctorStatus = 'IDLE';
  if (inRoom) doctorStatus = 'IN_CONSULTATION';
  else if (called) doctorStatus = 'CALLING';
  else if (waiting.length) doctorStatus = 'AVAILABLE';

  return {
    date: dateStr,
    doctor: { id: doctor.id, fullName: doctor.user?.fullName, room: doctor.room },
    doctorStatus,
    current: current ? toQueueItem(current) : null,
    waiting,
    upcoming,
    finished,
    counts,
    totalToday: entries.length,
    avgConsultationMinutes: avg.minutes,
    avgSource: avg.source,
    estimateNote: ESTIMATE_NOTE,
    updatedAt: now,
  };
}

async function resolveDoctor(actor, doctorId) {
  const include = { user: { select: { fullName: true } } };
  let doctor;
  if (doctorId === 'me') {
    if (actor.role !== 'DOCTOR') throw new AppError(400, 'VALIDATION_ERROR', '"me" can only be used by doctors.');
    doctor = await prisma.doctorProfile.findUnique({ where: { userId: actor.id }, include });
  } else {
    doctor = await prisma.doctorProfile.findUnique({ where: { id: doctorId }, include });
  }
  if (!doctor) throw new AppError(404, 'NOT_FOUND', 'Doctor not found.');
  if (actor.role === 'DOCTOR' && doctor.userId !== actor.id) throw new AppError(403, 'FORBIDDEN', 'You can only access your own queue.');
  return doctor;
}

export async function getDoctorQueue({ actor, doctorId, date }) {
  const doctor = await resolveDoctor(actor, doctorId);
  const settings = await getSettings();
  return buildQueueState(doctor, date ?? todayStr(settings.timeZone));
}

export async function getOverview({ date }) {
  const settings = await getSettings();
  const day = date ?? todayStr(settings.timeZone);
  const doctors = await prisma.doctorProfile.findMany({
    where: { user: { isActive: true } },
    include: { user: { select: { fullName: true } }, specialization: true },
    orderBy: { user: { fullName: 'asc' } },
  });
  const entries = await prisma.queueEntry.findMany({
    where: { queueDate: dbDate(day) },
    select: { doctorId: true, queueNumber: true, appointment: { select: { status: true } } },
  });
  return {
    date: day,
    doctors: doctors.map((d) => {
      const mine = entries.filter((e) => e.doctorId === d.id);
      const count = (...st) => mine.filter((e) => st.includes(e.appointment.status)).length;
      const inRoom = mine.find((e) => ['IN_CONSULTATION', 'CALLED'].includes(e.appointment.status));
      return {
        id: d.id,
        fullName: d.user.fullName,
        specialization: d.specialization.name,
        room: d.room,
        total: mine.length,
        upcoming: count('BOOKED', 'CONFIRMED'),
        waiting: count(...PRESENT),
        inProgress: count('CALLED', 'IN_CONSULTATION'),
        completed: count('COMPLETED'),
        cancelled: count('CANCELLED'),
        noShow: count('NO_SHOW'),
        nowServing: inRoom?.queueNumber ?? null,
      };
    }),
  };
}

/** What a patient sees for their own appointment. No other patient's details are included. */
export async function getMyQueueStatus({ actor, appointmentId }) {
  const appt = await loadForActor(appointmentId, actor);
  const settings = await getSettings();
  const base = {
    appointmentId: appt.id,
    reference: appt.reference,
    appointmentStatus: appt.status,
    startsAt: appt.startsAt,
    doctor: { id: appt.doctor.id, fullName: appt.doctor.user.fullName, room: appt.doctor.room },
    isEstimate: true,
    estimateNote: ESTIMATE_NOTE,
    queueNumber: appt.queueEntry?.queueNumber ?? null,
    isToday: dateKey(appt.appointmentDate) === todayStr(settings.timeZone),
    updatedAt: new Date(),
  };
  if (!appt.queueEntry || !base.isToday) {
    return { ...base, live: false, nowServing: null, patientsWaiting: null, position: null, estimatedWaitMinutes: null, doctorStatus: null };
  }
  const state = await buildQueueState(appt.doctor, dateKey(appt.appointmentDate));
  const mine = state.waiting.find((w) => w.appointmentId === appt.id);
  let position = null;
  let estimatedWaitMinutes = null;
  let projected = false;

  if (mine) {
    position = mine.position;
    estimatedWaitMinutes = mine.estimatedWaitMinutes;
  } else if (['BOOKED', 'CONFIRMED'].includes(appt.status)) {
    // Not here yet: project where they would stand if they arrived now
    const ahead = state.waiting.filter((w) => new Date(w.startsAt) <= appt.startsAt).length;
    const currentRemaining = state.current ? (state.doctorStatus === 'IN_CONSULTATION' ? Math.max(0, state.avgConsultationMinutes - minutesBetween(state.current.startedAt ?? new Date(), new Date())) : state.avgConsultationMinutes) : 0;
    position = ahead + 1;
    estimatedWaitMinutes = Math.round(currentRemaining + ahead * state.avgConsultationMinutes);
    projected = true;
  } else if (['CALLED', 'IN_CONSULTATION'].includes(appt.status)) {
    position = 0;
    estimatedWaitMinutes = 0;
  }
  return {
    ...base,
    live: true,
    projected,
    nowServing: state.current?.queueNumber ?? null,
    patientsWaiting: state.waiting.length,
    position,
    estimatedWaitMinutes,
    doctorStatus: state.doctorStatus,
    avgConsultationMinutes: state.avgConsultationMinutes,
  };
}

/* ---------------------------------------------------------------- actions */

async function loadEntry(entryId, actor) {
  const entry = await prisma.queueEntry.findUnique({ where: { id: entryId }, include: { appointment: { include: appointmentInclude } } });
  if (!entry) throw new AppError(404, 'NOT_FOUND', 'Queue entry not found.');
  if (actor.role === 'DOCTOR' && entry.appointment.doctor.userId !== actor.id) throw new AppError(404, 'NOT_FOUND', 'Queue entry not found.');
  return entry;
}

const patientUserId = (entry) => entry.appointment.patient.user.id;
const afterChange = (entry, status) => emitAppointmentChange(entry.appointment, status);

export async function checkIn({ actor, appointmentId, req }) {
  const appt = await loadForActor(appointmentId, actor);
  const settings = await getSettings();
  if (dateKey(appt.appointmentDate) !== todayStr(settings.timeZone)) {
    throw new AppError(409, 'NOT_TODAY', 'Patients can only be checked in on the day of their appointment.');
  }
  if (!['BOOKED', 'CONFIRMED'].includes(appt.status)) {
    const already = ['CHECKED_IN', 'WAITING', 'CALLED', 'IN_CONSULTATION'].includes(appt.status);
    throw new AppError(409, already ? 'ALREADY_CHECKED_IN' : 'INVALID_STATE', already ? 'This patient is already checked in.' : `Cannot check in an appointment that is ${appt.status.replaceAll('_', ' ').toLowerCase()}.`);
  }
  const now = new Date();
  const isLate = now > addMinutes(appt.startsAt, settings.lateGraceMinutes);
  await prisma.$transaction(async (tx) => {
    await transitionAppointment(tx, appt.id, ['BOOKED', 'CONFIRMED'], { status: 'CHECKED_IN' });
    await tx.queueEntry.update({ where: { appointmentId: appt.id }, data: { checkedInAt: now, isLate, sortKey: isLate ? now : appt.startsAt } });
  });
  await notify(appt.patient.user.id, {
    title: 'You are checked in',
    message: `Queue number ${appt.queueEntry.queueNumber}. ${isLate ? 'You arrived after the grace period, so you will be seen after on-time patients.' : 'Please wait to be called.'}`,
    type: 'QUEUE',
    appointmentId: appt.id,
  });
  emitAppointmentChange(appt, 'CHECKED_IN');
  return { appointmentId: appt.id, status: 'CHECKED_IN', isLate };
}

export async function seatInWaitingArea({ actor, entryId }) {
  const entry = await loadEntry(entryId, actor);
  await prisma.$transaction((tx) => transitionAppointment(tx, entry.appointmentId, ['CHECKED_IN'], { status: 'WAITING' }));
  afterChange(entry, 'WAITING');
  return { entryId, status: 'WAITING' };
}

export async function registerWalkIn({ actor, patientId, doctorId, reasonForVisit, req }) {
  const settings = await getSettings();
  const tz = settings.timeZone;
  const now = new Date();
  const today = todayStr(tz, now);
  const doctor = await prisma.doctorProfile.findUnique({ where: { id: doctorId }, include: { user: { select: { isActive: true, fullName: true } } } });
  if (!doctor || !doctor.user.isActive) throw new AppError(404, 'NOT_FOUND', 'Doctor not found.');

  const day = await getAvailableSlots(doctorId, today, { settings, now });
  if (day.closed) {
    const why = { CLINIC_CLOSED: 'The clinic is closed today.', DOCTOR_ON_LEAVE: 'The doctor is on leave today.', NOT_WORKING: 'The doctor does not work today.' };
    throw new AppError(409, 'DOCTOR_NOT_AVAILABLE', why[day.reason] ?? 'The doctor is not available today.');
  }
  if (now < zonedToUtc(today, settings.opensAt, tz) || now >= zonedToUtc(today, settings.closesAt, tz)) {
    throw new AppError(409, 'CLINIC_CLOSED', 'The clinic is not open right now.');
  }
  if (now >= day.slots[day.slots.length - 1].endsAt) throw new AppError(409, 'SESSION_ENDED', "The doctor's session for today has ended.");

  const walkIns = await prisma.appointment.count({ where: { doctorId, appointmentDate: dbDate(today), type: 'WALK_IN', status: { not: 'CANCELLED' } } });
  if (walkIns >= settings.maxDailyWalkIns) throw new AppError(409, 'WALKIN_LIMIT', `The daily walk-in limit (${settings.maxDailyWalkIns}) has been reached for this doctor.`);

  const avg = await getAverageConsultation(prisma, doctor);
  const created = await withRetry((attempt) =>
    prisma.$transaction(async (tx) => {
      // Walk-ins take the next free slot; if none is left they join the end of the queue (overflow)
      const fresh = await getAvailableSlots(doctorId, today, { client: tx, settings, now });
      const free = fresh.slots.find((s) => s.available);
      const common = { doctorId, patientId, reason: reasonForVisit, type: 'WALK_IN', bookedById: actor.id, settings, now };
      if (free) {
        return createBooking(tx, { ...common, start: free.startsAt, initial: { status: 'CHECKED_IN', checkedInAt: now, sortKey: free.startsAt } });
      }
      const start = new Date(Math.floor(now.getTime() / 1000) * 1000 + attempt * 1000);
      return createBooking(tx, {
        ...common,
        start,
        skipSlotCheck: true,
        initial: { endsAt: addMinutes(start, avg.minutes), status: 'CHECKED_IN', checkedInAt: now, sortKey: start },
      });
    }, SERIALIZABLE),
  );
  await notify(created.patient.user.id, {
    title: 'Walk-in registered',
    message: `You are in the queue for ${doctor.user.fullName}. Queue number ${created.queueEntry.queueNumber}.`,
    type: 'QUEUE',
    appointmentId: created.id,
  });
  await notify(doctor.userId, { title: 'Walk-in patient', message: `${created.patient.user.fullName} joined your queue (no. ${created.queueEntry.queueNumber}).`, type: 'QUEUE', appointmentId: created.id });
  emitAppointmentChange(created);
  await audit(req, { action: 'WALK_IN_REGISTERED', entityType: 'Appointment', entityId: created.id, details: { reference: created.reference, doctorId } });
  return toAppointmentDTO(created, actor.role);
}

export async function callNext({ actor, doctorId, req }) {
  const doctor = await resolveDoctor(actor, doctorId);
  const settings = await getSettings();
  const queueDate = dbDate(todayStr(settings.timeZone));
  const called = await withRetry(() =>
    prisma.$transaction(async (tx) => {
      const busy = await tx.queueEntry.findFirst({
        where: { doctorId: doctor.id, queueDate, appointment: { status: { in: ['CALLED', 'IN_CONSULTATION'] } } },
        select: { queueNumber: true, appointment: { select: { status: true } } },
      });
      if (busy) {
        throw new AppError(409, 'CONSULTATION_IN_PROGRESS', busy.appointment.status === 'CALLED'
          ? `Patient #${busy.queueNumber} has been called. Start their consultation or skip them first.`
          : `Patient #${busy.queueNumber} is still in consultation. Complete it before calling the next patient.`);
      }
      const next = await tx.queueEntry.findFirst({
        where: { doctorId: doctor.id, queueDate, appointment: { status: { in: PRESENT } } },
        orderBy: [{ sortKey: 'asc' }, { queueNumber: 'asc' }],
        include: { appointment: { include: appointmentInclude } },
      });
      if (!next) throw new AppError(404, 'QUEUE_EMPTY', 'No patients are waiting.');
      await transitionAppointment(tx, next.appointmentId, PRESENT, { status: 'CALLED' });
      await tx.queueEntry.update({ where: { id: next.id }, data: { calledAt: new Date() } });
      return next;
    }, SERIALIZABLE),
  );
  await notify(patientUserId(called), {
    title: "It's your turn",
    message: `Queue number ${called.queueNumber}: please proceed to ${doctor.room ? `room ${doctor.room}` : "the doctor's room"}.`,
    type: 'QUEUE',
    appointmentId: called.appointmentId,
  });
  afterChange(called, 'CALLED');
  return { entryId: called.id, appointmentId: called.appointmentId, queueNumber: called.queueNumber, status: 'CALLED' };
}

export async function startConsultation({ actor, entryId }) {
  const entry = await loadEntry(entryId, actor);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await transitionAppointment(tx, entry.appointmentId, ['CALLED'], { status: 'IN_CONSULTATION' });
    await tx.queueEntry.update({ where: { id: entryId }, data: { startedAt: now } });
  });
  afterChange(entry, 'IN_CONSULTATION');
  return { entryId, status: 'IN_CONSULTATION' };
}

export async function completeConsultation({ actor, entryId }) {
  const entry = await loadEntry(entryId, actor);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await transitionAppointment(tx, entry.appointmentId, ['IN_CONSULTATION'], { status: 'COMPLETED' });
    await tx.queueEntry.update({ where: { id: entryId }, data: { completedAt: now } });
  });
  await notify(patientUserId(entry), { title: 'Consultation completed', message: `Your visit ${entry.appointment.reference} is complete. Thank you.`, type: 'APPOINTMENT', appointmentId: entry.appointmentId });
  afterChange(entry, 'COMPLETED');
  return { entryId, status: 'COMPLETED' };
}

export async function skipPatient({ actor, entryId, reason, req }) {
  const entry = await loadEntry(entryId, actor);
  if (!['CHECKED_IN', 'WAITING', 'CALLED'].includes(entry.appointment.status)) {
    throw new AppError(409, 'INVALID_STATE', 'Only patients who are waiting or have been called can be skipped.');
  }
  const noShow = entry.skipCount + 1 >= 2;
  await prisma.$transaction(async (tx) => {
    await transitionAppointment(tx, entry.appointmentId, ['CHECKED_IN', 'WAITING', 'CALLED'], { status: noShow ? 'NO_SHOW' : 'WAITING' });
    await tx.queueEntry.update({ where: { id: entryId }, data: { skipCount: { increment: 1 }, sortKey: new Date(), calledAt: null } });
  });
  await notify(patientUserId(entry), {
    title: noShow ? 'Marked as no-show' : 'You were skipped',
    message: noShow
      ? `You were skipped twice, so appointment ${entry.appointment.reference} was marked as a no-show. Please speak to reception.`
      : 'The doctor moved on to the next patient. You remain in the queue and will be called again after the patients who are waiting.',
    type: 'QUEUE',
    appointmentId: entry.appointmentId,
  });
  await audit(req ?? { user: actor }, { action: 'QUEUE_PATIENT_SKIPPED', entityType: 'QueueEntry', entityId: entryId, details: { reference: entry.appointment.reference, reason, becameNoShow: noShow } });
  afterChange(entry, noShow ? 'NO_SHOW' : 'WAITING');
  return { entryId, status: noShow ? 'NO_SHOW' : 'WAITING', skipCount: entry.skipCount + 1 };
}

export async function markNoShow({ actor, entryId, reason, req }) {
  const entry = await loadEntry(entryId, actor);
  const from = ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'WAITING', 'CALLED'];
  if (!from.includes(entry.appointment.status)) throw new AppError(409, 'INVALID_STATE', 'This appointment can no longer be marked as a no-show.');
  await prisma.$transaction((tx) => transitionAppointment(tx, entry.appointmentId, from, { status: 'NO_SHOW' }));
  await notify(patientUserId(entry), { title: 'Marked as no-show', message: `Appointment ${entry.appointment.reference} was marked as a no-show.`, type: 'APPOINTMENT', appointmentId: entry.appointmentId });
  await audit(req ?? { user: actor }, { action: 'QUEUE_MARKED_NO_SHOW', entityType: 'QueueEntry', entityId: entryId, details: { reference: entry.appointment.reference, reason } });
  afterChange(entry, 'NO_SHOW');
  return { entryId, status: 'NO_SHOW' };
}

// Moves a waiting patient to a new position (1 = next to be called). Receptionist only, reason recorded.
export async function reorderEntry({ actor, entryId, position, reason, req }) {
  const entry = await loadEntry(entryId, actor);
  if (!PRESENT.includes(entry.appointment.status)) throw new AppError(409, 'INVALID_STATE', 'Only patients who are waiting can be reordered.');
  const result = await withRetry(() =>
    prisma.$transaction(async (tx) => {
      const present = await tx.queueEntry.findMany({
        where: { doctorId: entry.doctorId, queueDate: entry.queueDate, appointment: { status: { in: PRESENT } } },
        orderBy: [{ sortKey: 'asc' }, { queueNumber: 'asc' }],
      });
      const from = present.findIndex((e) => e.id === entryId);
      if (from === -1) throw new AppError(409, 'STATE_CONFLICT', 'The queue changed. Please refresh.');
      const keys = present.map((e) => e.sortKey);
      const order = [...present];
      const [moved] = order.splice(from, 1);
      const to = Math.min(Math.max(position - 1, 0), order.length);
      order.splice(to, 0, moved);
      // Re-use the same set of sort keys in the new order (keeps the ordering relative to everyone else)
      let prev = null;
      for (let i = 0; i < order.length; i += 1) {
        let key = keys[i];
        if (prev && key.getTime() <= prev.getTime()) key = new Date(prev.getTime() + 1);
        prev = key;
        if (order[i].sortKey.getTime() !== key.getTime()) await tx.queueEntry.update({ where: { id: order[i].id }, data: { sortKey: key } });
      }
      return { from: from + 1, to: to + 1 };
    }, SERIALIZABLE),
  );
  await audit(req ?? { user: actor }, { action: 'QUEUE_REORDERED', entityType: 'QueueEntry', entityId: entryId, details: { reference: entry.appointment.reference, from: result.from, to: result.to, reason } });
  emitQueueUpdated(entry.doctorId);
  return { entryId, ...result };
}

export async function entryIdForAppointment(appointmentId) {
  const e = await prisma.queueEntry.findUnique({ where: { appointmentId }, select: { id: true } });
  if (!e) throw new AppError(404, 'NOT_FOUND', 'This appointment has no queue entry.');
  return e.id;
}

/** Background job: appointments nobody showed up for become NO_SHOW. */
export async function markMissedAppointments(now = new Date()) {
  const settings = await getSettings();
  const cutoff = addMinutes(now, -settings.noShowAfterMinutes);
  const missed = await prisma.appointment.findMany({
    where: { status: { in: ['BOOKED', 'CONFIRMED'] }, endsAt: { lt: cutoff } },
    include: appointmentInclude,
  });
  for (const appt of missed) {
    const r = await prisma.appointment.updateMany({ where: { id: appt.id, status: { in: ['BOOKED', 'CONFIRMED'] } }, data: { status: 'NO_SHOW' } });
    if (r.count) {
      await notify(appt.patient.user.id, { title: 'Appointment missed', message: `Appointment ${appt.reference} was marked as a no-show because you did not arrive.`, type: 'APPOINTMENT', appointmentId: appt.id });
      emitAppointmentChange(appt, 'NO_SHOW');
    }
  }
  return missed.length;
}
