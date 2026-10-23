import { useEffect, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { api, clean, fieldErrors, getError } from '../services/api.js';
import { useFetch } from '../hooks/useFetch.js';
import { useSettings } from '../context/SettingsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { addDaysStr, fmtDateStr, fmtTimeStr, money, todayStr } from '../utils/format.js';
import SlotPicker from './SlotPicker.jsx';
import { Alert, Avatar, Button, Card, Input, Select, Textarea } from './ui/ui.jsx';

/**
 * Doctor -> date -> time -> reason, with a summary on the right.
 * Used by patients (patientId omitted: the server uses the logged-in patient) and by receptionists (patientId given).
 */
export default function BookingForm({ patientId, initialDoctorId = '', initialDate, onBooked, disabledReason }) {
  const { settings } = useSettings();
  const toast = useToast();
  const [spec, setSpec] = useState('');
  const [doctorId, setDoctorId] = useState(initialDoctorId);
  const [date, setDate] = useState(initialDate || todayStr());
  const [slot, setSlot] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [reloadKey, setReloadKey] = useState(0);

  const specs = useFetch(() => api.get('/specializations').then((r) => r.data.items), []);
  const docs = useFetch(() => api.get('/doctors', { params: { limit: 50, specializationId: spec || undefined } }).then((r) => r.data.items), [spec]);
  const doctor = docs.data?.find((d) => d.id === doctorId);
  useEffect(() => { setSlot(null); }, [doctorId, date]);

  const submit = async () => {
    setBusy(true);
    setError('');
    setErrors({});
    try {
      const { data } = await api.post('/appointments', clean({ doctorId, startsAt: slot.startsAt, reasonForVisit: reason, patientId }));
      toast.success(`Reference ${data.appointment.reference}. Queue number ${data.appointment.queue.queueNumber}.`, 'Appointment booked');
      onBooked(data.appointment);
    } catch (err) {
      const e = getError(err);
      setError(e.message);
      setErrors(fieldErrors(err));
      if (['SLOT_TAKEN', 'CONFLICT', 'INVALID_SLOT'].includes(e.code)) { setSlot(null); setReloadKey((k) => k + 1); }
    } finally { setBusy(false); }
  };

  return (
    <div className="grid grid-main">
      <div className="stack">
        <Card title="Choose a doctor">
          <div className="form-grid">
            <Select label="Specialization" value={spec} onChange={(e) => { setSpec(e.target.value); setDoctorId(''); }}>
              <option value="">All specializations</option>
              {specs.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Select label="Doctor" required value={doctorId} onChange={(e) => setDoctorId(e.target.value)} error={errors.doctorId}>
              <option value="">{docs.loading ? 'Loading doctors...' : 'Select a doctor'}</option>
              {docs.data?.map((d) => <option key={d.id} value={d.id}>{d.fullName} - {d.specialization.name} ({money(d.consultationFee)})</option>)}
            </Select>
          </div>
          {docs.error && <Alert tone="error">{docs.error.message}</Alert>}
        </Card>
        <Card title="Pick a date and time">
          <div className="stack">
            <Input label="Date" type="date" required value={date} min={todayStr()} max={addDaysStr(todayStr(), settings.maxAdvanceBookingDays)} onChange={(e) => setDate(e.target.value)} error={errors.startsAt} style={{ maxWidth: 220 }} />
            <SlotPicker doctorId={doctorId} date={date} value={slot?.startsAt} onChange={setSlot} reloadKey={reloadKey} />
          </div>
        </Card>
        <Card title="Reason for visit">
          <Textarea label="Short note for the doctor (optional)" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} error={errors.reasonForVisit}
            hint="For example: routine check-up or follow-up visit. Do not include detailed medical history." />
        </Card>
      </div>
      <Card title="Summary" className="summary" style={{ position: 'sticky', top: 84 }}>
        {doctor ? (
          <div className="row" style={{ marginBottom: 12 }}><Avatar name={doctor.fullName} /><div><b>{doctor.fullName}</b><div className="small muted">{doctor.specialization.name}</div></div></div>
        ) : <p className="muted" style={{ marginBottom: 12 }}>No doctor selected yet.</p>}
        <dl className="kv" style={{ gridTemplateColumns: '90px minmax(0,1fr)' }}>
          <dt>Date</dt><dd>{fmtDateStr(date)}</dd>
          <dt>Time</dt><dd>{slot ? fmtTimeStr(slot.time) : <span className="muted">Not chosen</span>}</dd>
          <dt>Fee</dt><dd>{doctor ? money(doctor.consultationFee) : '-'}</dd>
          {doctor?.room && <><dt>Room</dt><dd>{doctor.room}</dd></>}
        </dl>
        <p className="small muted" style={{ margin: '12px 0' }}>You pay at the clinic. You will get a reference and a queue number straight away.</p>
        {disabledReason && <Alert tone="info">{disabledReason}</Alert>}
        {error && <div style={{ marginBottom: 12 }}><Alert tone="error">{error}</Alert></div>}
        <Button block size="lg" icon={CalendarCheck} disabled={!doctor || !slot || !!disabledReason} loading={busy} onClick={submit}>Confirm booking</Button>
      </Card>
    </div>
  );
}
