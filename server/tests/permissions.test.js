import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonymous, createWorld, login, prisma } from './helpers.js';

let w;
let agents;
const FAKE_ID = '11111111-1111-4111-8111-111111111111';

beforeAll(async () => {
  w = await createWorld();
  agents = {
    patient: await login('pata@test.dev'),
    doctor: await login('doca@test.dev'),
    reception: await login('reception@test.dev'),
    admin: await login('admin@test.dev'),
  };
});
afterAll(() => prisma.$disconnect());

describe('anonymous visitors', () => {
  it.each(['/api/appointments', '/api/profile', '/api/notifications', '/api/dashboard/patient', '/api/admin/users', '/api/queue/overview'])('GET %s -> 401', async (path) => {
    expect((await anonymous().get(path)).status).toBe(401);
  });

  it('can read the public directory, specializations and public settings', async () => {
    expect((await anonymous().get('/api/doctors')).status).toBe(200);
    expect((await anonymous().get('/api/specializations')).status).toBe(200);
    const s = await anonymous().get('/api/settings/public');
    expect(s.status).toBe(200);
    expect(s.body.settings).not.toHaveProperty('noShowAfterMinutes');
  });
});

describe('role enforcement on the server (not just hidden buttons)', () => {
  const cases = [
    ['patient', 'get', '/api/admin/users', 403],
    ['patient', 'get', '/api/admin/audit-logs', 403],
    ['patient', 'put', '/api/admin/settings', 403],
    ['patient', 'get', '/api/reports/trends', 403],
    ['patient', 'get', '/api/queue/overview', 403],
    ['patient', 'post', '/api/queue/walk-in', 403],
    ['patient', 'post', `/api/queue/check-in/${FAKE_ID}`, 403],
    ['patient', 'get', '/api/patients', 403],
    ['patient', 'post', '/api/patients', 403],
    ['patient', 'get', '/api/dashboard/doctor', 403],
    ['doctor', 'get', '/api/admin/users', 403],
    ['doctor', 'post', '/api/appointments', 403],
    ['doctor', 'post', `/api/queue/check-in/${FAKE_ID}`, 403],
    ['doctor', 'post', `/api/queue/${FAKE_ID}/reorder`, 403],
    ['doctor', 'get', '/api/dashboard/patient', 403],
    ['reception', 'get', '/api/admin/users', 403],
    ['reception', 'post', '/api/queue/doctor/me/call-next', 403],
    ['reception', 'patch', `/api/appointments/${FAKE_ID}/status`, 403],
    ['reception', 'post', '/api/doctors', 403],
    ['reception', 'get', '/api/reports/workload', 403],
    ['admin', 'post', '/api/appointments', 403],
    ['admin', 'post', `/api/queue/check-in/${FAKE_ID}`, 403],
    ['admin', 'post', '/api/queue/walk-in', 403],
  ];
  it.each(cases)('%s %s %s -> %i', async (role, method, path, expected) => {
    const res = await agents[role][method](path).send({});
    expect(res.status).toBe(expected);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows each role the things it should be able to do', async () => {
    expect((await agents.admin.get('/api/admin/users')).status).toBe(200);
    expect((await agents.admin.get('/api/reports/trends')).status).toBe(200);
    expect((await agents.reception.get('/api/queue/overview')).status).toBe(200);
    expect((await agents.reception.get('/api/patients')).status).toBe(200);
    expect((await agents.doctor.get('/api/queue/doctor/me')).status).toBe(200);
    expect((await agents.patient.get('/api/dashboard/patient')).status).toBe(200);
  });

  it('a doctor can edit only their OWN schedule (an admin can edit any)', async () => {
    const sessions = [{ weekday: 1, startTime: '09:00', endTime: '12:00', slotMinutes: 20 }];
    const other = await agents.doctor.put(`/api/doctors/${w.docB.profileId}/schedule`).send({ sessions });
    expect(other.status).toBe(403);
    const own = await agents.doctor.put(`/api/doctors/${w.docA.profileId}/schedule`).send({ sessions });
    expect(own.status).toBe(200);
    const asAdmin = await agents.admin.put(`/api/doctors/${w.docB.profileId}/schedule`).send({ sessions });
    expect(asAdmin.status).toBe(200);
  });

  it("a doctor cannot open another doctor's queue", async () => {
    expect((await agents.doctor.get(`/api/queue/doctor/${w.docB.profileId}`)).status).toBe(403);
    expect((await agents.doctor.get(`/api/queue/doctor/${w.docA.profileId}`)).status).toBe(200);
  });

  it('only an admin can create users, and not doctors through that endpoint', async () => {
    const body = { fullName: 'New Staff', email: 'staff@test.dev', password: 'Secret123', role: 'RECEPTIONIST' };
    expect((await agents.patient.post('/api/admin/users').send(body)).status).toBe(403);
    expect((await agents.admin.post('/api/admin/users').send(body)).status).toBe(201);
    const doctorAttempt = await agents.admin.post('/api/admin/users').send({ ...body, email: 'x@test.dev', role: 'DOCTOR' });
    expect(doctorAttempt.status).toBe(400);
  });

  it('writes an audit log entry for admin actions', async () => {
    const res = await agents.admin.get('/api/admin/audit-logs');
    expect(res.status).toBe(200);
    expect(res.body.items.some((l) => l.action === 'USER_CREATED')).toBe(true);
  });

  it('the last active admin cannot be deactivated, and admins cannot deactivate themselves', async () => {
    const res = await agents.admin.patch(`/api/admin/users/${w.admin.id}/status`).send({ isActive: false });
    expect(res.status).toBe(409);
  });
});
