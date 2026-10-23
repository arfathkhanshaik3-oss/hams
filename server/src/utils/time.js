// Time helpers. Everything is stored in UTC; the clinic's time zone decides
// what "today", "09:00" or "Monday" mean.
const pad = (n) => String(n).padStart(2, '0');

export const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60000);
export const minutesBetween = (a, b) => (b.getTime() - a.getTime()) / 60000;

export const isValidDateStr = (s) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) &&
  new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

// "2026-10-17" -> Date at UTC midnight (what Prisma stores for @db.Date columns)
export const dbDate = (dateStr) => new Date(`${dateStr}T00:00:00.000Z`);
export const dateKey = (d) => d.toISOString().slice(0, 10);
export const weekdayOf = (dateStr) => dbDate(dateStr).getUTCDay();
export function addDays(dateStr, n) {
  const d = dbDate(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return dateKey(d);
}

function zonedParts(date, tz) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
}

function tzOffsetMs(date, tz) {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// ("2026-10-17", "09:30", "Asia/Kolkata") -> the UTC instant of that wall-clock time
export function zonedToUtc(dateStr, timeStr, tz) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let utc = guess - tzOffsetMs(new Date(guess), tz);
  utc = guess - tzOffsetMs(new Date(utc), tz);
  return new Date(utc);
}

// instant -> { date: "YYYY-MM-DD", time: "HH:mm", weekday: 0-6 } in clinic time
export function toClinicParts(date, tz) {
  const p = zonedParts(date, tz);
  const dateStr = `${p.year}-${p.month}-${p.day}`;
  return { date: dateStr, time: `${p.hour}:${p.minute}`, weekday: weekdayOf(dateStr) };
}

export const todayStr = (tz, now = new Date()) => toClinicParts(now, tz).date;
export const timeStr = (h, m) => `${pad(h)}:${pad(m)}`;
export const isValidTimeZone = (tz) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};
export const ageFromDob = (dob, now = new Date()) => {
  if (!dob) return null;
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age;
};
