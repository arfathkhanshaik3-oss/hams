import crypto from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { pageMeta, parsePagination } from '../utils/pagination.js';
import { SERIALIZABLE, withRetry } from '../utils/retry.js';
import { ageFromDob, dateKey, dbDate, minutesBetween, toClinicParts } from '../utils/time.js';
import { emitQueueUpdated, emitToUser } from '../sockets/io.js';
import { audit } from './auditService.js';
import { notify } from './notificationService.js';
import { getSettings } from './settingsService.js';
import { getAvailableSlots } from './slotService.js';

export const FINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];
export const OPEN_STATUSES = ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'WAITING', 'CALLED', 'IN_CONSULTATION'];

export const appointmentInclude = {
  doctor: { include: { user: { select: { id: true, fullName: true } }, specialization: true } },
  patient: { include: { user: { select: { id: true, fullName: true, email: true, phone: true } } } },
  queueEntry: true,
};

const fmtTime = (date, tz) => {
  const p = toClinicParts(date, tz);
  return `${p.date} ${p.time}`;
};

function makeReference(dateStr) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (const byte of crypto.randomBytes(4)) code += alphabet[byte % alphabet.length];
  return `APT-${dateStr.replaceAll('-', '')}-${code}`;
}

// What each role is allowed to see about the patient
export function toAppointmentDTO(a, viewerRole) {
  const p = a.patient;
  const patient = { id: p.id, fullName: p.user.fullName };
  if (viewerRole !== 'PATIENT') {
    patient.phone = p.user.phone;
    patient.age = ageFromDob(p.dateOfBirth);
    patient.gender = p.gender;
  }
  if (viewerRole === 'PATIENT') {
    patient.phone = p.user.phone;
    patient.dateOfBirth = p.dateOfBirth ? dateKey(p.dateOfBirth) : null;
    patient.gender = p.gender;
  }
  if (viewerRole === 'RECEPTIONIST' || viewerRole === 'ADMIN') {
    patient.email = p.user.email.endsWith('@walkin.local') ? null : p.user.email;
    patient.address = p.address;
    patient.emergencyContact = p.emergencyContact;
  }
  const q = a.queueEntry;
  return {
    id: a.id,
    reference: a.reference,
    status: a.status,
    type: a.type,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    appointmentDate: dateKey(a.appointmentDate),
    reasonForVisit: a.reasonForVisit,
    cancelReason: a.cancelReason,
    rescheduleCount: a.rescheduleCount,
    createdAt: a.createdAt,
    doctor: {
      id: a.doctor.id,
      fullName: a.doctor.user.fullName,
      specialization: a.doctor.specialization.name,
      room: a.doctor.room,
      consultationFee: Number(a.doctor.consultationFee),
    },
    patient,
    queue: q
      ? {
          id: q.id,
          queueNumber: q.queueNumber,
          checkedInAt: q.checkedInAt,
          calledAt: q.calledAt,
          startedAt: q.startedAt,
          completedAt: q.completedAt,
          skipCount: q.skipCount,
          isLate: q.isLate,
        }
      : null,
  };
}

// Loads an appointment only if the actor is allowed to see it.
// Patients and doctors who do not own it get "not found" so existence is not revealed.
export async function loadForActor(id, actor, client = prisma) {
  const appt = await client.appointment.findUnique({ where: { id }, include: appointmentInclude });
  if (!appt) throw new AppError(404, 'NOT_FOUND', 'Appointment not found.');
  if (actor.role === 'PATIENT' && appt.patient.userId !== actor.id) throw new AppError(404, 'NOT_FOUND', 'Appointment not found.');
  if (actor.role === 'DOCTOR' && appt.doctor.userId !== actor.id) throw new AppError(404, 'NOT_FOUND', 'Appointment not found.');
  return appt;
}

// Compare-and-set: only changes the appointment if it is still in one of the expected states
export async function transitionAppointment(tx, id, fromStatuses, data) {
  const r = await tx.appointment.updateMany({ where: { id, status: { in: fromStatuses } }, data });
  if (r.count === 0) throw new AppError(409, 'STATE_CONFLICT', 'This appointment was just updated by someone else. Please refresh.');
}

export function emitAppointmentChange(appt, status) {
  emitQueueUpdated(appt.doctorId);
  emitToUser(appt.patient.user.id, 'appointment:statusChanged', { appointmentId: appt.id, status: status ?? appt.status });
}

const closedDayErrors = (settings) => ({
  PAST_DATE: new AppError(400, 'SLOT_IN_PAST', 'You cannot book a time in the past.'),
  TOO_FAR: new AppError(400, 'TOO_FAR_AHEAD', `Appointments can be booked up to ${settings.maxAdvanceBookingDays} days ahead.`),
  CLINIC_CLOSED: new AppError(409, 'CLINIC_CLOSED', 'The clinic is closed on that day.'),
  DOCTOR_ON_LEAVE: new AppError(409, 'DOCTOR_ON_LEAVE', 'The doctor is on leave on that date.'),
  NOT_WORKING: new AppError(409, 'DOCTOR_NOT_WORKING', 'The doctor does not work at that time.'),
});

/**
 * Creates an appointment + its queue entry inside the given transaction.
 * Every rule is re-checked here on the server: slot validity, clinic hours,
 * leave, past times, conflicts and duplicate bookings.
 */
export async function createBooking(tx, opts) {
  const { doctorId, patientId, start, reason, type, bookedById, settings, now = new Date(), skipSlotCheck = false, initial = {}, selfService = false } = opts;
  const tz = settings.timeZone;

  const doctor = await tx.doctorProfile.findUnique({ where: { id: doctorId }, include: { user: { select: { isActive: true } } } });
  if (!doctor || !doctor.user.isActive) throw new AppError(404, 'NOT_FOUND', 'Doctor not found.');
  const patient = await tx.patientProfile.findUnique({ where: { id: patientId }, include: { user: { select: { isActive: true } } } });
  if (!patient || !patient.user.isActive) throw new AppError(404, 'NOT_FOUND', 'Patient not found.');

  const dateStr = toClinicParts(start, tz).date;
  let endsAt = initial.endsAt;
  if (!skipSlotCheck) {
    const day = await getAvailableSlots(doctorId, dateStr, { client: tx, settings, now });
    if (day.closed && day.reason) throw closedDayErrors(settings)[day.reason] ?? new AppError(409, 'UNAVAILABLE', 'That day is not available.');
    const slot = day.slots.find((s) => s.startsAt.getTime() === start.getTime());
    if (!slot) throw new AppError(400, 'INVALID_SLOT', 'That is not a valid appointment time for this doctor.');
    if (!slot.available) {
      if (slot.reason === 'PAST') throw new AppError(400, 'SLOT_IN_PAST', 'You cannot book a time in the past.');
      throw new AppError(409, 'SLOT_TAKEN', 'This time slot has just been booked. Please choose another one.');
    }
    endsAt = slot.endsAt;
  }

  const appointmentDate = dbDate(dateStr);
  const duplicate = await tx.appointment.findFirst({
    where: { patientId, doctorId, appointmentDate, status: { notIn: ['CANCELLED', 'NO_SHOW', 'COMPLETED'] } },
    select: { id: true },
  });
  if (duplicate) {
    throw new AppError(
      409,
      'DUPLICATE_BOOKING',
      selfService
        ? 'You already have an appointment with this doctor on that day.'
        : 'This patient already has an active appointment with this doctor on that day. Check them in on the existing appointment instead.',
    );
  }

  const agg = await tx.queueEntry.aggregate({ where: { doctorId, queueDate: appointmentDate }, _max: { queueNumber: true } });
  const queueNumber = (agg._max.queueNumber ?? 0) + 1;

  return tx.appointment.create({
    data: {
      reference: makeReference(dateStr),
      doctorId,
      patientId,
      startsAt: start,
      endsAt,
      appointmentDate,
      status: initial.status ?? 'BOOKED',
      type,
      reasonForVisit: reason ?? null,
      bookedById,
      queueEntry: {
        create: { doctorId, queueDate: appointmentDate, queueNumber, sortKey: initial.sortKey ?? start, checkedInAt: initial.checkedInAt ?? null },
      },
    },
    include: appointmentInclude,
  });
}

export async function notifyBooked(appt, settings, { byStaff }) {
  const when = fmtTime(appt.startsAt, settings.timeZone);
  await notify(appt.patient.user.id, {
    title: 'Appointment booked',
    message: `Your appointment with ${appt.doctor.user.fullName} is booked for ${when}. Reference ${appt.reference}, queue number ${appt.queueEntry.queueNumber}.`,
    type: 'APPOINTMENT',
    appointmentId: appt.id,
  });
  await notify(appt.doctor.userId, {
    title: 'New appointment',
    message: `${appt.patient.user.fullName} booked ${when}${byStaff ? ' (booked by staff)' : ''}.`,
    type: 'APPOINTMENT',
    appointmentId: appt.id,
  });
  emitAppointmentChange(appt);
}

export async function bookAppointment({ actor, doctorId, patientId, startsAt, reasonForVisit }) {
  let pid = patientId;
  if (actor.role === 'PATIENT') {
    // A patient can only ever book for themselves, whatever patientId the browser sends
    const profile = await prisma.patientProfile.findUnique({ where: { userId: actor.id } });
    if (!profile) throw new AppError(403, 'FORBIDDEN', 'Patient profile not found.');
    pid = profile.id;
  } else if (actor.role === 'RECEPTIONIST') {
    if (!patientId) throw new AppError(400, 'VALIDATION_ERROR', 'Choose a patient.', { patientId: 'Patient is required' });
  } else {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to book appointments.');
  }

  const settings = await getSettings();
  const start = new Date(startsAt);
  const created = await withRetry(() =>
    prisma.$transaction(
      (tx) =>
        createBooking(tx, {
          doctorId,
          patientId: pid,
          start,
          reason: reasonForVisit,
          type: actor.role === 'PATIENT' ? 'ONLINE' : 'STAFF_BOOKED',
          bookedById: actor.id,
          settings,
          selfService: actor.role === 'PATIENT',
        }),
      SERIALIZABLE,
    ),
  );
  await notifyBooked(created, settings, { byStaff: actor.role !== 'PATIENT' });
  return toAppointmentDTO(created, actor.role);
}

export async function listAppointments({ actor, query }) {
  const { page, limit, skip, take } = parsePagination(query);
  const settings = await getSettings();
  const and = [];
  if (actor.role === 'PATIENT') and.push({ patient: { userId: actor.id } });
  if (actor.role === 'DOCTOR') and.push({ doctor: { userId: actor.id } });
  if (query.status) and.push({ status: { in: query.status.split(',') } });
  if (query.type) and.push({ type: query.type });
  if (query.doctorId) and.push({ doctorId: query.doctorId });
  if (query.date) and.push({ appointmentDate: dbDate(query.date) });
  if (query.from) and.push({ appointmentDate: { gte: dbDate(query.from) } });
  if (query.to) and.push({ appointmentDate: { lte: dbDate(query.to) } });
  if (query.scope === 'upcoming') and.push({ status: { in: OPEN_STATUSES }, endsAt: { gte: new Date() } });
  if (query.scope === 'past') and.push({ OR: [{ status: { in: FINAL_STATUSES } }, { endsAt: { lt: new Date() } }] });
  if (query.search) {
    const s = query.search;
    const ors = [{ reference: { contains: s, mode: 'insensitive' } }];
    if (actor.role === 'PATIENT') ors.push({ doctor: { user: { fullName: { contains: s, mode: 'insensitive' } } } });
    else ors.push({ patient: { user: { fullName: { contains: s, mode: 'insensitive' } } } }, { patient: { user: { phone: { contains: s } } } });
    and.push({ OR: ors });
  }
  const where = and.length ? { AND: and } : {};
  const orderBy = { [query.sort === 'createdAt' ? 'createdAt' : 'startsAt']: query.order };
  const [rows, total] = await Promise.all([
    prisma.appointment.findMany({ where, include: appointmentInclude, orderBy, skip, take }),
    prisma.appointment.count({ where }),
  ]);
  return { items: rows.map((a) => toAppointmentDTO(a, actor.role)), meta: pageMeta(total, page, limit), timeZone: settings.timeZone };
}

export async function getAppointment(id, actor) {
  const appt = await loadForActor(id, actor);
  return toAppointmentDTO(appt, actor.role);
}

const CANCELLABLE = {
  PATIENT: ['BOOKED', 'CONFIRMED'],
  DOCTOR: ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'WAITING'],
  RECEPTIONIST: ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'WAITING', 'CALLED'],
  ADMIN: ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'WAITING', 'CALLED'],
};

export async function cancelAppointment({ actor, id, reason, req }) {
  const appt = await loadForActor(id, actor);
  const settings = await getSettings();
  const allowed = CANCELLABLE[actor.role] ?? [];
  if (!allowed.includes(appt.status)) {
    throw new AppError(409, 'INVALID_STATE', `An appointment that is "${appt.status.replaceAll('_', ' ').toLowerCase()}" cannot be cancelled.`);
  }
  if (actor.role === 'PATIENT') {
    const hoursLeft = minutesBetween(new Date(), appt.startsAt) / 60;
    if (hoursLeft < settings.cancellationCutoffHours) {
      throw new AppError(409, 'CANCELLATION_WINDOW_CLOSED', `Online cancellation closes ${settings.cancellationCutoffHours} hour(s) before the appointment. Please call the clinic.`);
    }
  } else if (!reason || reason.length < 3) {
    throw new AppError(400, 'VALIDATION_ERROR', 'A reason is required.', { reason: 'Please give a short reason' });
  }

  await prisma.$transaction((tx) =>
    transitionAppointment(tx, id, allowed, { status: 'CANCELLED', cancelReason: reason ?? null, cancelledById: actor.id }),
  );
  const when = fmtTime(appt.startsAt, settings.timeZone);
  if (actor.role === 'PATIENT') {
    await notify(appt.doctor.userId, { title: 'Appointment cancelled', message: `${appt.patient.user.fullName} cancelled ${when}.`, type: 'APPOINTMENT', appointmentId: id });
  } else {
    await notify(appt.patient.user.id, {
      title: 'Appointment cancelled',
      message: `Your appointment on ${when} with ${appt.doctor.user.fullName} was cancelled by the clinic. Reason: ${reason}.`,
      type: 'APPOINTMENT',
      appointmentId: id,
    });
    await audit(req ?? { user: actor }, { action: 'APPOINTMENT_CANCELLED_BY_STAFF', entityType: 'Appointment', entityId: id, details: { reference: appt.reference, reason } });
  }
  emitAppointmentChange(appt, 'CANCELLED');
  return getAppointment(id, actor);
}

export async function confirmAppointment({ actor, id }) {
  const appt = await loadForActor(id, actor);
  await prisma.$transaction((tx) => transitionAppointment(tx, id, ['BOOKED'], { status: 'CONFIRMED' }));
  await notify(appt.patient.user.id, { title: 'Appointment confirmed', message: `${appt.doctor.user.fullName} confirmed your appointment ${appt.reference}.`, type: 'APPOINTMENT', appointmentId: id });
  emitAppointmentChange(appt, 'CONFIRMED');
  return getAppointment(id, actor);
}

export async function rescheduleAppointment({ actor, id, startsAt }) {
  const appt = await loadForActor(id, actor);
  const settings = await getSettings();
  if (!['BOOKED', 'CONFIRMED'].includes(appt.status)) {
    throw new AppError(409, 'INVALID_STATE', 'Only appointments that have not started can be rescheduled.');
  }
  if (actor.role === 'PATIENT') {
    if (minutesBetween(new Date(), appt.startsAt) / 60 < settings.cancellationCutoffHours) {
      throw new AppError(409, 'RESCHEDULE_WINDOW_CLOSED', `Rescheduling closes ${settings.cancellationCutoffHours} hour(s) before the appointment.`);
    }
    if (appt.rescheduleCount >= settings.maxReschedules) {
      throw new AppError(409, 'RESCHEDULE_LIMIT', `An appointment can be rescheduled at most ${settings.maxReschedules} times. Please cancel and book again.`);
    }
  }
  const start = new Date(startsAt);
  if (start.getTime() === appt.startsAt.getTime()) throw new AppError(400, 'SAME_SLOT', 'Choose a different time.');

  // Take the new slot and release the old one in ONE transaction: no gap, no double hold.
  const updated = await withRetry(() =>
    prisma.$transaction(async (tx) => {
      const day = toClinicParts(start, settings.timeZone).date;
      const slots = await getAvailableSlots(appt.doctorId, day, { client: tx, settings });
      if (slots.closed && slots.reason) throw closedDayErrors(settings)[slots.reason];
      const slot = slots.slots.find((s) => s.startsAt.getTime() === start.getTime());
      if (!slot) throw new AppError(400, 'INVALID_SLOT', 'That is not a valid appointment time for this doctor.');
      if (!slot.available) {
        if (slot.reason === 'PAST') throw new AppError(400, 'SLOT_IN_PAST', 'You cannot book a time in the past.');
        throw new AppError(409, 'SLOT_TAKEN', 'This time slot has just been booked. Please choose another one.');
      }
      const appointmentDate = dbDate(day);
      const dup = await tx.appointment.findFirst({
        where: { patientId: appt.patientId, doctorId: appt.doctorId, appointmentDate, status: { notIn: ['CANCELLED', 'NO_SHOW', 'COMPLETED'] }, NOT: { id } },
        select: { id: true },
      });
      if (dup) throw new AppError(409, 'DUPLICATE_BOOKING', 'There is already an appointment with this doctor on that day.');

      await tx.queueEntry.deleteMany({ where: { appointmentId: id } });
      const agg = await tx.queueEntry.aggregate({ where: { doctorId: appt.doctorId, queueDate: appointmentDate }, _max: { queueNumber: true } });
      await transitionAppointment(tx, id, ['BOOKED', 'CONFIRMED'], {
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        appointmentDate,
        status: 'BOOKED',
        rescheduleCount: { increment: 1 },
      });
      await tx.queueEntry.create({
        data: { appointmentId: id, doctorId: appt.doctorId, queueDate: appointmentDate, queueNumber: (agg._max.queueNumber ?? 0) + 1, sortKey: slot.startsAt },
      });
      return tx.appointment.findUnique({ where: { id }, include: appointmentInclude });
    }, SERIALIZABLE),
  );
  const when = fmtTime(updated.startsAt, settings.timeZone);
  await notify(updated.patient.user.id, {
    title: 'Appointment rescheduled',
    message: `Your appointment with ${updated.doctor.user.fullName} is now ${when}. New queue number ${updated.queueEntry.queueNumber}.`,
    type: 'APPOINTMENT',
    appointmentId: id,
  });
  await notify(updated.doctor.userId, { title: 'Appointment rescheduled', message: `${updated.patient.user.fullName} moved to ${when}.`, type: 'APPOINTMENT', appointmentId: id });
  emitAppointmentChange(updated);
  emitQueueUpdated(appt.doctorId);
  return toAppointmentDTO(updated, actor.role);
}
