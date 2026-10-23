import { useState } from 'react';
import { ArrowUpDown, DoorOpen, LogIn, SkipForward, UserX, Users } from 'lucide-react';
import { api, fieldErrors, getError } from '../../services/api.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useLive } from '../../hooks/useLive.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useConfirm } from '../../context/ConfirmContext.jsx';
import QueueRow from '../../components/queue/QueueRow.jsx';
import { Alert, Async, Badge, Button, Card, EmptyState, Input, LiveIndicator, Modal, PageHeader, Tabs, Textarea } from '../../components/ui/ui.jsx';
import { fmtDateStr } from '../../utils/format.js';

function ReorderModal({ entry, max, onClose, onDone }) {
  const [position, setPosition] = useState(1);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setErrors({});
    try { await api.post(`/queue/${entry.entryId}/reorder`, { position: Number(position), reason }); onDone(); }
    catch (err) { setError(getError(err).message); setErrors(fieldErrors(err)); setBusy(false); }
  };
  return (
    <Modal title={`Move ${entry.patient.fullName}`} onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="reorder-form" loading={busy}>Move patient</Button></>}>
      <form id="reorder-form" onSubmit={submit} className="stack" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Input label="New position in the waiting line" type="number" min={1} max={max} value={position} onChange={(e) => setPosition(e.target.value)} error={errors.position} hint={`1 means next to be called. There are ${max} waiting.`} />
        <Textarea label="Reason (saved in the audit log)" required value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} error={errors.reason} hint="For example: elderly patient or emergency." />
      </form>
    </Modal>
  );
}

function DoctorQueue({ doctor, date }) {
  const toast = useToast();
  const confirm = useConfirm();
  const state = useFetch(() => api.get(`/queue/doctor/${doctor.id}`, { params: { date } }).then((r) => r.data), [doctor.id, date]);
  const { connected } = useLive(state.reload, { doctorIds: [doctor.id] });
  const [moving, setMoving] = useState(null);

  const run = async (fn, ok) => {
    try { await fn(); toast.success(ok); } catch (err) { toast.error(getError(err).message); }
    state.reload({ silent: true });
  };
  const checkIn = (e) => run(() => api.post(`/queue/check-in/${e.appointmentId}`), `${e.patient.fullName} checked in.`);
  const seat = (e) => run(() => api.post(`/queue/${e.entryId}/seat`), `${e.patient.fullName} moved to the waiting area.`);
  const skip = async (e) => {
    const a = await confirm({ title: `Skip ${e.patient.fullName}?`, message: 'They move back in the line. A second skip marks them as a no-show.', confirmLabel: 'Skip', reason: { label: 'Reason', min: 3 } });
    if (a) run(() => api.post(`/queue/${e.entryId}/skip`, { reason: a.reason }), 'Patient skipped.');
  };
  const noShow = async (e) => {
    const a = await confirm({ title: `Mark ${e.patient.fullName} as no-show?`, message: 'The patient did not come or has left.', confirmLabel: 'Mark no-show', tone: 'danger', reason: { label: 'Reason', min: 3 } });
    if (a) run(() => api.post(`/queue/${e.entryId}/no-show`, { reason: a.reason }), 'Marked as no-show.');
  };

  return (
    <Async state={state}>
      {(q) => (
        <div className="stack">
          <div className="row-between"><div className="row"><Badge tone="teal">{q.doctorStatus === 'IN_CONSULTATION' ? 'In consultation' : q.doctorStatus === 'CALLING' ? 'Calling a patient' : q.doctorStatus === 'AVAILABLE' ? 'Ready' : 'Idle'}</Badge>
            <span className="small muted">Average consultation {q.avgConsultationMinutes ?? '-'} min</span></div><LiveIndicator connected={connected} /></div>
          {q.current && <Card title="With the doctor"><ul className="q-list" style={{ margin: 0, padding: 0, listStyle: 'none' }}><QueueRow item={q.current} showWait={false} highlight actions={q.current.status === 'CALLED' ? <Button size="sm" variant="outline" icon={UserX} onClick={() => noShow(q.current)}>No-show</Button> : null} /></ul></Card>}
          <Card title={`Waiting (${q.waiting.length})`} flush>
            {q.waiting.length === 0 ? <EmptyState icon={Users} title="Nobody waiting" /> : (
              <ul className="q-list">{q.waiting.map((e, i) => (
                <QueueRow key={e.entryId} item={e} position={i + 1} actions={<>
                  {e.status === 'CHECKED_IN' && <Button size="sm" variant="outline" icon={DoorOpen} onClick={() => seat(e)}>Seat</Button>}
                  {q.waiting.length > 1 && <Button size="sm" variant="outline" icon={ArrowUpDown} onClick={() => setMoving(e)}>Move</Button>}
                  <Button size="sm" variant="ghost" icon={SkipForward} onClick={() => skip(e)}>Skip</Button>
                  <Button size="sm" variant="ghost" icon={UserX} onClick={() => noShow(e)}>No-show</Button>
                </>} />))}
              </ul>
            )}
          </Card>
          <Card title={`Not arrived yet (${q.upcoming.length})`} flush>
            {q.upcoming.length === 0 ? <p className="muted" style={{ padding: 16 }}>Everyone with a booking has arrived or finished.</p> : (
              <ul className="q-list">{q.upcoming.map((e) => <QueueRow key={e.entryId} item={e} showWait={false} actions={<Button size="sm" icon={LogIn} onClick={() => checkIn(e)}>Check in</Button>} />)}</ul>
            )}
          </Card>
          <Card title={`Finished (${q.finished.length})`} flush>
            {q.finished.length === 0 ? <p className="muted" style={{ padding: 16 }}>No finished visits yet.</p> : <ul className="q-list">{q.finished.map((e) => <QueueRow key={e.entryId} item={e} showWait={false} />)}</ul>}
          </Card>
          {moving && <ReorderModal entry={moving} max={q.waiting.length} onClose={() => setMoving(null)} onDone={() => { setMoving(null); toast.success('Queue order updated.'); state.reload({ silent: true }); }} />}
        </div>
      )}
    </Async>
  );
}

export default function DailyQueue() {
  const overview = useFetch(() => api.get('/queue/overview').then((r) => r.data), []);
  useLive(overview.reload);
  const [doctorId, setDoctorId] = useState('');
  const doctors = overview.data?.doctors ?? [];
  const active = doctors.find((d) => d.id === doctorId) ?? doctors[0];
  return (
    <>
      <PageHeader title="Daily queue" subtitle={overview.data ? fmtDateStr(overview.data.date) : 'Today'} />
      <Async state={overview} isEmpty={(d) => d.doctors.length === 0} empty={<EmptyState icon={Users} title="No active doctors" />}>
        {() => (
          <div className="stack">
            <Tabs label="Doctors" value={active.id} onChange={setDoctorId} tabs={doctors.map((d) => ({ value: d.id, label: `${d.fullName} (${d.waiting + d.inProgress})` }))} />
            <DoctorQueue key={active.id} doctor={active} date={overview.data.date} />
          </div>
        )}
      </Async>
    </>
  );
}
