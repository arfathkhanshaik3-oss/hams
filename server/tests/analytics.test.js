import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createWorld, insertTodayAppointment, login, makeUser, prisma, resetDb, setSettings } from './helpers.js';

afterAll(() => prisma.$disconnect());

describe('dashboards use real data only', () => {
  it('an empty system returns zeros / nulls, never invented numbers', async () => {
    await resetDb();
    await prisma.clinicSettings.create({ data: { id: 1, opensAt: '00:00', closesAt: '23:59', closedWeekdays: [] } });
    await makeUser({ role: 'ADMIN', email: 'admin@test.dev', fullName: 'Only Admin' });
    const admin = await login('admin@test.dev');
    const res = await admin.get('/api/dashboard/admin');
    expect(res.status).toBe(200);
    expect(res.body.totals).toMatchObject({ patients: 0, activeDoctors: 0, todayAppointments: 0, waitingNow: 0 });
    expect(res.body.avgWaitMinutes30d).toBeNull();
    expect(res.body.workloadToday).toEqual([]);
    const trends = await admin.get('/api/reports/trends');
    expect(trends.body.totals.total).toBe(0);
  });

  describe('with data', () => {
    let w;
    let admin;
    beforeAll(async () => {
      w = await createWorld();
      admin = await login('admin@test.dev');
      const reception = await login('reception@test.dev');
      const doctor = await login('doca@test.dev');
      const a = await insertTodayAppointment({ doctor: w.docA, patient: w.patA, index: 1 });
      const b = await insertTodayAppointment({ doctor: w.docA, patient: w.patB, index: 2 });
      await insertTodayAppointment({ doctor: w.docB, patient: w.patA, index: 3, status: 'CANCELLED' });
      await reception.post(`/api/queue/check-in/${a.id}`).expect(200);
      await reception.post(`/api/queue/check-in/${b.id}`).expect(200);
      await doctor.post('/api/queue/doctor/me/call-next').expect(200);
      await doctor.post(`/api/queue/${a.queueEntry.id}/start`).expect(200);
      await doctor.post(`/api/queue/${a.queueEntry.id}/complete`).expect(200);
    });

    it('admin totals match the database', async () => {
      const res = await admin.get('/api/dashboard/admin');
      expect(res.body.totals).toMatchObject({ patients: 2, activeDoctors: 2, todayAppointments: 3, completedToday: 1, cancelledToday: 1, waitingNow: 1 });
      const docA = res.body.workloadToday.find((d) => d.fullName === 'Dr. Alpha');
      expect(docA).toMatchObject({ total: 2, completed: 1, waiting: 1 });
      expect(res.body.trend.length).toBe(14);
      expect(res.body.avgWaitMinutesToday === null || res.body.avgWaitMinutesToday >= 0).toBe(true);
    });

    it('doctor and receptionist dashboards are scoped correctly', async () => {
      const doctor = await login('doca@test.dev');
      const d = await doctor.get('/api/dashboard/doctor');
      expect(d.body.counts).toMatchObject({ total: 2, completed: 1, waiting: 1 });
      const other = await login('docb@test.dev');
      expect((await other.get('/api/dashboard/doctor')).body.counts).toMatchObject({ total: 1, cancelled: 1 });
      const r = await (await login('reception@test.dev')).get('/api/dashboard/receptionist');
      expect(r.body.totals).toMatchObject({ appointments: 3, completed: 1, cancelled: 1 });
    });

    it('patient dashboard shows only their own counts', async () => {
      const p = await (await login('pata@test.dev')).get('/api/dashboard/patient');
      expect(p.body.counts.completed).toBe(1);
      expect(p.body.counts.cancelled).toBe(1);
    });

    it('reports respond and reject a backwards date range', async () => {
      for (const path of ['trends', 'workload', 'waiting-times', 'cancellations']) {
        expect((await admin.get(`/api/reports/${path}`)).status).toBe(200);
      }
      const bad = await admin.get('/api/reports/trends').query({ from: '2026-10-10', to: '2026-10-01' });
      expect(bad.status).toBe(400);
      await setSettings({ clinicName: 'Renamed Clinic' });
      expect((await admin.get('/api/settings/public')).body.settings.clinicName).toBe('Renamed Clinic');
    });
  });
});
