import { CalendarOff } from "lucide-react";
import { api } from "../services/api.js";
import { useFetch } from "../hooks/useFetch.js";
import { useSettings } from "../context/SettingsContext.jsx";
import { fmtTimeStr } from "../utils/format.js";
import { Alert, EmptyState, Loading, ErrorState } from "./ui/ui.jsx";

const GROUPS = [
  ["Morning", (h) => h < 12],
  ["Afternoon", (h) => h >= 12 && h < 17],
  ["Evening", (h) => h >= 17],
];

/** Shows the doctor's real, server-calculated slots for one date. Taken and past slots are disabled. */
export default function SlotPicker({
  doctorId,
  date,
  value,
  onChange,
  reloadKey = 0,
}) {
  const { settings } = useSettings();
  const state = useFetch(
    () =>
      api
        .get(`/doctors/${doctorId}/slots`, { params: { date } })
        .then((r) => r.data),
    [doctorId, date, reloadKey],
    { enabled: Boolean(doctorId && date) },
  );
  const closedText = {
    PAST_DATE: "That date has already passed.",
    TOO_FAR: `Appointments can be booked up to ${settings.maxAdvanceBookingDays} days ahead.`,
    CLINIC_CLOSED: "The clinic is closed on this day.",
    DOCTOR_ON_LEAVE: "The doctor is on leave on this day.",
    NOT_WORKING: "The doctor does not see patients on this day.",
  };

  if (!doctorId || !date)
    return (
      <p className="muted">
        Choose a doctor and a date to see available times.
      </p>
    );
  if (state.error)
    return <ErrorState error={state.error} onRetry={state.reload} />;
  if (!state.data) return <Loading label="Finding available times..." />;
  const { closed, reason, slots } = state.data;
  if (closed)
    return (
      <EmptyState icon={CalendarOff} title="No appointments on this day">
        {closedText[reason] ?? "Try another date."}
      </EmptyState>
    );
  const free = slots.filter((s) => s.available).length;
  if (free === 0)
    return (
      <Alert tone="warn">
        All times are taken on this day. Please try another date.
      </Alert>
    );

  return (
    <div>
      <p className="small muted" style={{ marginBottom: 12 }}>
        {free} of {slots.length} times available. Times are shown in clinic time
        ({settings.timeZone}).
      </p>
      {GROUPS.map(([name, test]) => {
        const group = slots.filter((s) => test(Number(s.time.slice(0, 2))));
        if (!group.length) return null;
        return (
          <div key={name}>
            <div className="slot-group-title">{name}</div>
            <div className="slots" role="group" aria-label={`${name} times`}>
              {group.map((s) => (
                <button
                  key={s.startsAt}
                  type="button"
                  className="slot"
                  disabled={!s.available}
                  aria-pressed={value === s.startsAt}
                  title={
                    s.available
                      ? "Available"
                      : s.reason === "BOOKED"
                        ? "Already booked"
                        : "Time has passed"
                  }
                  onClick={() => onChange(s)}
                >
                  {fmtTimeStr(s.time)}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
