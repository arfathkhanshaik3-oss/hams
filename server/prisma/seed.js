// Fictional demo data. NO real people, NO real patient records.
//
//   npm run db:seed          normal clinic hours (08:00-20:00, closed Sunday)
//   npm run db:seed:demo     "demo hours": clinic and doctors open 24/7 so the live queue
//                            can be tried at ANY time of day (useful for presentations)
//
// WARNING: this script first DELETES all existing data in the database.
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/prisma.js';
import { buildDaySlots } from '../src/services/slotService.js';
import { addDays, addMinutes, dbDate, todayStr, weekdayOf, zonedToUtc } from '../src/utils/time.js';

const DEMO = process.argv.includes('--demo');
const TZ = 'Asia/Kolkata';
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rand(0, arr.length - 1)];
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

const usedRefs = new Set();
function reference(dateStr) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (;;) {
    let code = '';
    for (let i = 0; i < 4; i += 1) code += alphabet[rand(0, alphabet.length - 1)];
    const ref = `APT-${dateStr.replaceAll('-', '')}-${code}`;
    if (!usedRefs.has(ref)) {
      usedRefs.add(ref);
      return ref;
    }
  }
}

const SPECIALIZATIONS = [
  ['General Medicine', 'Primary care for adults: check-ups, fevers, infections and long-term follow-up.'],
  ['Cardiology', 'Heart and blood-vessel care, including routine heart check-ups.'],
  ['Dermatology', 'Skin, hair and nail care.'],
  ['Pediatrics', 'Healthcare for infants, children and teenagers.'],
  ['Orthopedics', 'Bones, joints, muscles and sports injuries.'],
  ['ENT', 'Ear, nose and throat care.'],
  ['Gynecology', "Women's health and maternity care."],
  ['Neurology', 'Nervous system care, including headaches and nerve conditions.'],
];

const DOCTORS = [
  { name: 'Dr. Ananya Rao', email: 'ananya.rao@hams.test', spec: 'General Medicine', fee: 400, mins: 12, years: 12, qual: 'MBBS, MD (Internal Medicine)', room: '101', slot: 15, bio: 'Family physician with a focus on preventive care and long-term follow-up.' },
  { name: 'Dr. Vikram Shah', email: 'vikram.shah@hams.test', spec: 'Cardiology', fee: 900, mins: 20, years: 18, qual: 'MBBS, DM (Cardiology)', room: '204', slot: 20, bio: 'Consultant cardiologist. Runs the clinic heart check-up programme.' },
  { name: 'Dr. Meera Iyer', email: 'meera.iyer@hams.test', spec: 'Dermatology', fee: 700, mins: 15, years: 9, qual: 'MBBS, MD (Dermatology)', room: '112', slot: 15, bio: 'Dermatologist treating skin, hair and nail concerns for all ages.' },
  { name: 'Dr. Rohan Desai', email: 'rohan.desai@hams.test', spec: 'Pediatrics', fee: 500, mins: 15, years: 11, qual: 'MBBS, MD (Pediatrics)', room: '105', slot: 15, bio: 'Pediatrician caring for newborns, children and adolescents.' },
  { name: 'Dr. Kavita Nair', email: 'kavita.nair@hams.test', spec: 'Orthopedics', fee: 800, mins: 20, years: 15, qual: 'MBBS, MS (Orthopedics)', room: '210', slot: 20, bio: 'Orthopedic surgeon with an interest in sports injuries and joint care.' },
  { name: 'Dr. Arjun Menon', email: 'arjun.menon@hams.test', spec: 'ENT', fee: 600, mins: 15, years: 8, qual: 'MBBS, MS (ENT)', room: '118', slot: 15, bio: 'ENT specialist for ear, nose and throat concerns.' },
  { name: 'Dr. Sneha Kulkarni', email: 'sneha.kulkarni@hams.test', spec: 'Gynecology', fee: 750, mins: 20, years: 14, qual: 'MBBS, MD (Obstetrics & Gynecology)', room: '215', slot: 20, bio: "Gynecologist providing women's health and maternity care." },
  { name: 'Dr. Imran Qureshi', email: 'imran.qureshi@hams.test', spec: 'Neurology', fee: 1000, mins: 30, years: 20, qual: 'MBBS, DM (Neurology)', room: '220', slot: 30, bio: 'Neurologist for headache, nerve and movement concerns.' },
];

const PATIENT_NAMES = [
  'Riya Kapoor', 'Aditya Verma', 'Priya Nambiar', 'Karan Malhotra', 'Neha Joshi', 'Rahul Bhatt', 'Sana Sheikh', 'Manish Gupta', 'Pooja Reddy', 'Siddharth Jain',
  'Ishita Banerjee', 'Varun Chopra', 'Anjali Pillai', 'Harsh Vora', 'Divya Saxena', 'Nikhil Patil', 'Tara Menon', 'Yash Agarwal', 'Lakshmi Iyer', 'Rajat Kulkarni',
  'Fatima Khan', 'Gaurav Singh', 'Swati Mishra', 'Dev Thakur', 'Nandini Rao', 'Omkar Pawar', 'Zoya Ansari', 'Abhishek Das', 'Kritika Sen', 'Tushar Bose',
];

const REASONS = ['Routine check-up', 'Follow-up visit', 'Fever and tiredness', 'Skin rash review', 'Joint pain review', 'Annual health check', 'Persistent cough', 'Headache review', 'Report review', 'General consultation'];
const CANCEL_REASONS = ['Change of plans', 'Feeling better', 'Travel', 'Booked by mistake', 'Work commitment'];

async function main() {
  console.log(`Seeding fictional data${DEMO ? ' (demo hours: open 24/7)' : ''} ...`);
  const now = new Date();
  const today = todayStr(TZ, now);

  // ----- wipe -----
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.queueEntry.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.doctorLeave.deleteMany();
  await prisma.doctorSchedule.deleteMany();
  await prisma.doctorProfile.deleteMany();
  await prisma.patientProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.specialization.deleteMany();
  await prisma.clinicSettings.deleteMany();

  // ----- settings -----
  const settings = await prisma.clinicSettings.create({
    data: {
      id: 1,
      clinicName: 'City Care Clinic',
      opensAt: DEMO ? '00:00' : '08:00',
      closesAt: DEMO ? '23:59' : '20:00',
      timeZone: TZ,
      closedWeekdays: DEMO ? [] : [0],
    },
  });

  // ----- users -----
  const hash = {
    admin: await bcrypt.hash('Admin@123', 10),
    reception: await bcrypt.hash('Reception@123', 10),
    doctor: await bcrypt.hash('Doctor@123', 10),
    patient: await bcrypt.hash('Patient@123', 10),
  };
  const admin = await prisma.user.create({ data: { email: 'admin@hams.test', passwordHash: hash.admin, role: 'ADMIN', fullName: 'Admin Sharma', phone: '+91 90000 00001' } });
  await prisma.user.create({ data: { email: 'reception@hams.test', passwordHash: hash.reception, role: 'RECEPTIONIST', fullName: 'Pooja Deshmukh', phone: '+91 90000 00002' } });
  await prisma.user.create({ data: { email: 'reception2@hams.test', passwordHash: hash.reception, role: 'RECEPTIONIST', fullName: 'Rakesh Pillai', phone: '+91 90000 00003' } });

  const specByName = {};
  for (const [name, description] of SPECIALIZATIONS) specByName[name] = await prisma.specialization.create({ data: { name, description } });

  const doctors = [];
  for (const [i, d] of DOCTORS.entries()) {
    const user = await prisma.user.create({
      data: {
        email: d.email, passwordHash: hash.doctor, role: 'DOCTOR', fullName: d.name, phone: `+91 90000 1${String(i).padStart(4, '0')}`,
        doctorProfile: { create: { specializationId: specByName[d.spec].id, consultationFee: d.fee, consultationMinutes: d.mins, experienceYears: d.years, qualification: d.qual, bio: d.bio, room: d.room } },
      },
      include: { doctorProfile: true },
    });
    const profile = user.doctorProfile;
    // Mon-Sat: 09:00-13:00 and 14:00-17:00 (or around the clock in demo mode)
    const sessions = [];
    const days = DEMO ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6];
    for (const weekday of days) {
      if (DEMO) sessions.push({ doctorId: profile.id, weekday, startTime: '00:00', endTime: '23:59', slotMinutes: d.slot });
      else if (weekday === 6) sessions.push({ doctorId: profile.id, weekday, startTime: '09:00', endTime: '13:00', slotMinutes: d.slot });
      else sessions.push({ doctorId: profile.id, weekday, startTime: '09:00', endTime: '13:00', slotMinutes: d.slot }, { doctorId: profile.id, weekday, startTime: '14:00', endTime: '17:00', slotMinutes: d.slot });
    }
    await prisma.doctorSchedule.createMany({ data: sessions });
    doctors.push({ ...d, id: profile.id, userId: user.id, sessions });
  }
  // Dr. Meera Iyer is on leave for two days next week (shows the leave feature)
  const leaveStart = addDays(today, 8);
  await prisma.doctorLeave.create({ data: { doctorId: doctors[2].id, startDate: dbDate(leaveStart), endDate: dbDate(addDays(leaveStart, 1)), reason: 'Medical conference' } });

  const patients = [];
  for (const [i, name] of PATIENT_NAMES.entries()) {
    const email = i === 0 ? 'patient@hams.test' : `patient${i + 1}@hams.test`;
    const user = await prisma.user.create({
      data: {
        email, passwordHash: hash.patient, role: 'PATIENT', fullName: name, phone: `+91 90000 2${String(i).padStart(4, '0')}`,
        patientProfile: { create: { dateOfBirth: new Date(Date.UTC(rand(1950, 2012), rand(0, 11), rand(1, 28))), gender: pick(['MALE', 'FEMALE', 'OTHER']), address: `${rand(1, 90)}, Sample Street, Demo City`, emergencyContact: 'Family member - +91 90000 39999' } },
      },
      include: { patientProfile: true },
    });
    patients.push({ id: user.patientProfile.id, userId: user.id, name });
  }

  // ----- helpers to build appointments + queue entries -----
  const apptRows = [];
  const queueRows = [];
  const queueCounters = new Map(); // `${doctorId}|${date}` -> last queue number

  function add({ doctor, patient, dateStr, slot, status, type = 'ONLINE', timing = {}, cancelReason, reason, sortKey }) {
    const key = `${doctor.id}|${dateStr}`;
    const queueNumber = (queueCounters.get(key) ?? 0) + 1;
    queueCounters.set(key, queueNumber);
    const id = crypto.randomUUID();
    apptRows.push({
      id, reference: reference(dateStr), doctorId: doctor.id, patientId: patient.id, startsAt: slot.startsAt, endsAt: slot.endsAt, appointmentDate: dbDate(dateStr),
      status, type, reasonForVisit: reason ?? pick(REASONS), cancelReason: status === 'CANCELLED' ? cancelReason ?? pick(CANCEL_REASONS) : null,
      cancelledById: status === 'CANCELLED' ? patient.userId : null, bookedById: patient.userId, createdAt: addMinutes(slot.startsAt, -rand(60, 60 * 72)),
    });
    queueRows.push({ appointmentId: id, doctorId: doctor.id, queueDate: dbDate(dateStr), queueNumber, sortKey: sortKey ?? slot.startsAt, ...timing });
  }

  const slotsFor = (doctor, dateStr) => {
    const r = buildDaySlots({ schedules: doctor.sessions.map((s) => ({ ...s })), leaves: [], settings, dateStr, takenMs: new Set(), now: new Date(0) });
    return r.closed ? [] : r.slots;
  };

  // ----- history: last 14 days (completed / cancelled / no-show) -----
  for (let off = -14; off <= -1; off += 1) {
    const dateStr = addDays(today, off);
    if (settings.closedWeekdays.includes(weekdayOf(dateStr))) continue;
    for (const doctor of doctors) {
      const slots = slotsFor(doctor, dateStr);
      if (!slots.length) continue;
      const chosen = shuffle(slots).slice(0, rand(5, Math.min(11, slots.length))).sort((a, b) => a.startsAt - b.startsAt);
      const people = shuffle(patients);
      let doctorFree = new Date(0);
      chosen.forEach((slot, i) => {
        const patient = people[i];
        const roll = Math.random();
        if (roll < 0.13) return add({ doctor, patient, dateStr, slot, status: 'CANCELLED' });
        if (roll < 0.22) return add({ doctor, patient, dateStr, slot, status: 'NO_SHOW' });
        const checkedInAt = addMinutes(slot.startsAt, -rand(3, 14));
        const calledAt = new Date(Math.max(checkedInAt.getTime(), doctorFree.getTime()) + rand(0, 2) * 60000);
        const startedAt = addMinutes(calledAt, 1);
        const completedAt = addMinutes(startedAt, Math.max(5, doctor.mins + rand(-5, 6)));
        doctorFree = completedAt;
        return add({ doctor, patient, dateStr, slot, status: 'COMPLETED', timing: { checkedInAt, calledAt, startedAt, completedAt }, type: Math.random() < 0.15 ? 'WALK_IN' : 'ONLINE' });
      });
    }
  }

  // ----- the demo patient has a few visits of their own -----
  const demoPatient = patients[0];
  const pastDay = addDays(today, -3);
  if (!settings.closedWeekdays.includes(weekdayOf(pastDay))) {
    const d0 = doctors[0];
    const free = slotsFor(d0, pastDay).find((s) => !apptRows.some((a) => a.doctorId === d0.id && a.startsAt.getTime() === s.startsAt.getTime()));
    const taken = apptRows.some((a) => a.patientId === demoPatient.id && a.doctorId === d0.id && a.appointmentDate.getTime() === dbDate(pastDay).getTime());
    if (free && !taken) {
      const checkedInAt = addMinutes(free.startsAt, -8);
      add({ doctor: d0, patient: demoPatient, dateStr: pastDay, slot: free, status: 'COMPLETED', reason: 'Follow-up visit', timing: { checkedInAt, calledAt: addMinutes(checkedInAt, 9), startedAt: addMinutes(checkedInAt, 10), completedAt: addMinutes(checkedInAt, 24) } });
    }
  }

  // ----- today: a live queue for the first five doctors -----
  // Phase depends on the real clock: before the doctor's first slot everything is still upcoming,
  // after the last slot everything is finished, in between the queue is "live".
  let liveDoctors = 0;
  for (const [di, doctor] of doctors.slice(0, 5).entries()) {
    const slots = slotsFor(doctor, today);
    if (!slots.length) continue;
    const phase = now < slots[0].startsAt ? 'before' : now >= slots[slots.length - 1].endsAt ? 'after' : 'during';
    const firstFuture = slots.findIndex((s) => s.startsAt > now);
    const i0 = phase === 'before' ? 0 : phase === 'after' ? slots.length : firstFuture;
    const lo = phase === 'before' ? 0 : Math.max(0, i0 - 5);
    const window = slots.slice(lo, Math.min(slots.length, phase === 'before' ? 8 : i0 + 8));
    const people = shuffle(patients.filter((p) => p.id !== demoPatient.id));
    if (phase === 'during') liveDoctors += 1;
    window.forEach((slot, w) => {
      const k = lo + w - i0; // offset from "now": negative = already passed
      const patient = people[w];
      const dateStr = today;
      const done = (minsBefore = 6) => {
        const checkedInAt = addMinutes(slot.startsAt, -rand(4, minsBefore + 4));
        return { checkedInAt, calledAt: addMinutes(checkedInAt, 5), startedAt: addMinutes(checkedInAt, 6), completedAt: addMinutes(checkedInAt, 6 + doctor.mins) };
      };
      if (phase === 'after') return add({ doctor, patient, dateStr, slot, status: w % 6 === 0 ? 'NO_SHOW' : 'COMPLETED', timing: done() });
      if (phase === 'before') {
        if (di === 0 && w === 3) return add({ doctor, patient: demoPatient, dateStr, slot, status: 'BOOKED', reason: 'Routine check-up' });
        return add({ doctor, patient, dateStr, slot, status: w % 3 === 0 ? 'CONFIRMED' : 'BOOKED' });
      }
      if (k <= -3) return k === -3 ? add({ doctor, patient, dateStr, slot, status: 'NO_SHOW' }) : add({ doctor, patient, dateStr, slot, status: 'COMPLETED', timing: done() });
      if (k === -2) {
        const t = done();
        return add({ doctor, patient, dateStr, slot, status: 'COMPLETED', timing: { ...t, completedAt: addMinutes(now, -2) } });
      }
      if (k === -1) {
        return add({ doctor, patient, dateStr, slot, status: 'IN_CONSULTATION', timing: { checkedInAt: addMinutes(now, -(doctor.mins + 12)), calledAt: addMinutes(now, -(Math.round(doctor.mins / 2) + 2)), startedAt: addMinutes(now, -Math.round(doctor.mins / 2)) } });
      }
      if (k >= 0 && k <= 2) {
        return add({ doctor, patient, dateStr, slot, status: k === 0 ? 'WAITING' : 'CHECKED_IN', timing: { checkedInAt: addMinutes(now, -rand(3, 15)) }, sortKey: slot.startsAt });
      }
      if (k === 3 && di === 0) return add({ doctor, patient: demoPatient, dateStr, slot, status: 'BOOKED', reason: 'Routine check-up' }); // demo patient: not yet arrived
      if (k === 4 && di === 1) return add({ doctor, patient, dateStr, slot, status: 'CANCELLED' });
      if (k === 5 && di === 0) return add({ doctor, patient, dateStr, slot, status: 'CHECKED_IN', type: 'WALK_IN', timing: { checkedInAt: addMinutes(now, -1) }, sortKey: slot.startsAt });
      return add({ doctor, patient, dateStr, slot, status: k % 2 === 0 ? 'CONFIRMED' : 'BOOKED' });
    });
  }
  const queueNow = liveDoctors > 0;

  // ----- upcoming: next 7 days -----
  for (let off = 1; off <= 7; off += 1) {
    const dateStr = addDays(today, off);
    if (settings.closedWeekdays.includes(weekdayOf(dateStr))) continue;
    for (const doctor of doctors) {
      if (doctor.id === doctors[2].id && dateStr >= leaveStart && dateStr <= addDays(leaveStart, 1)) continue;
      const slots = slotsFor(doctor, dateStr);
      if (!slots.length) continue;
      const people = shuffle(patients);
      shuffle(slots).slice(0, rand(2, 5)).forEach((slot, i) => add({ doctor, patient: people[i], dateStr, slot, status: Math.random() < 0.3 ? 'CONFIRMED' : 'BOOKED' }));
    }
  }
  // the demo patient has two future appointments
  for (const [i, off] of [2, 5].entries()) {
    const dateStr = addDays(today, off);
    const doctor = doctors[i === 0 ? 3 : 4];
    if (settings.closedWeekdays.includes(weekdayOf(dateStr))) continue;
    const used = new Set(apptRows.filter((a) => a.doctorId === doctor.id).map((a) => a.startsAt.getTime()));
    const dup = apptRows.some((a) => a.patientId === demoPatient.id && a.doctorId === doctor.id && a.appointmentDate.getTime() === dbDate(dateStr).getTime());
    const slot = slotsFor(doctor, dateStr).find((s) => !used.has(s.startsAt.getTime()));
    if (slot && !dup) add({ doctor, patient: demoPatient, dateStr, slot, status: 'CONFIRMED', reason: i === 0 ? 'Child vaccination review' : 'Knee pain review' });
  }

  // ----- make sure rules still hold before inserting (same rules the database enforces) -----
  const seenSlot = new Set();
  const seenDay = new Set();
  const final = [];
  const finalQueue = [];
  apptRows.forEach((a, i) => {
    const active = !['CANCELLED', 'NO_SHOW'].includes(a.status);
    const slotKey = `${a.doctorId}|${a.startsAt.getTime()}`;
    const dayKey = `${a.patientId}|${a.doctorId}|${a.appointmentDate.getTime()}`;
    if (active && seenSlot.has(slotKey)) return;
    if (active && a.status !== 'COMPLETED' && seenDay.has(dayKey)) return;
    if (active) seenSlot.add(slotKey);
    if (active && a.status !== 'COMPLETED') seenDay.add(dayKey);
    final.push(a);
    finalQueue.push(queueRows[i]);
  });

  await prisma.appointment.createMany({ data: final });
  await prisma.queueEntry.createMany({ data: finalQueue });

  // ----- notifications + audit log samples -----
  const demoUser = await prisma.user.findUnique({ where: { email: 'patient@hams.test' } });
  await prisma.notification.createMany({
    data: [
      { userId: demoUser.id, title: 'Welcome to City Care Clinic', message: 'Your account is ready. You can book appointments and track your queue live.', type: 'INFO', createdAt: addMinutes(now, -60 * 24 * 5) },
      { userId: demoUser.id, title: 'Appointment confirmed', message: 'Your upcoming appointment was confirmed by the doctor.', type: 'APPOINTMENT', createdAt: addMinutes(now, -60 * 5) },
    ],
  });
  const logs = [
    ['SETTINGS_UPDATED', 'ClinicSettings', '1', -60 * 24 * 10, { note: 'Initial clinic hours configured' }],
    ['SPECIALIZATION_CREATED', 'Specialization', null, -60 * 24 * 10 + 5, { count: SPECIALIZATIONS.length }],
    ...doctors.map((d, i) => ['DOCTOR_CREATED', 'DoctorProfile', d.id, -60 * 24 * 9 + i, { name: d.name }]),
    ['DOCTOR_LEAVE_ADDED', 'DoctorProfile', doctors[2].id, -60 * 24 * 2, { startDate: leaveStart, endDate: addDays(leaveStart, 1) }],
    ['ADMIN_LOGIN', 'User', admin.id, -30, null],
  ];
  await prisma.auditLog.createMany({
    data: logs.map(([action, entityType, entityId, minutesAgo, details]) => ({ actorId: admin.id, action, entityType, entityId, details: details ?? undefined, ipAddress: '127.0.0.1', createdAt: addMinutes(now, minutesAgo) })),
  });

  const counts = {};
  for (const a of final) counts[a.status] = (counts[a.status] ?? 0) + 1;
  console.log(`Created ${DOCTORS.length} doctors, ${patients.length} patients, ${final.length} appointments`, counts);
  console.log(`
Demo accounts (fictional):
  Admin         admin@hams.test        Admin@123
  Receptionist  reception@hams.test    Reception@123
  Doctor        ananya.rao@hams.test   Doctor@123   (and the 7 other doctors, same password)
  Patient       patient@hams.test      Patient@123  (patient2..patient30@hams.test also work)
${queueNow ? '' : '\nNote: no doctor is in session right now, so today has no live queue. Use "npm run db:seed:demo" to test the queue at any hour.\n'}`);
}

main()
  .catch((err) => {
    console.error('Seeding failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
