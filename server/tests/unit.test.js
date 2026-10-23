import { describe, expect, it } from 'vitest';
import { buildDaySlots } from '../src/services/slotService.js';
import { addDays, isValidDateStr, toClinicParts, weekdayOf, zonedToUtc } from '../src/utils/time.js';

describe('time helpers', () => {
  it('converts clinic wall-clock time to UTC (Asia/Kolkata is UTC+5:30)', () => {
    expect(zonedToUtc('2026-10-17', '09:30', 'Asia/Kolkata').toISOString()).toBe('2026-10-17T04:00:00.000Z');
  });
  it('handles daylight saving time', () => {
    expect(zonedToUtc('2026-01-15', '12:00', 'America/New_York').toISOString()).toBe('2026-01-15T17:00:00.000Z');
    expect(zonedToUtc('2026-07-15', '12:00', 'America/New_York').toISOString()).toBe('2026-07-15T16:00:00.000Z');
  });
  it('round-trips through clinic parts', () => {
    const d = zonedToUtc('2026-10-17', '23:45', 'Asia/Kolkata');
    expect(toClinicParts(d, 'Asia/Kolkata')).toEqual({ date: '2026-10-17', time: '23:45', weekday: 6 });
  });
  it('validates and shifts dates', () => {
    expect(isValidDateStr('2026-02-29')).toBe(false);
    expect(isValidDateStr('2026-02-28')).toBe(true);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(weekdayOf('2026-10-19')).toBe(1); // Monday
  });
});

describe('slot generation (pure function)', () => {
  const settings = { timeZone: 'Asia/Kolkata', opensAt: '08:00', closesAt: '20:00', closedWeekdays: [0] };
  const monday = '2026-10-19';
  const longAgo = new Date('2020-01-01T00:00:00Z');
  const base = { leaves: [], settings, dateStr: monday, takenMs: new Set(), now: longAgo };

  it('builds slots from the weekly schedule', () => {
    const r = buildDaySlots({ ...base, schedules: [{ weekday: 1, startTime: '09:00', endTime: '10:00', slotMinutes: 20 }] });
    expect(r.slots.map((s) => s.time)).toEqual(['09:00', '09:20', '09:40']);
    expect(r.slots.every((s) => s.available)).toBe(true);
  });
  it('does not create a slot that would run past the end of the session', () => {
    const r = buildDaySlots({ ...base, schedules: [{ weekday: 1, startTime: '09:00', endTime: '09:50', slotMinutes: 20 }] });
    expect(r.slots.map((s) => s.time)).toEqual(['09:00', '09:20']);
  });
  it('supports a lunch break (two sessions)', () => {
    const r = buildDaySlots({ ...base, schedules: [{ weekday: 1, startTime: '09:00', endTime: '09:30', slotMinutes: 15 }, { weekday: 1, startTime: '14:00', endTime: '14:30', slotMinutes: 15 }] });
    expect(r.slots.map((s) => s.time)).toEqual(['09:00', '09:15', '14:00', '14:15']);
  });
  it('clips to clinic opening hours', () => {
    const r = buildDaySlots({ ...base, schedules: [{ weekday: 1, startTime: '07:00', endTime: '09:00', slotMinutes: 30 }] });
    expect(r.slots.map((s) => s.time)).toEqual(['08:00', '08:30']);
  });
  it('is closed on clinic closed days, doctor leave and non-working days', () => {
    const sched = [{ weekday: 0, startTime: '09:00', endTime: '10:00', slotMinutes: 20 }, { weekday: 1, startTime: '09:00', endTime: '10:00', slotMinutes: 20 }];
    expect(buildDaySlots({ ...base, schedules: sched, dateStr: '2026-10-18' })).toMatchObject({ closed: true, reason: 'CLINIC_CLOSED' });
    expect(buildDaySlots({ ...base, schedules: sched, leaves: [{ startDate: new Date('2026-10-19T00:00:00Z'), endDate: new Date('2026-10-19T00:00:00Z') }] })).toMatchObject({ closed: true, reason: 'DOCTOR_ON_LEAVE' });
    expect(buildDaySlots({ ...base, schedules: sched, dateStr: '2026-10-20' })).toMatchObject({ closed: true, reason: 'NOT_WORKING' });
  });
  it('marks past and taken slots as unavailable', () => {
    const sched = [{ weekday: 1, startTime: '09:00', endTime: '10:00', slotMinutes: 20 }];
    const nineTwenty = zonedToUtc(monday, '09:20', 'Asia/Kolkata');
    const r = buildDaySlots({ ...base, schedules: sched, takenMs: new Set([zonedToUtc(monday, '09:40', 'Asia/Kolkata').getTime()]), now: nineTwenty });
    expect(r.slots.map((s) => [s.time, s.available, s.reason])).toEqual([['09:00', false, 'PAST'], ['09:20', false, 'PAST'], ['09:40', false, 'BOOKED']]);
  });
});
