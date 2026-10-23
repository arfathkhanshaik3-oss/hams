import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TZ, anonymous, createWorld, extraPatients, insertTodayAppointment, login, prisma } from './helpers.js';
import { toClinicParts } from '../src/utils/time.js';

let w;
let pats;
let doctor;
let doctorB;
let reception;
let patientAgent;

const queue = async () => (await doctor.get('/api/queue/doctor/me')).body;
// The "late arrival" tests need slots that are already in the past (slots start at 00:30 today)
const tooEarlyForLateTests = toClinicParts(new Date(), TZ).time < '01:30';

beforeAll(async () => {
  w = await createWorld();
  pats = await extraPatients(5, 'qp');
  doctor = await login('doca@test.dev');
  doctorB = await login('docb@test.dev');
  reception = await login('reception@test.dev');
  patientAgent = await login('pata@test.dev');
});
afterAll(() => prisma.$disconnect());

describe('check-in and the consultation flow', () => {
  let appt;
  let entryId;

  it('receptionist checks a patient in', async () => {
    appt = await insertTodayAppointment({ doctor: w.docA, patient: w.patA, index: 0 });
    entryId = appt.queueEntry.id;
    const res = await reception.post(`/api/queue/check-in/${appt.id}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CHECKED_IN');
    expect((await prisma.queueEntry.findUnique({ where: { id: entryId } })).checkedInAt).not.toBeNull();
  });

  it('refuses a duplicate check-in', async () => {
    const res = await reception.post(`/api/queue/check-in/${appt.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_CHECKED_IN');
  });

  it('the patient sees position, "now serving" and an ESTIMATED wait', async () => {
    const res = await patientAgent.get(`/api/queue/my-status/${appt.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ appointmentStatus: 'CHECKED_IN', position: 1, isEstimate: true, live: true });
    expect(res.body.estimateNote).toMatch(/estimate/i);
    expect(res.body.estimatedWaitMinutes).toBe(0);
  });

  it("the doctor calls the next patient and the status moves to CALLED", async () => {
    const res = await doctor.post('/api/queue/doctor/me/call-next');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'CALLED', appointmentId: appt.id });
    const q = await queue();
    expect(q.doctorStatus).toBe('CALLING');
    expect(q.current.appointmentId).toBe(appt.id);
    const status = await patientAgent.get(`/api/queue/my-status/${appt.id}`);
    expect(status.body.appointmentStatus).toBe('CALLED');
    expect(status.body.nowServing).toBe(1);
    const note = await patientAgent.get('/api/notifications');
    expect(note.body.items.some((n) => n.title === "It's your turn")).toBe(true);
  });

  it('cannot call another patient while one is called or in consultation', async () => {
    const res = await doctor.post('/api/queue/doctor/me/call-next');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONSULTATION_IN_PROGRESS');
  });

  it('start -> complete records real timestamps', async () => {
    expect((await doctor.post(`/api/queue/${entryId}/start`)).body.status).toBe('IN_CONSULTATION');
    expect((await queue()).doctorStatus).toBe('IN_CONSULTATION');
    expect((await doctor.post(`/api/queue/${entryId}/complete`)).body.status).toBe('COMPLETED');
    const row = await prisma.queueEntry.findUnique({ where: { id: entryId }, include: { appointment: true } });
    expect(row.appointment.status).toBe('COMPLETED');
    expect(row.calledAt).not.toBeNull();
    expect(row.startedAt).not.toBeNull();
    expect(row.completedAt).not.toBeNull();
  });

  it('states cannot be skipped or repeated (invalid transitions return 409)', async () => {
    expect((await doctor.post(`/api/queue/${entryId}/complete`)).status).toBe(409);
    expect((await doctor.post(`/api/queue/${entryId}/start`)).status).toBe(409);
    expect((await doctor.post('/api/queue/doctor/me/call-next')).body.error.code).toBe('QUEUE_EMPTY');
  });
});

describe.skipIf(tooEarlyForLateTests)('calling order, skipping and no-shows', () => {
  let a1;
  let a2;
  let a3;

  it('calls patients in check-in order (late arrivals lose their slot priority)', async () => {
    [a1, a2, a3] = [
      await insertTodayAppointment({ doctor: w.docA, patient: pats[0], index: 1 }),
      await insertTodayAppointment({ doctor: w.docA, patient: pats[1], index: 2 }),
      await insertTodayAppointment({ doctor: w.docA, patient: pats[2], index: 3 }),
    ];
    // arrival order: a2, a1, a3 (the slots are long past, so everyone is "late")
    for (const a of [a2, a1, a3]) {
      expect((await reception.post(`/api/queue/check-in/${a.id}`)).status).toBe(200);
      await new Promise((r) => setTimeout(r, 15));
    }
    expect((await prisma.queueEntry.findUnique({ where: { id: a1.queueEntry.id } })).isLate).toBe(true);
    const order = (await queue()).waiting.map((x) => x.appointmentId);
    expect(order).toEqual([a2.id, a1.id, a3.id]);
    const first = await doctor.post('/api/queue/doctor/me/call-next');
    expect(first.body.appointmentId).toBe(a2.id);
  });

  it('skipping needs a reason; the first skip sends the patient to the back of the line', async () => {
    const e = a2.queueEntry.id;
    expect((await doctor.post(`/api/queue/${e}/skip`).send({})).status).toBe(400);
    const res = await doctor.post(`/api/queue/${e}/skip`).send({ reason: 'Not at the door' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'WAITING', skipCount: 1 });
    const order = (await queue()).waiting.map((x) => x.appointmentId);
    expect(order).toEqual([a1.id, a3.id, a2.id]);
  });

  it('the second skip marks the patient as NO_SHOW', async () => {
    const next = await doctor.post('/api/queue/doctor/me/call-next');
    expect(next.body.appointmentId).toBe(a1.id);
    await doctor.post(`/api/queue/${a1.queueEntry.id}/start`).expect(200);
    await doctor.post(`/api/queue/${a1.queueEntry.id}/complete`).expect(200);
    await doctor.post('/api/queue/doctor/me/call-next').expect(200); // a3
    await doctor.post(`/api/queue/${a3.queueEntry.id}/skip`).send({ reason: 'Left the clinic' }).expect(200);
    const call = await doctor.post('/api/queue/doctor/me/call-next'); // a2 (skipped once earlier)
    expect(call.body.appointmentId).toBe(a2.id);
    const second = await doctor.post(`/api/queue/${a2.queueEntry.id}/skip`).send({ reason: 'No response' });
    expect(second.body).toMatchObject({ status: 'NO_SHOW', skipCount: 2 });
    const noShowNote = await prisma.notification.findFirst({ where: { appointmentId: a2.id, title: 'Marked as no-show' } });
    expect(noShowNote).not.toBeNull();
  });

  it('the receptionist can mark a no-show manually (with a reason); the audit log records it', async () => {
    const b = await insertTodayAppointment({ doctor: w.docA, patient: pats[3], index: 9 });
    expect((await reception.post(`/api/queue/${b.queueEntry.id}/no-show`).send({})).status).toBe(400);
    const res = await reception.post(`/api/queue/${b.queueEntry.id}/no-show`).send({ reason: 'Did not arrive' });
    expect(res.body.status).toBe('NO_SHOW');
    const log = await prisma.auditLog.findFirst({ where: { action: 'QUEUE_MARKED_NO_SHOW' } });
    expect(log.details.reason).toBe('Did not arrive');
  });

  it("another doctor cannot act on this doctor's queue entries", async () => {
    const c = await insertTodayAppointment({ doctor: w.docA, patient: pats[4], index: 10 });
    await reception.post(`/api/queue/check-in/${c.id}`).expect(200);
    expect((await doctorB.post(`/api/queue/${c.queueEntry.id}/skip`).send({ reason: 'trying' })).status).toBe(404);
    expect((await doctorB.post(`/api/queue/${c.queueEntry.id}/start`)).status).toBe(404);
    expect((await doctorB.post('/api/queue/doctor/me/call-next')).body.error.code).toBe('QUEUE_EMPTY');
  });
});

describe('reordering (receptionist only, reason recorded)', () => {
  it('moves a waiting patient to a new position', async () => {
    // earlier tests left a few patients waiting; add two more
    const d = await insertTodayAppointment({ doctor: w.docA, patient: w.patB, index: 12 });
    const e = await insertTodayAppointment({ doctor: w.docA, patient: pats[0], index: 13 }).catch(() => null);
    await reception.post(`/api/queue/check-in/${d.id}`).expect(200);
    if (e) await reception.post(`/api/queue/check-in/${e.id}`).expect(200);
    const before = (await queue()).waiting.map((x) => x.appointmentId);
    expect(before.length).toBeGreaterThanOrEqual(2);
    const last = before[before.length - 1];
    const lastEntry = (await queue()).waiting.find((x) => x.appointmentId === last).entryId;

    expect((await reception.post(`/api/queue/${lastEntry}/reorder`).send({ position: 1 })).status).toBe(400); // reason missing
    expect((await doctor.post(`/api/queue/${lastEntry}/reorder`).send({ position: 1, reason: 'urgent' })).status).toBe(403);
    expect((await patientAgent.post(`/api/queue/${lastEntry}/reorder`).send({ position: 1, reason: 'urgent' })).status).toBe(403);
    const res = await reception.post(`/api/queue/${lastEntry}/reorder`).send({ position: 1, reason: 'Patient is elderly and unwell' });
    expect(res.status).toBe(200);
    const after = (await queue()).waiting.map((x) => x.appointmentId);
    expect(after[0]).toBe(last);
    expect(after).toHaveLength(before.length);
    const log = await prisma.auditLog.findFirst({ where: { action: 'QUEUE_REORDERED' } });
    expect(log.details).toMatchObject({ to: 1, reason: 'Patient is elderly and unwell' });
  });
});

describe('walk-ins', () => {
  let walkInPatient;

  it('registers a walk-in patient (duplicates are detected)', async () => {
    const body = { fullName: 'Walk In Person', phone: '+91 98000 12345' };
    const res = await reception.post('/api/patients').send(body);
    expect(res.status).toBe(201);
    walkInPatient = res.body.patient;
    expect(walkInPatient.email).toBeNull();
    const dup = await reception.post('/api/patients').send(body);
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('DUPLICATE_PATIENT');
  });

  it('puts the walk-in straight into the queue', async () => {
    const res = await reception.post('/api/queue/walk-in').send({ patientId: walkInPatient.id, doctorId: w.docB.profileId, reasonForVisit: 'Walk-in visit' });
    expect(res.status).toBe(201);
    expect(res.body.appointment).toMatchObject({ type: 'WALK_IN', status: 'CHECKED_IN' });
    expect(res.body.appointment.queue.queueNumber).toBeGreaterThan(0);
    const q = (await doctorB.get('/api/queue/doctor/me')).body;
    expect(q.waiting.map((x) => x.patient.fullName)).toContain('Walk In Person');
  });

  it('avoids a duplicate active queue entry for the same patient and doctor', async () => {
    const res = await reception.post('/api/queue/walk-in').send({ patientId: walkInPatient.id, doctorId: w.docB.profileId });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_BOOKING');
  });

  it('a walk-in account cannot be logged in to (random password, placeholder email)', async () => {
    const row = await prisma.user.findFirst({ where: { patientProfile: { id: walkInPatient.id } } });
    expect(row.email.endsWith('@walkin.local')).toBe(true);
    const res = await anonymous().post('/api/auth/login').send({ email: row.email, password: 'Password123' });
    expect(res.status).toBe(401);
  });
});

describe('cancelling in the queue', () => {
  it('patients cannot cancel once checked in; the receptionist can, with a reason', async () => {
    const x = await insertTodayAppointment({ doctor: w.docB, patient: w.patA, index: 20 });
    await reception.post(`/api/queue/check-in/${x.id}`).expect(200);
    const asPatient = await patientAgent.post(`/api/appointments/${x.id}/cancel`).send({});
    expect(asPatient.status).toBe(409);
    const staff = await reception.post(`/api/appointments/${x.id}/cancel`).send({ reason: 'Patient left' });
    expect(staff.status).toBe(200);
    const q = (await doctorB.get('/api/queue/doctor/me')).body;
    expect(q.finished.some((f) => f.appointmentId === x.id && f.status === 'CANCELLED')).toBe(true);
  });
});

describe('estimated waiting time', () => {
  it('uses the doctor average and is labelled as an estimate', async () => {
    const q = await queue();
    expect(q.estimateNote).toMatch(/not a guaranteed time/i);
    expect(['configured', 'recent_average']).toContain(q.avgSource);
    const waits = q.waiting.map((x) => x.estimatedWaitMinutes);
    expect(waits).toEqual([...waits].sort((p, r) => p - r)); // later in line -> never a shorter wait
    expect(waits[1] - waits[0]).toBe(q.avgConsultationMinutes);
  });
});

describe('the receptionist overview', () => {
  it('summarises every doctor from live data', async () => {
    const res = await reception.get('/api/queue/overview');
    expect(res.status).toBe(200);
    expect(res.body.doctors).toHaveLength(2);
    expect(res.body.doctors.reduce((s, d) => s + d.total, 0)).toBeGreaterThan(5);
  });
});
