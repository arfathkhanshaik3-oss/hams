import { useState } from 'react';
import { Save } from 'lucide-react';
import { api, fieldErrors, getError } from '../../services/api.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Alert, Async, Button, Card, Input, PageHeader } from '../../components/ui/ui.jsx';
import { WEEKDAYS } from '../../utils/format.js';

const NUMBERS = ['cancellationCutoffHours', 'lateGraceMinutes', 'noShowAfterMinutes', 'maxAdvanceBookingDays', 'maxDailyWalkIns', 'maxReschedules'];
const FIELDS = [
  ['cancellationCutoffHours', 'Cancellation cut-off (hours)', 'Patients cannot cancel or reschedule closer to the visit than this.'],
  ['maxReschedules', 'Reschedules allowed per appointment', 'How many times one appointment can be moved.'],
  ['maxAdvanceBookingDays', 'Book up to (days ahead)', 'How far in advance patients can book.'],
  ['maxDailyWalkIns', 'Walk-ins per doctor per day', 'Extra patients without appointments that one doctor can take.'],
  ['lateGraceMinutes', 'Late grace (minutes)', 'After this many minutes past the slot, a checked-in patient counts as a late arrival.'],
  ['noShowAfterMinutes', 'Auto no-show after (minutes)', 'Booked patients who never check in are marked no-show this long after their slot.'],
];

function Form({ initial }) {
  const toast = useToast();
  const { reload } = useSettings();
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: '' })); };
  const toggleDay = (d) => setF((x) => ({ ...x, closedWeekdays: x.closedWeekdays.includes(d) ? x.closedWeekdays.filter((n) => n !== d) : [...x.closedWeekdays, d] }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setErrors({});
    try {
      const body = { clinicName: f.clinicName, opensAt: f.opensAt, closesAt: f.closesAt, timeZone: f.timeZone, closedWeekdays: f.closedWeekdays };
      for (const k of NUMBERS) body[k] = Number(f[k]);
      await api.put('/admin/settings', body);
      toast.success('Settings saved.');
      reload();
    } catch (err) { setError(getError(err).message); setErrors(fieldErrors(err)); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} noValidate className="stack">
      {error && <Alert tone="error">{error}</Alert>}
      <Card title="Clinic">
        <div className="form-grid">
          <Input label="Clinic name" required value={f.clinicName} onChange={set('clinicName')} error={errors.clinicName} />
          <Input label="Time zone" required value={f.timeZone} onChange={set('timeZone')} error={errors.timeZone} hint="For example Asia/Kolkata" />
          <Input label="Opens at" type="time" required value={f.opensAt} onChange={set('opensAt')} error={errors.opensAt} />
          <Input label="Closes at" type="time" required value={f.closesAt} onChange={set('closesAt')} error={errors.closesAt} />
        </div>
        <fieldset style={{ border: 0, padding: 0, margin: '16px 0 0' }}>
          <legend className="label">Closed on</legend>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {WEEKDAYS.map((name, d) => (
              <label key={d} className="row" style={{ gap: 6 }}><input type="checkbox" checked={f.closedWeekdays.includes(d)} onChange={() => toggleDay(d)} />{name}</label>
            ))}
          </div>
          {errors.closedWeekdays && <div className="field-error">{errors.closedWeekdays}</div>}
        </fieldset>
      </Card>
      <Card title="Booking and queue rules">
        <div className="form-grid">
          {FIELDS.map(([k, label, hint]) => <Input key={k} label={label} type="number" min={0} value={f[k]} onChange={set(k)} error={errors[k]} hint={hint} />)}
        </div>
      </Card>
      <div><Button type="submit" icon={Save} loading={busy}>Save settings</Button></div>
    </form>
  );
}

export default function SettingsPage() {
  const state = useFetch(() => api.get('/admin/settings').then((r) => r.data.settings), []);
  return (
    <>
      <PageHeader title="Clinic settings" subtitle="These rules apply to every booking and queue immediately after saving." />
      <Async state={state}>{(s) => <Form initial={{ ...s, closedWeekdays: s.closedWeekdays ?? [] }} />}</Async>
    </>
  );
}
