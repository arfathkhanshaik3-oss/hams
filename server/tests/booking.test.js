import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookBody, createWorld, dayPlus, extraPatients, login, prisma, setSettings, slotIso } from './helpers.js';

let w;
let patA;
let patB;
let reception;
let others;

beforeAll(async () => {
  w = await createWorld();
  others = await extraPatients(6, 'race');
  patA = await login('pata@test.dev');
  patB = await login('patb@test.dev');
  reception = await login('reception@test.dev');
});
afterAll(() => prisma.$disconnect());

describe('booking an appointment', () => {
  it('saves the appointment with a unique reference and a queue number', async () => {
    const date = dayPlus(2);
    const res = await patA.post('/api/appointments').send(bookBody(w.docA, date, '09:00', { reasonForVisit: 'Routine check-up' }));
    expect(res.status).toBe(201);
    const a = res.body.appointment;
    expect(a.reference).toMatch(/^APT-\d{8}-[A-Z0-9]{4}$/);
    expect(a.status).toBe('BOOKED');
    expect(a.type).toBe('ONLINE');
    expect(a.queue.queueNumber).toBe(1);
    expect(a.doctor.fullName).toBe('Dr. Alpha');
    // second patient, same doctor and day -> next queue number
    const second = await patB.post('/api/appointments').send(bookBody(w.docA, date, '09:15'));
    expect(second.status).toBe(201);
    expect(second.body.appointment.queue.queueNumber).toBe(2);
    expect(second.body.appointment.reference).not.toBe(a.reference);
    const row = await prisma.appointment.findUnique({ where: { id: a.id } });
    expect(row.startsAt.toISOString()).toBe(slotIso(date, '09:00'));
  });

  it('notifies the patient and the doctor', async () => {
    const mine = await patA.get('/api/notifications');
    expect(mine.body.items.some((n) => n.title === 'Appointment booked')).toBe(true);
    const doc = await login('doca@test.dev');
    expect((await doc.get('/api/notifications')).body.items.some((n) => n.title === 'New appointment')).toBe(true);
  });

  it('PREVENTS DOUBLE BOOKING of the same doctor and time slot', async () => {
    const date = dayPlus(2);
    const res = await patB.post('/api/appointments').send(bookBody(w.docA, date, '09:00'));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_TAKEN');
  });

  it('handles CONCURRENT requests for one slot: exactly one wins', async () => {
    const date = dayPlus(3);
    const agents = await Promise.all(others.map((u) => login(u.email)));
    const results = await Promise.all(agents.map((a) => a.post('/api/appointments').send(bookBody(w.docA, date, '14:00'))));
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(agents.length - 1);
    const rows = await prisma.appointment.findMany({ where: { doctorId: w.docA.profileId, startsAt: new Date(slotIso(date, '14:00')) } });
    expect(rows).toHaveLength(1);
    // queue numbers stay unique too
    const entries = await prisma.queueEntry.findMany({ where: { doctorId: w.docA.profileId }, select: { queueDate: true, queueNumber: true } });
    const keys = entries.map((e) => `${e.queueDate.toISOString()}|${e.queueNumber}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps queue numbers unique when many DIFFERENT slots are booked at once', async () => {
    const date = dayPlus(4);
    const agents = await Promise.all(others.map((u) => login(u.email)));
    const times = ['08:00', '08:15', '08:30', '08:45', '09:00', '09:15'];
    const results = await Promise.all(agents.map((a, i) => a.post('/api/appointments').send(bookBody(w.docA, date, times[i]))));
    expect(results.every((r) => r.status === 201)).toBe(true);
    const numbers = results.map((r) => r.body.appointment.queue.queueNumber).sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('refuses a second active appointment with the same doctor on the same day', async () => {
    const res = await patA.post('/api/appointments').send(bookBody(w.docA, dayPlus(2), '16:00'));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_BOOKING');
  });

  it('allows the same patient to book a different doctor the same day', async () => {
    const res = await patA.post('/api/appointments').send(bookBody(w.docB, dayPlus(2), '09:00'));
    expect(res.status).toBe(201);
  });

  it('rejects past times, times off the slot grid and malformed input', async () => {
    const past = await patA.post('/api/appointments').send(bookBody(w.docA, dayPlus(-1), '10:00'));
    expect(past.status).toBe(400);
    expect(past.body.error.code).toBe('SLOT_IN_PAST');
    const offGrid = await patA.post('/api/appointments').send(bookBody(w.docA, dayPlus(5), '10:07'));
    expect(offGrid.status).toBe(400);
    expect(offGrid.body.error.code).toBe('INVALID_SLOT');
    const farAhead = await patA.post('/api/appointments').send(bookBody(w.docA, dayPlus(200), '10:00'));
    expect(farAhead.status).toBe(400);
    expect((await patA.post('/api/appointments').send({})).body.error.code).toBe('VALIDATION_ERROR');
    expect((await patA.post('/api/appointments').send({ doctorId: 'nope', startsAt: 'whenever' })).status).toBe(400);
  });

  it('a patient can only ever book for themselves, even if they send another patientId', async () => {
    const res = await patB.post('/api/appointments').send(bookBody(w.docA, dayPlus(5), '11:00', { patientId: w.patA.profileId }));
    expect(res.status).toBe(201);
    expect(res.body.appointment.patient.id).toBe(w.patB.profileId);
  });

  it('a receptionist can book on behalf of a patient (patientId required)', async () => {
    const date = dayPlus(5);
    const missing = await reception.post('/api/appointments').send(bookBody(w.docA, date, '12:00'));
    expect(missing.status).toBe(400);
    const res = await reception.post('/api/appointments').send(bookBody(w.docA, date, '12:00', { patientId: w.patA.profileId }));
    expect(res.status).toBe(201);
    expect(res.body.appointment.type).toBe('STAFF_BOOKED');
    expect(res.body.appointment.patient.fullName).toBe('Pat Alpha');
  });
});

describe('cancellation', () => {
  let apptId;
  it('cancels, frees the slot, and lets someone else take it', async () => {
    const date = dayPlus(8);
    const booked = await patA.post('/api/appointments').send(bookBody(w.docA, date, '10:00'));
    apptId = booked.body.appointment.id;
    const res = await patA.post(`/api/appointments/${apptId}/cancel`).send({ reason: 'Change of plans' });
    expect(res.status).toBe(200);
    expect(res.body.appointment.status).toBe('CANCELLED');
    const again = await patB.post('/api/appointments').send(bookBody(w.docA, date, '10:00'));
    expect(again.status).toBe(201);
  });

  it('cannot cancel twice', async () => {
    const res = await patA.post(`/api/appointments/${apptId}/cancel`).send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATE');
  });

  it("a patient cannot cancel someone else's appointment", async () => {
    const date = dayPlus(9);
    const booked = await patB.post('/api/appointments').send(bookBody(w.docA, date, '10:00'));
    const res = await patA.post(`/api/appointments/${booked.body.appointment.id}/cancel`).send({});
    expect(res.status).toBe(404);
    const row = await prisma.appointment.findUnique({ where: { id: booked.body.appointment.id } });
    expect(row.status).toBe('BOOKED');
  });

  it('patients cannot cancel inside the cut-off window, but staff can (with a reason)', async () => {
    await setSettings({ cancellationCutoffHours: 24 * 30 }); // everything is now "too late" for patients
    const date = dayPlus(10);
    const booked = await patA.post('/api/appointments').send(bookBody(w.docB, date, '10:00'));
    const id = booked.body.appointment.id;
    const blocked = await patA.post(`/api/appointments/${id}/cancel`).send({});
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('CANCELLATION_WINDOW_CLOSED');
    const noReason = await reception.post(`/api/appointments/${id}/cancel`).send({});
    expect(noReason.status).toBe(400);
    const staff = await reception.post(`/api/appointments/${id}/cancel`).send({ reason: 'Doctor unavailable' });
    expect(staff.status).toBe(200);
    expect(staff.body.appointment.cancelReason).toBe('Doctor unavailable');
    const note = await patA.get('/api/notifications');
    expect(note.body.items.some((n) => n.message.includes('Doctor unavailable'))).toBe(true);
    await setSettings({ cancellationCutoffHours: 2 });
  });
});

describe('rescheduling', () => {
  let id;
  const date = dayPlus(12);

  it('moves the appointment, releases the old slot, and issues a new queue number', async () => {
    const booked = await patA.post('/api/appointments').send(bookBody(w.docB, date, '10:00'));
    id = booked.body.appointment.id;
    const res = await patA.post(`/api/appointments/${id}/reschedule`).send({ startsAt: slotIso(date, '11:00') });
    expect(res.status).toBe(200);
    expect(res.body.appointment.startsAt).toBe(slotIso(date, '11:00'));
    expect(res.body.appointment.rescheduleCount).toBe(1);
    expect(res.body.appointment.status).toBe('BOOKED');
    const taken = await patB.post('/api/appointments').send(bookBody(w.docB, date, '10:00'));
    expect(taken.status).toBe(201); // the old slot is free again
  });

  it('refuses a slot that is already taken, and the same slot', async () => {
    const taken = await patA.post(`/api/appointments/${id}/reschedule`).send({ startsAt: slotIso(date, '10:00') });
    expect(taken.status).toBe(409);
    expect(taken.body.error.code).toBe('SLOT_TAKEN');
    const same = await patA.post(`/api/appointments/${id}/reschedule`).send({ startsAt: slotIso(date, '11:00') });
    expect(same.status).toBe(400);
    const row = await prisma.appointment.findUnique({ where: { id } });
    expect(row.startsAt.toISOString()).toBe(slotIso(date, '11:00')); // unchanged after the failures
  });

  it('enforces the reschedule limit for patients', async () => {
    await setSettings({ maxReschedules: 1 });
    const res = await patA.post(`/api/appointments/${id}/reschedule`).send({ startsAt: slotIso(date, '12:00') });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('RESCHEDULE_LIMIT');
    await setSettings({ maxReschedules: 2 });
  });

  it("a patient cannot reschedule someone else's appointment", async () => {
    const res = await patB.post(`/api/appointments/${id}/reschedule`).send({ startsAt: slotIso(date, '12:30') });
    expect(res.status).toBe(404);
  });
});

describe('listing', () => {
  it('filters by scope and paginates', async () => {
    const res = await patA.get('/api/appointments').query({ scope: 'upcoming', limit: 2, page: 1 });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeLessThanOrEqual(2);
    expect(res.body.meta.total).toBeGreaterThan(2);
    expect(res.body.meta.totalPages).toBeGreaterThan(1);
    expect((await patA.get('/api/appointments').query({ status: 'NOPE' })).status).toBe(400);
  });
});
