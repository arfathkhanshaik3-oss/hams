-- Custom database rules that Prisma's schema language cannot express.
-- These are appended to the first migration by `npm run db:init`.

-- 1. A booking must end after it starts.
ALTER TABLE "Appointment"
  ADD CONSTRAINT "appointment_end_after_start" CHECK ("endsAt" > "startsAt");

-- 2. NO DOUBLE BOOKING: one live appointment per doctor per start time.
--    Cancelled and no-show appointments free the slot again.
CREATE UNIQUE INDEX "appointment_active_slot_key"
  ON "Appointment" ("doctorId", "startsAt")
  WHERE "status" NOT IN ('CANCELLED', 'NO_SHOW');

-- 3. A patient may hold only one open appointment per doctor per day.
--    This also guarantees "no duplicate active queue entry".
CREATE UNIQUE INDEX "appointment_patient_doctor_day_key"
  ON "Appointment" ("patientId", "doctorId", "appointmentDate")
  WHERE "status" NOT IN ('CANCELLED', 'NO_SHOW', 'COMPLETED');

-- 4. Sanity checks on schedules, leave, queue and settings.
ALTER TABLE "DoctorSchedule"
  ADD CONSTRAINT "doctor_schedule_weekday_range" CHECK ("weekday" BETWEEN 0 AND 6),
  ADD CONSTRAINT "doctor_schedule_slot_range" CHECK ("slotMinutes" BETWEEN 5 AND 120);

ALTER TABLE "DoctorLeave"
  ADD CONSTRAINT "doctor_leave_dates" CHECK ("endDate" >= "startDate");

ALTER TABLE "QueueEntry"
  ADD CONSTRAINT "queue_number_positive" CHECK ("queueNumber" > 0),
  ADD CONSTRAINT "queue_skip_count_non_negative" CHECK ("skipCount" >= 0);

ALTER TABLE "ClinicSettings"
  ADD CONSTRAINT "clinic_settings_singleton" CHECK ("id" = 1);
