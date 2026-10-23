// Formatting helpers. The clinic time zone comes from the server settings (default Asia/Kolkata),
// so "today", "9:30 AM" and weekdays always mean clinic time, wherever the browser is.
let TZ = 'Asia/Kolkata';
export const setClinicTimeZone = (tz) => { if (tz) TZ = tz; };
export const getClinicTimeZone = () => TZ;

export const STATUS = {
  BOOKED: { label: 'Booked', tone: 'slate' },
  CONFIRMED: { label: 'Confirmed', tone: 'blue' },
  CHECKED_IN: { label: 'Checked in', tone: 'teal' },
  WAITING: { label: 'Waiting', tone: 'amber' },
  CALLED: { label: 'Called', tone: 'violet' },
  IN_CONSULTATION: { label: 'In consultation', tone: 'navy' },
  COMPLETED: { label: 'Completed', tone: 'green' },
  CANCELLED: { label: 'Cancelled', tone: 'gray' },
  NO_SHOW: { label: 'No show', tone: 'red' },
};
export const statusLabel = (s) => STATUS[s]?.label ?? s;
export const OPEN_STATUSES = ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'WAITING', 'CALLED', 'IN_CONSULTATION'];
export const ACTIVE_QUEUE_STATUSES = ['CHECKED_IN', 'WAITING', 'CALLED', 'IN_CONSULTATION'];

export const ROLE_LABEL = { PATIENT: 'Patient', DOCTOR: 'Doctor', RECEPTIONIST: 'Receptionist', ADMIN: 'Administrator' };
export const ROLE_HOME = { PATIENT: '/patient', DOCTOR: '/doctor', RECEPTIONIST: '/reception', ADMIN: '/admin' };
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const f = (opts, tz) => new Intl.DateTimeFormat('en-IN', { timeZone: tz ?? TZ, ...opts });
export const fmtDate = (iso) => (iso ? f({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)) : '-');
export const fmtDateShort = (iso) => (iso ? f({ day: 'numeric', month: 'short' }).format(new Date(iso)) : '-');
export const fmtTime = (iso) => (iso ? f({ hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso)).toUpperCase() : '-');
export const fmtDateTime = (iso) => (iso ? `${fmtDate(iso)}, ${fmtTime(iso)}` : '-');
// "2026-10-17" (a calendar date without time)
export const fmtDateStr = (s) => (s ? f({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }, 'UTC').format(new Date(`${s}T00:00:00Z`)) : '-');
export const fmtDayMonth = (s) => (s ? f({ day: 'numeric', month: 'short' }, 'UTC').format(new Date(`${s}T00:00:00Z`)) : '-');
// "09:30" -> "9:30 AM"
export const fmtTimeStr = (t) => {
  if (!t) return '-';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
export const todayStr = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
export const addDaysStr = (s, n) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const weekdayOfStr = (s) => new Date(`${s}T00:00:00Z`).getUTCDay();
export const isToday = (iso) => iso && new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso)) === todayStr();

export const money = (n) => (n == null ? '-' : `₹${Number(n).toLocaleString('en-IN')}`);
export const initials = (name = '') => name.replace(/^Dr\.?\s+/i, '').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';
export const minutesLabel = (n) => {
  if (n == null) return '-';
  if (n < 1) return 'Under 1 min';
  if (n < 60) return `${Math.round(n)} min`;
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
};
export const timeAgo = (iso) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return fmtDateShort(iso);
};
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
