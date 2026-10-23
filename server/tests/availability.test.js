import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonymous, bookBody, createWorld, dayPlus, login, prisma, setSettings } from './helpers.js';

let w;
let patient;
let doctor;
let admin;

beforeAll(async () => {
  w = await createWorld();
  patient = await login('pata@test.dev');
  doctor = await login('doca@test.dev');
  admin = await login('admin@test.dev');
});
afterAll(() => prisma.$disconnect());

const slots = (agent, id, date) => agent.get(`/api/doctors/${id}/slots`).query({ date });

describe('doctor availability (slots)', () => {
  it('requires a login', async () => {
    expect((await anonymous().get(`/api/doctors/${w.docA.profileId}/slots`).query({ date: dayPlus(1) })).status).toBe(401);
  });

  it('returns a 15-minute grid for a working day', async () => {
    const res = await slots(patient, w.docA.profileId, dayPlus(2));
    expect(res.status).toBe(200);
    expect(res.body.closed).toBe(false);
    expect(res.body.slots.length).toBeGreaterThan(50);
    expect(res.body.slots.every((s) => s.available)).toBe(true);
    expect(res.body.slots.every((s) => Number(s.time.slice(3)) % 15 === 0)).toBe(true);
  });

  it('marks a booked slot as unavailable', async () => {
    const date = dayPlus(2);
    await patient.post('/api/appointments').send(bookBody(w.docA, date, '10:00')).expect(201);
    const res = await slots(patient, w.docA.profileId, date);
    const slot = res.body.slots.find((s) => s.time === '10:00');
    expect(slot).toMatchObject({ available: false, reason: 'BOOKED' });
    expect(res.body.slots.find((s) => s.time === '10:15').available).toBe(true);
  });

  it('rejects past dates and dates too far ahead', async () => {
    expect((await slots(patient, w.docA.profileId, dayPlus(-1))).body).toMatchObject({ closed: true, reason: 'PAST_DATE' });
    expect((await slots(patient, w.docA.profileId, dayPlus(400))).body).toMatchObject({ closed: true, reason: 'TOO_FAR' });
  });

  it('validates the date format and doctor id', async () => {
    expect((await slots(patient, w.docA.profileId, '17-10-2026')).status).toBe(400);
    expect((await slots(patient, 'not-a-uuid', dayPlus(1))).status).toBe(400);
    expect((await slots(patient, '22222222-2222-4222-8222-222222222222', dayPlus(1))).status).toBe(404);
  });

  it('shows nothing when the clinic is closed that weekday', async () => {
    const date = dayPlus(3);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    await setSettings({ closedWeekdays: [weekday] });
    const res = await slots(patient, w.docA.profileId, date);
    expect(res.body).toMatchObject({ closed: true, reason: 'CLINIC_CLOSED' });
    const booking = await patient.post('/api/appointments').send(bookBody(w.docA, date, '10:00'));
    expect(booking.status).toBe(409);
    expect(booking.body.error.code).toBe('CLINIC_CLOSED');
    await setSettings({ closedWeekdays: [] });
  });

  it('is clipped to the clinic opening hours', async () => {
    await setSettings({ opensAt: '09:00', closesAt: '12:00' });
    const res = await slots(patient, w.docA.profileId, dayPlus(4));
    const times = res.body.slots.map((s) => s.time);
    expect(times[0]).toBe('09:00');
    expect(times[times.length - 1]).toBe('11:45');
    const outside = await patient.post('/api/appointments').send(bookBody(w.docA, dayPlus(4), '13:00'));
    expect(outside.status).toBe(400);
    expect(outside.body.error.code).toBe('INVALID_SLOT');
    await setSettings({ opensAt: '00:00', closesAt: '23:59' });
  });

  it('removes a day when the doctor is on leave, and bookings are refused', async () => {
    const date = dayPlus(6);
    const leave = await doctor.post(`/api/doctors/${w.docA.profileId}/leaves`).send({ startDate: date, endDate: date, reason: 'Conference' });
    expect(leave.status).toBe(201);
    expect((await slots(patient, w.docA.profileId, date)).body).toMatchObject({ closed: true, reason: 'DOCTOR_ON_LEAVE' });
    const booking = await patient.post('/api/appointments').send(bookBody(w.docA, date, '10:00'));
    expect(booking.status).toBe(409);
    expect(booking.body.error.code).toBe('DOCTOR_ON_LEAVE');
    await doctor.delete(`/api/doctors/${w.docA.profileId}/leaves/${leave.body.leave.id}`).expect(200);
    expect((await slots(patient, w.docA.profileId, date)).body.closed).toBe(false);
  });

  it('refuses leave that would hide existing appointments unless they are cancelled (patients are notified)', async () => {
    const date = dayPlus(7);
    const appt = await patient.post('/api/appointments').send(bookBody(w.docA, date, '11:00'));
    expect(appt.status).toBe(201);
    const refused = await doctor.post(`/api/doctors/${w.docA.profileId}/leaves`).send({ startDate: date, endDate: date });
    expect(refused.status).toBe(409);
    const forced = await doctor.post(`/api/doctors/${w.docA.profileId}/leaves`).send({ startDate: date, endDate: date, cancelAppointments: true });
    expect(forced.status).toBe(201);
    expect(forced.body.leave.cancelledAppointments).toBe(1);
    const mine = await patient.get(`/api/appointments/${appt.body.appointment.id}`);
    expect(mine.body.appointment.status).toBe('CANCELLED');
  });
});

describe('schedule management', () => {
  it('rejects sessions outside clinic hours, overlapping sessions and bad times', async () => {
    await setSettings({ opensAt: '08:00', closesAt: '20:00' });
    const put = (sessions) => doctor.put(`/api/doctors/${w.docA.profileId}/schedule`).send({ sessions });
    expect((await put([{ weekday: 1, startTime: '06:00', endTime: '12:00', slotMinutes: 15 }])).body.error.code).toBe('OUTSIDE_CLINIC_HOURS');
    expect((await put([{ weekday: 1, startTime: '09:00', endTime: '12:00', slotMinutes: 15 }, { weekday: 1, startTime: '11:00', endTime: '13:00', slotMinutes: 15 }])).body.error.code).toBe('OVERLAPPING_SESSIONS');
    expect((await put([{ weekday: 1, startTime: '12:00', endTime: '09:00', slotMinutes: 15 }])).body.error.code).toBe('INVALID_SCHEDULE');
    expect((await put([{ weekday: 9, startTime: '09:00', endTime: '12:00', slotMinutes: 15 }])).status).toBe(400);
    const ok = await put([{ weekday: 1, startTime: '09:00', endTime: '12:00', slotMinutes: 30 }]);
    expect(ok.status).toBe(200);
    expect(ok.body.schedule).toHaveLength(1);
    await setSettings({ opensAt: '00:00', closesAt: '23:59' });
  });
});

describe('doctor directory', () => {
  it('searches by name and specialization and filters by availability', async () => {
    const byName = await anonymous().get('/api/doctors').query({ search: 'bravo' });
    expect(byName.body.items.map((d) => d.fullName)).toEqual(['Dr. Bravo']);
    const bySpec = await anonymous().get('/api/doctors').query({ search: 'cardio' });
    expect(bySpec.body.items).toHaveLength(1);
    const spec = await anonymous().get('/api/doctors').query({ specializationId: w.spec.id });
    expect(spec.body.items.map((d) => d.fullName)).toEqual(['Dr. Alpha']);
    const avail = await anonymous().get('/api/doctors').query({ availableOn: dayPlus(2) });
    expect(avail.body.items.length).toBeGreaterThan(0);
    expect(typeof avail.body.items[0].freeSlots).toBe('number');
  });

  it('hides deactivated doctors from the public but not from admins', async () => {
    await admin.patch(`/api/doctors/${w.docB.profileId}/status`).send({ isActive: false }).expect(200);
    expect((await anonymous().get('/api/doctors')).body.items.map((d) => d.fullName)).not.toContain('Dr. Bravo');
    expect((await anonymous().get(`/api/doctors/${w.docB.profileId}`)).status).toBe(404);
    expect((await admin.get('/api/admin/doctors').query({ status: 'inactive' })).body.items).toHaveLength(1);
    const booking = await patient.post('/api/appointments').send(bookBody(w.docB, dayPlus(2), '10:00'));
    expect(booking.status).toBe(404);
    await admin.patch(`/api/doctors/${w.docB.profileId}/status`).send({ isActive: true }).expect(200);
  });
});
