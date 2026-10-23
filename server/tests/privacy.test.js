import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonymous, bookBody, createWorld, dayPlus, login, prisma } from './helpers.js';

let w;
let patA;
let patB;
let doctorA;
let doctorB;
let reception;
let apptOfA;

beforeAll(async () => {
  w = await createWorld();
  patA = await login('pata@test.dev');
  patB = await login('patb@test.dev');
  doctorA = await login('doca@test.dev');
  doctorB = await login('docb@test.dev');
  reception = await login('reception@test.dev');
  const res = await patA.post('/api/appointments').send(bookBody(w.docA, dayPlus(2), '10:00', { reasonForVisit: 'Private reason' }));
  apptOfA = res.body.appointment;
  await patB.post('/api/appointments').send(bookBody(w.docA, dayPlus(2), '10:15')).expect(201);
});
afterAll(() => prisma.$disconnect());

describe("patients cannot see each other's data", () => {
  it("another patient gets 404 (existence is not revealed) for appointment details and queue status", async () => {
    expect((await patB.get(`/api/appointments/${apptOfA.id}`)).status).toBe(404);
    expect((await patB.get(`/api/queue/my-status/${apptOfA.id}`)).status).toBe(404);
  });

  it('lists only their own appointments', async () => {
    const mine = await patA.get('/api/appointments');
    expect(mine.body.items.every((a) => a.patient.id === w.patA.profileId)).toBe(true);
    expect(mine.body.items.map((a) => a.id)).toContain(apptOfA.id);
  });

  it("only sees their own notifications and cannot mark someone else's as read", async () => {
    const theirs = await patB.get('/api/notifications');
    expect(theirs.body.items.every((n) => n.userId === w.patB.id)).toBe(true);
    const aNote = (await patA.get('/api/notifications')).body.items[0];
    expect((await patB.patch(`/api/notifications/${aNote.id}/read`)).status).toBe(404);
  });

  it('the queue shown to a patient contains no other patient names', async () => {
    const res = await patA.get(`/api/queue/my-status/${apptOfA.id}`);
    expect(JSON.stringify(res.body)).not.toContain('Pat Bravo');
  });

  it("cannot read another patient's profile via the API (profile is always 'me')", async () => {
    const res = await patB.get('/api/profile');
    expect(res.body.user.email).toBe('patb@test.dev');
  });
});

describe('doctors and staff see only what they need', () => {
  it("a doctor sees only their own patients' appointments", async () => {
    expect((await doctorB.get(`/api/appointments/${apptOfA.id}`)).status).toBe(404);
    expect((await doctorB.get('/api/appointments')).body.items).toHaveLength(0);
    expect((await doctorA.get('/api/appointments')).body.items).toHaveLength(2);
  });

  it('the doctor view contains consultation details but no email or address', async () => {
    const res = await doctorA.get(`/api/appointments/${apptOfA.id}`);
    expect(res.status).toBe(200);
    expect(res.body.appointment.reasonForVisit).toBe('Private reason');
    expect(res.body.appointment.patient).not.toHaveProperty('email');
    expect(res.body.appointment.patient).not.toHaveProperty('address');
  });

  it('staff can look patients up, and no password data ever appears', async () => {
    const res = await reception.get('/api/patients').query({ search: 'alpha' });
    expect(res.body.items.map((p) => p.fullName)).toContain('Pat Alpha');
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
    const admin = await login('admin@test.dev');
    expect(JSON.stringify((await admin.get('/api/admin/users')).body)).not.toMatch(/passwordHash/);
  });

  it('audit logs never contain medical details such as the reason for visit', async () => {
    const admin = await login('admin@test.dev');
    expect(JSON.stringify((await admin.get('/api/admin/audit-logs')).body)).not.toContain('Private reason');
  });
});

describe('errors and malformed input', () => {
  it('returns JSON errors in one consistent shape, without stack traces', async () => {
    const res = await anonymous().get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND' });
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js:\d+/);
  });

  it('rejects invalid JSON and invalid ids', async () => {
    const bad = await anonymous().post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('BAD_JSON');
    expect((await patA.get('/api/appointments/not-a-uuid')).status).toBe(400);
    expect((await patA.get('/api/appointments/33333333-3333-4333-8333-333333333333')).status).toBe(404);
  });

  it('does not leak SQL errors for hostile input (SQL injection attempt is treated as text)', async () => {
    const res = await anonymous().get('/api/doctors').query({ search: "'; DROP TABLE \"User\"; --" });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
    expect(await prisma.user.count()).toBeGreaterThan(0);
  });

  it('strips markup characters from free text', async () => {
    const res = await patA.patch('/api/profile').send({ address: '<script>alert(1)</script> 12 Main Road' });
    expect(res.status).toBe(200);
    expect(res.body.user.patient.address).not.toMatch(/[<>]/);
  });

  it('sets security headers', async () => {
    const res = await anonymous().get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
