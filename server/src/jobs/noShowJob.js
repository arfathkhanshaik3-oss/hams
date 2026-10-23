import { markMissedAppointments } from '../services/queueService.js';

// Every few minutes, appointments nobody checked in for become NO_SHOW
// (noShowAfterMinutes after the slot ended - configurable in clinic settings).
export function startNoShowJob(intervalMs = 5 * 60 * 1000) {
  const run = async () => {
    try {
      const n = await markMissedAppointments();
      if (n > 0) console.log(`[job] marked ${n} missed appointment(s) as no-show`);
    } catch (err) {
      console.error('[job] no-show job failed:', err?.message);
    }
  };
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
