import { useEffect, useState } from 'react';
import { CalendarOff, Plus, Save, Trash2 } from 'lucide-react';
import { api, clean, fieldErrors, getError } from '../../services/api.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useConfirm } from '../../context/ConfirmContext.jsx';
import { Alert, Async, Button, Card, EmptyState, Input, PageHeader } from '../../components/ui/ui.jsx';
import { WEEKDAYS, addDaysStr, fmtDayMonth, fmtTimeStr, todayStr } from '../../utils/format.js';

const blank = (weekday) => ({ weekday, startTime: '09:00', endTime: '13:00', slotMinutes: 15 });

/** Weekly working hours + leave. Used by the doctor (own) and the admin (any doctor). */
export default function ScheduleManagement({ doctorId: forced }) {
  const { user } = useAuth();
  const doctorId = forced ?? user.doctor?.id;
  const toast = useToast();
  const confirm = useConfirm();
  const state = useFetch(() => api.get(`/doctors/${doctorId}/schedule`).then((r) => r.data), [doctorId]);
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [leave, setLeave] = useState({ startDate: todayStr(), endDate: todayStr(), reason: '' });
  const [leaveErrors, setLeaveErrors] = useState({});
  const [leaveBusy, setLeaveBusy] = useState(false);

  useEffect(() => { if (state.data) setRows(state.data.schedule.map(({ weekday, startTime, endTime, slotMinutes }) => ({ weekday, startTime, endTime, slotMinutes }))); }, [state.data]);
  const patch = (i, changes) => setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...changes } : x)));

  const save = async () => {
    setSaving(true); setError(''); setWarnings([]);
    try {
      const sessions = rows.map((r) => ({ ...r, slotMinutes: Number(r.slotMinutes) }));
      const { data } = await api.put(`/doctors/${doctorId}/schedule`, { sessions });
      setWarnings(data.warnings ?? []);
      toast.success('Weekly schedule saved.');
      state.setData({ schedule: data.schedule, leaves: data.leaves });
    } catch (err) { setError(getError(err).message); }
    finally { setSaving(false); }
  };

  const addLeave = async (cancelAppointments = false) => {
    setLeaveBusy(true); setLeaveErrors({});
    try {
      const { data } = await api.post(`/doctors/${doctorId}/leaves`, clean({ ...leave, cancelAppointments }));
      toast.success(data.cancelledAppointments ? `Leave added. ${data.cancelledAppointments} appointment(s) cancelled and patients notified.` : 'Leave added.');
      setLeave({ startDate: todayStr(), endDate: todayStr(), reason: '' });
      state.reload({ silent: true });
    } catch (err) {
      const e = getError(err);
      if (e.code === 'APPOINTMENTS_EXIST') {
        const a = await confirm({ title: 'Cancel existing appointments?', message: `${e.message} Patients will be notified.`, confirmLabel: 'Cancel appointments and add leave', tone: 'danger' });
        if (a) { setLeaveBusy(false); return addLeave(true); }
      } else { toast.error(e.message); setLeaveErrors(fieldErrors(err)); }
    } finally { setLeaveBusy(false); }
  };

  const removeLeave = async (l) => {
    if (!(await confirm({ title: 'Remove this leave?', message: `${fmtDayMonth(l.startDate)} to ${fmtDayMonth(l.endDate)} will open for booking again.`, confirmLabel: 'Remove leave' }))) return;
    try { await api.delete(`/doctors/${doctorId}/leaves/${l.id}`); toast.success('Leave removed.'); state.reload({ silent: true }); }
    catch (err) { toast.error(getError(err).message); }
  };

  return (
    <>
      <PageHeader title="Schedule and leave" subtitle="Patients can only book inside these hours. Existing appointments are never moved by a schedule change." />
      <Async state={state}>
        {(d) => (
          <div className="stack">
            <Card title="Weekly working hours" actions={<Button icon={Save} loading={saving} onClick={save}>Save schedule</Button>}>
              <div className="stack">
                {error && <Alert tone="error">{error}</Alert>}
                {warnings.map((w) => <Alert key={w} tone="warning">{w}</Alert>)}
                {WEEKDAYS.map((name, wd) => {
                  const dayRows = rows.map((r, i) => ({ r, i })).filter((x) => x.r.weekday === wd);
                  return (
                    <div key={wd} className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
                      <div style={{ width: 110, paddingTop: 30, fontWeight: 600 }}>{name}</div>
                      <div className="stack-sm grow">
                        {dayRows.length === 0 && <div className="muted" style={{ paddingTop: 30 }}>Day off</div>}
                        {dayRows.map(({ r, i }) => (
                          <div key={i} className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <Input label="From" type="time" value={r.startTime} onChange={(e) => patch(i, { startTime: e.target.value })} />
                            <Input label="To" type="time" value={r.endTime} onChange={(e) => patch(i, { endTime: e.target.value })} />
                            <Input label="Minutes per slot" type="number" min={5} max={120} value={r.slotMinutes} onChange={(e) => patch(i, { slotMinutes: e.target.value })} style={{ width: 110 }} />
                            <Button variant="ghost" icon={Trash2} aria-label={`Remove ${name} session`} onClick={() => setRows((x) => x.filter((_, idx) => idx !== i))} />
                          </div>
                        ))}
                      </div>
                      <Button variant="outline" size="sm" icon={Plus} style={{ marginTop: 26 }} onClick={() => setRows((x) => [...x, blank(wd)])}>Add session</Button>
                    </div>
                  );
                })}
              </div>
            </Card>
            <div className="grid grid-2">
              <Card title="Add leave">
                <div className="stack">
                  <div className="form-grid">
                    <Input label="First day" type="date" min={todayStr()} value={leave.startDate} onChange={(e) => setLeave((l) => ({ ...l, startDate: e.target.value, endDate: l.endDate < e.target.value ? e.target.value : l.endDate }))} error={leaveErrors.startDate} />
                    <Input label="Last day" type="date" min={leave.startDate} max={addDaysStr(leave.startDate, 365)} value={leave.endDate} onChange={(e) => setLeave((l) => ({ ...l, endDate: e.target.value }))} error={leaveErrors.endDate} />
                  </div>
                  <Input label="Reason (optional)" value={leave.reason} maxLength={160} onChange={(e) => setLeave((l) => ({ ...l, reason: e.target.value }))} />
                  <Button variant="outline" icon={CalendarOff} loading={leaveBusy} onClick={() => addLeave(false)}>Add leave</Button>
                </div>
              </Card>
              <Card title="Upcoming leave" flush>
                {d.leaves.length === 0 ? <EmptyState icon={CalendarOff} title="No leave planned">Dates you add will block new bookings.</EmptyState> : (
                  <ul className="q-list">{d.leaves.map((l) => (
                    <li key={l.id} className="q-item"><div className="q-main"><div className="q-name">{fmtDayMonth(l.startDate)}{l.endDate !== l.startDate ? ` to ${fmtDayMonth(l.endDate)}` : ''}</div><div className="q-meta"><span>{l.reason || 'No reason given'}</span></div></div>
                      <Button variant="ghost" size="sm" icon={Trash2} onClick={() => removeLeave(l)}>Remove</Button></li>))}
                  </ul>
                )}
              </Card>
            </div>
            {d.schedule.length > 0 && <p className="small muted">Saved: {d.schedule.length} session(s). First: {WEEKDAYS[d.schedule[0].weekday]} {fmtTimeStr(d.schedule[0].startTime)}.</p>}
          </div>
        )}
      </Async>
    </>
  );
}
