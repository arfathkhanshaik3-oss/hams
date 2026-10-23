import { useState } from 'react';
import { api, getError } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { addDaysStr, fmtDateTime, todayStr } from '../utils/format.js';
import SlotPicker from './SlotPicker.jsx';
import { Alert, Button, Input, Modal } from './ui/ui.jsx';

export default function RescheduleModal({ appointment, onClose, onDone }) {
  const toast = useToast();
  const { settings } = useSettings();
  const [date, setDate] = useState(todayStr());
  const [slot, setSlot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/appointments/${appointment.id}/reschedule`, { startsAt: slot.startsAt });
      toast.success(`Moved to ${fmtDateTime(data.appointment.startsAt)}. Your new queue number is ${data.appointment.queue.queueNumber}.`, 'Rescheduled');
      onDone(data.appointment);
    } catch (err) {
      const e = getError(err);
      setError(e.message);
      if (e.status === 409) { setSlot(null); setReloadKey((k) => k + 1); }
    } finally { setBusy(false); }
  };

  return (
    <Modal title="Reschedule appointment" size="lg" onClose={onClose}
      footer={(<><Button variant="outline" onClick={onClose}>Keep current time</Button><Button disabled={!slot} loading={busy} onClick={submit}>Confirm new time</Button></>)}>
      <div className="stack">
        <p>Currently <b>{fmtDateTime(appointment.startsAt)}</b> with {appointment.doctor.fullName}. Your old time is released as soon as the new one is confirmed.</p>
        {appointment.rescheduleCount > 0 && <Alert tone="info">This appointment has been rescheduled {appointment.rescheduleCount} time(s). Patients can reschedule up to {settings.maxReschedules} times.</Alert>}
        <Input label="New date" type="date" value={date} min={todayStr()} max={addDaysStr(todayStr(), settings.maxAdvanceBookingDays)} onChange={(e) => { setDate(e.target.value); setSlot(null); }} />
        <SlotPicker doctorId={appointment.doctor.id} date={date} value={slot?.startsAt} onChange={setSlot} reloadKey={reloadKey} />
        {error && <Alert tone="error">{error}</Alert>}
      </div>
    </Modal>
  );
}
