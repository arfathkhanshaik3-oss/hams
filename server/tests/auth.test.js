import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PASSWORD, anonymous, createWorld, login, prisma } from './helpers.js';

let w;
beforeAll(async () => { w = await createWorld(); });
afterAll(() => prisma.$disconnect());

const validBody = { fullName: 'New Patient', email: 'new.patient@test.dev', password: 'Secret123', phone: '+91 98765 43210' };

describe('registration', () => {
  it('creates a PATIENT, sets an httpOnly cookie and never returns the password hash', async () => {
    const res = await anonymous().post('/api/auth/register').send(validBody);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: validBody.email, role: 'PATIENT' });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|Secret123/);
    expect(res.headers['set-cookie'].join(';')).toMatch(/HttpOnly/i);
    const profile = await prisma.patientProfile.findFirst({ where: { user: { email: validBody.email } } });
    expect(profile).not.toBeNull();
  });

  it('ignores a "role" sent by the browser (no privilege escalation)', async () => {
    const res = await anonymous().post('/api/auth/register').send({ ...validBody, email: 'sneaky@test.dev', role: 'ADMIN' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('PATIENT');
    const row = await prisma.user.findUnique({ where: { email: 'sneaky@test.dev' } });
    expect(row.role).toBe('PATIENT');
  });

  it('stores a bcrypt hash, not the password', async () => {
    const row = await prisma.user.findUnique({ where: { email: validBody.email } });
    expect(row.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(row.passwordHash).not.toContain('Secret123');
  });

  it('rejects a duplicate email with 409', async () => {
    const res = await anonymous().post('/api/auth/register').send(validBody);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects invalid input with field-level messages', async () => {
    const res = await anonymous().post('/api/auth/register').send({ fullName: 'A', email: 'not-an-email', password: 'short', phone: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(res.body.error.details)).toEqual(expect.arrayContaining(['fullName', 'email', 'password', 'phone']));
  });
});

describe('login / session', () => {
  it('logs in with correct credentials', async () => {
    const res = await anonymous().post('/api/auth/login').send({ email: 'pata@test.dev', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('PATIENT');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    const wrong = await anonymous().post('/api/auth/login').send({ email: 'pata@test.dev', password: 'WrongPass1' });
    const unknown = await anonymous().post('/api/auth/login').send({ email: 'nobody@test.dev', password: 'WrongPass1' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('blocks deactivated accounts, and kills their existing session immediately', async () => {
    const agent = await login('patb@test.dev');
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    await prisma.user.update({ where: { email: 'patb@test.dev' }, data: { isActive: false } });
    expect((await agent.get('/api/auth/me')).status).toBe(401);
    const res = await anonymous().post('/api/auth/login').send({ email: 'patb@test.dev', password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
    await prisma.user.update({ where: { email: 'patb@test.dev' }, data: { isActive: true } });
  });

  it('/auth/me needs a login, and logout ends the session', async () => {
    expect((await anonymous().get('/api/auth/me')).status).toBe(401);
    const agent = await login('pata@test.dev');
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.patient).toBeDefined();
    await agent.post('/api/auth/logout').expect(200);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('rejects a tampered token', async () => {
    const res = await anonymous().get('/api/auth/me').set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });
});

describe('password change', () => {
  it('needs the current password, then the new one works and the old one stops', async () => {
    const agent = await login('pata@test.dev');
    const bad = await agent.post('/api/profile/change-password').send({ currentPassword: 'Nope12345', newPassword: 'Brand-new-1' });
    expect(bad.status).toBe(400);
    const ok = await agent.post('/api/profile/change-password').send({ currentPassword: PASSWORD, newPassword: 'Brand-new-1' });
    expect(ok.status).toBe(200);
    expect((await anonymous().post('/api/auth/login').send({ email: 'pata@test.dev', password: PASSWORD })).status).toBe(401);
    expect((await anonymous().post('/api/auth/login').send({ email: 'pata@test.dev', password: 'Brand-new-1' })).status).toBe(200);
    await prisma.user.update({ where: { email: 'pata@test.dev' }, data: { passwordHash: (await prisma.user.findUnique({ where: { email: 'patb@test.dev' } })).passwordHash } });
  });
});
