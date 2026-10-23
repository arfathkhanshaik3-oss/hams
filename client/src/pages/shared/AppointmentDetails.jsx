import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, CheckCircle2, Play, Ticket, UserCheck, UserX, XCircle } from 'lucide-react';
import { api, getError } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useConfirm } from '../../context/ConfirmContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { useLive } from '../../hooks/useLive.js';
import RescheduleModal from '../../components/RescheduleModal.jsx';
import { Alert, Async, Badge, Button, Card, DescriptionList, LiveIndicator, StatusBadge, Token } from '../../components/ui/ui.jsx';
import { ROLE_HOME, fmtDate, fmtDateStr, fmtDateTime, fmtTime, isToday, money, statusLabel } from '../../utils/format.js';

const CANCELLABLE = {
  PATIENT: ['BOOKED', 'CONFIRMED'],
  DOCTOR: ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'WAITING'],
  RECEPTIONIST: ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'WAITING', 'CALLED'],
  ADMIN: ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'WAITING', 'CALLED'],
};

function QueueTimeline({ a }) {
  const q = a.queue;
  if (!q || a.status === 'CANCELLED') return null;
  const steps = [
    { label: 'Booked', at: a.createdAt, done: true },
    { label: 'Checked in at reception', at: q.checkedInAt, done: !!q.checkedInAt },
    { label: 'Called by the doctor', at: q.calledAt, done: !!q.calledAt },
    { label: 'Consultation started', at: q.startedAt, done: !!q.startedAt },
    { label: 'Completed', at: q.completedAt, done: !!q.completedAt },
  ];
  const nowIndex = steps.findIndex((s) => !s.done);
  return (
    <Card title="Progress">
      <ol className="timeline">
        {steps.map((s, i) => (
          <li key={s.label} className={s.done ? 'done' : i === nowIndex && !['NO_SHOW'].includes(a.status) ? 'now' : ''}>
            <div style={{ fontWeight: 600 }}>{s.label}</div>
            <div className="small muted">{s.at ? fmtDateTime(s.at) : i === nowIndex ? 'Next step' : 'Pending'}</div>
          </li>
        ))}
      </ol>
      {a.status === 'NO_SHOW' && <Alert tone="error">This appointment was marked as a no-show.</Alert>}
    </Card>
  );
}

export default function AppointmentDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const base = ROLE_HOME[user.role];
  const state = useFetch(() => api.get(`/appointments/${id}`).then((r) => r.data.appointment), [id]);
  const { connected } = useLive(state.reload, { doctorIds: [state.data?.doctor.id] });
  const [busy, setBusy] = useState('');
  const [resched, setResched] = useState(false);
  const a = state.data;

  const run = async (key, fn, successMessage, title) => {
    setBusy(key);
    try {
      await fn();
      toast.success(successMessage, title);
      await state.reload({ silent: true });
    } catch (err) {
      toast.error(getError(err).message);
      state.reload({ silent: true });
    } finally { setBusy(''); }
  };

  const cancel = async () => {
    const needsReason = user.role !== 'PATIENT';
    const answer = await confirm({
      title: 'Cancel this appointment?',
      message: user.role === 'PATIENT' ? 'Your time will be released for other patients. You can book again at any time.' : 'The patient is notified and the slot is released.',
      confirmLabel: 'Cancel appointment', cancelLabel: 'Keep appointment', tone: 'danger',
      reason: needsReason ? { label: 'Reason for cancelling', min: 3 } : undefined,
    });
    if (!answer) return;
    const request = user.role === 'DOCTOR'
      ? () => api.patch(`/appointments/${id}/status`, { status: 'CANCELLED', reason: answer.reason })
      : () => api.post(`/appointments/${id}/cancel`, { reason: answer.reason });
    run('cancel', request, 'The appointment was cancelled.', 'Cancelled');
  };
  const noShow = async () => {
    const answer = await confirm({ title: 'Mark as no-show?', message: 'Use this when the patient did not arrive. The slot becomes free again.', confirmLabel: 'Mark no-show', tone: 'danger', reason: { label: 'Reason', min: 3 } });
    if (answer) run('noshow', () => api.post(`/queue/${a.queue.id}/no-show`, { reason: answer.reason }), 'Marked as a no-show.', 'Updated');
  };

  return (
    <Async state={state}>
      {(ap) => {
        const canCancel = CANCELLABLE[user.role]?.includes(ap.status);
        const canResched = ['PATIENT', 'RECEPTIONIST'].includes(user.role) && ['BOOKED', 'CONFIRMED'].includes(ap.status);
        const canCheckIn = user.role === 'RECEPTIONIST' && ['BOOKED', 'CONFIRMED'].includes(ap.status) && isToday(ap.startsAt);
        const canNoShow = ['RECEPTIONIST'].includes(user.role) && ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'WAITING', 'CALLED'].includes(ap.status) && ap.queue;
        const open = ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'WAITING', 'CALLED', 'IN_CONSULTATION'].includes(ap.status);
        return (
          <div className="stack">
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => navigate(-1)}><ArrowLeft size={16} aria-hidden="true" />Back</button>
            <div className="page-head" style={{ marginBottom: 0 }}>
              <div className="row" style={{ gap: 16 }}>
                {ap.queue && <Token number={ap.queue.queueNumber} tone={ap.status === 'CALLED' ? 'violet' : 'dark'} size="lg" />}
                <div>
                  <h1>Appointment <span className="code" style={{ fontSize: '1rem' }}>{ap.reference}</span></h1>
                  <div className="row" style={{ marginTop: 8 }}><StatusBadge status={ap.status} />{ap.type === 'WALK_IN' && <Badge tone="blue" plain>Walk-in</Badge>}{ap.type === 'STAFF_BOOKED' && <Badge tone="slate" plain>Booked by clinic staff</Badge>}<LiveIndicator connected={connected} /></div>
                </div>
              </div>
              <div className="row">
                {user.role === 'PATIENT' && open && isToday(ap.startsAt) && <Link className="btn btn-teal" to={`/patient/queue/${ap.id}`}><Ticket size={16} aria-hidden="true" />Track live queue</Link>}
                {canCheckIn && <Button variant="teal" icon={UserCheck} loading={busy === 'checkin'} onClick={() => run('checkin', () => api.post(`/queue/check-in/${ap.id}`), 'The patient is checked in and in the queue.', 'Checked in')}>Check in</Button>}
                {user.role === 'DOCTOR' && ap.status === 'BOOKED' && <Button variant="outline" icon={CheckCircle2} loading={busy === 'confirm'} onClick={() => run('confirm', () => api.patch(`/appointments/${ap.id}/status`, { status: 'CONFIRMED' }), 'The patient has been told it is confirmed.', 'Confirmed')}>Confirm</Button>}
                {user.role === 'DOCTOR' && ap.status === 'CALLED' && <Button icon={Play} loading={busy === 'start'} onClick={() => run('start', () => api.patch(`/appointments/${ap.id}/status`, { status: 'IN_CONSULTATION' }), 'Consultation started.', 'In consultation')}>Start consultation</Button>}
                {user.role === 'DOCTOR' && ap.status === 'IN_CONSULTATION' && <Button variant="teal" icon={CheckCircle2} loading={busy === 'done'} onClick={() => run('done', () => api.patch(`/appointments/${ap.id}/status`, { status: 'COMPLETED' }), 'Consultation completed.', 'Completed')}>Complete consultation</Button>}
                {canResched && <Button variant="outline" icon={CalendarClock} onClick={() => setResched(true)}>Reschedule</Button>}
                {canNoShow && <Button variant="outline" icon={UserX} loading={busy === 'noshow'} onClick={noShow}>No-show</Button>}
                {canCancel && <Button variant="danger-outline" icon={XCircle} loading={busy === 'cancel'} onClick={cancel}>Cancel</Button>}
              </div>
            </div>

            {ap.status === 'CALLED' && user.role === 'PATIENT' && <Alert tone="ok"><b>It is your turn.</b> Please go to {ap.doctor.room ? `room ${ap.doctor.room}` : "the doctor's room"} now.</Alert>}
            {ap.status === 'CANCELLED' && <Alert tone="warn">Cancelled{ap.cancelReason ? `. Reason: ${ap.cancelReason}` : '.'}</Alert>}
            {user.role === 'PATIENT' && ['BOOKED', 'CONFIRMED'].includes(ap.status) && <Alert tone="info">Please arrive about 10 minutes early and tell reception your reference number.</Alert>}

            <div className="grid grid-main">
              <div className="stack">
                <Card title="Visit">
                  <DescriptionList items={[
                    { label: 'Date', value: fmtDate(ap.startsAt) },
                    { label: 'Time', value: `${fmtTime(ap.startsAt)} to ${fmtTime(ap.endsAt)}` },
                    { label: 'Doctor', value: <>{ap.doctor.fullName} <span className="muted">({ap.doctor.specialization})</span></> },
                    { label: 'Room', value: ap.doctor.room },
                    { label: 'Consultation fee', value: money(ap.doctor.consultationFee) },
                    { label: 'Reason for visit', value: ap.reasonForVisit },
                    { label: 'Queue number', value: ap.queue ? `#${ap.queue.queueNumber}` : undefined },
                    { label: 'Reschedules', value: ap.rescheduleCount ? `${ap.rescheduleCount} time(s)` : undefined },
                    { label: 'Booked on', value: fmtDateTime(ap.createdAt) },
                  ]} />
                </Card>
                {user.role !== 'PATIENT' && (
                  <Card title="Patient">
                    <DescriptionList items={[
                      { label: 'Name', value: ap.patient.fullName },
                      { label: 'Phone', value: ap.patient.phone },
                      { label: 'Age', value: ap.patient.age != null ? `${ap.patient.age} years` : undefined },
                      { label: 'Gender', value: ap.patient.gender ? ap.patient.gender.toLowerCase() : undefined },
                      { label: 'Email', value: user.role === 'DOCTOR' ? undefined : ap.patient.email },
                      { label: 'Address', value: user.role === 'DOCTOR' ? undefined : ap.patient.address },
                      { label: 'Emergency contact', value: user.role === 'DOCTOR' ? undefined : ap.patient.emergencyContact },
                    ]} />
                    {user.role === 'DOCTOR' && <p className="small muted" style={{ marginTop: 12 }}>You see only the details needed for the consultation.</p>}
                  </Card>
                )}
              </div>
              <QueueTimeline a={ap} />
            </div>
            <p className="small muted">Status: {statusLabel(ap.status)}. {ap.appointmentDate && `Queue day ${fmtDateStr(ap.appointmentDate)}.`}</p>
            {resched && <RescheduleModal appointment={ap} onClose={() => setResched(false)} onDone={() => { setResched(false); state.reload({ silent: true }); }} />}
          </div>
        );
      }}
    </Async>
  );
}
