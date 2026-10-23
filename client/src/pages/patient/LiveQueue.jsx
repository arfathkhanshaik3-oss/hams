import { Link, useNavigate, useParams } from 'react-router-dom';
import { Clock, DoorOpen, Hourglass, Users } from 'lucide-react';
import { api } from '../../services/api.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useLive } from '../../hooks/useLive.js';
import { Alert, Async, Card, EmptyState, ErrorState, LiveIndicator, PageHeader, StatusBadge, Token } from '../../components/ui/ui.jsx';
import { fmtDate, fmtTime, minutesLabel, todayStr } from '../../utils/format.js';

const DOCTOR_STATUS = {
  IN_CONSULTATION: 'The doctor is with a patient',
  CALLING: 'The doctor is calling the next patient',
  AVAILABLE: 'The doctor is ready for the next patient',
  IDLE: 'No patients are waiting right now',
};

function Tracker({ id }) {
  const state = useFetch(() => api.get(`/queue/my-status/${id}`).then((r) => r.data), [id]);
  const s = state.data;
  const { connected } = useLive(state.reload, { doctorIds: [s?.doctor.id] });
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (!s) return <Async state={state}>{() => null}</Async>;

  const done = ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(s.appointmentStatus);
  const present = ['CHECKED_IN', 'WAITING'].includes(s.appointmentStatus);
  const turn = ['CALLED', 'IN_CONSULTATION'].includes(s.appointmentStatus);

  let headline;
  if (!s.live && !done) headline = `Live tracking opens on the day of your appointment (${fmtDate(s.startsAt)}).`;
  else if (s.appointmentStatus === 'CALLED') headline = `It's your turn. Please go to ${s.doctor.room ? `room ${s.doctor.room}` : "the doctor's room"} now.`;
  else if (s.appointmentStatus === 'IN_CONSULTATION') headline = 'Your consultation is in progress.';
  else if (present) headline = s.position === 1 ? 'You are next.' : `There ${s.position - 1 === 1 ? 'is 1 person' : `are ${s.position - 1} people`} ahead of you.`;
  else if (['BOOKED', 'CONFIRMED'].includes(s.appointmentStatus)) headline = `Not checked in yet. Please check in at reception when you arrive (your slot is ${fmtTime(s.startsAt)}).`;
  else if (s.appointmentStatus === 'COMPLETED') headline = 'Your consultation is complete. Thank you for visiting.';
  else if (s.appointmentStatus === 'CANCELLED') headline = 'This appointment was cancelled.';
  else headline = 'This appointment was marked as a no-show. Please speak to reception.';

  return (
    <div className="stack">
      <div className="board" role="region" aria-label="Your place in the queue" aria-live="polite">
        <Token number={s.queueNumber} size="xl" label="Your number" tone={s.appointmentStatus === 'CALLED' ? 'violet' : 'dark'} />
        <div>
          <div className="board-title">{headline}</div>
          <div className="board-meta">
            <span>With {s.doctor.fullName}</span>{s.doctor.room && <span>Room {s.doctor.room}</span>}<StatusBadge status={s.appointmentStatus} />
          </div>
          {s.live && !done && (
            <div className="board-meta" style={{ marginTop: 18 }}>
              <span>Now serving<b>{s.nowServing != null ? `#${s.nowServing}` : '-'}</b></span>
              <span>{s.projected ? 'Your place if you arrive now' : 'Your position'}<b>{s.position != null ? (s.position === 0 ? 'Your turn' : s.position) : '-'}</b></span>
              <span>Waiting in total<b>{s.patientsWaiting}</b></span>
              <span>Estimated wait<b>{s.estimatedWaitMinutes != null ? (s.estimatedWaitMinutes === 0 ? 'No wait' : `about ${minutesLabel(s.estimatedWaitMinutes)}`) : '-'}</b></span>
            </div>
          )}
        </div>
      </div>
      <div className="row-between">
        <LiveIndicator connected={connected} />
        <span className="small muted">Updated {fmtTime(s.updatedAt)}</span>
      </div>
      {s.live && !done && (
        <div className="grid grid-3">
          <Card><div className="row"><Users size={18} aria-hidden="true" /><div><div className="small muted">Doctor status</div><b>{DOCTOR_STATUS[s.doctorStatus] ?? '-'}</b></div></div></Card>
          <Card><div className="row"><Clock size={18} aria-hidden="true" /><div><div className="small muted">Average consultation</div><b>{s.avgConsultationMinutes ? `${s.avgConsultationMinutes} min` : '-'}</b></div></div></Card>
          <Card><div className="row"><DoorOpen size={18} aria-hidden="true" /><div><div className="small muted">Your slot</div><b>{fmtTime(s.startsAt)}</b></div></div></Card>
        </div>
      )}
      {s.live && !done && <Alert tone="info"><Hourglass size={0} aria-hidden="true" /><b>This is an estimate, not a guaranteed time.</b> {s.estimateNote} If you arrive late, patients who arrived on time are seen first.</Alert>}
      <Link to={`/patient/appointments/${s.appointmentId}`} className="small">View appointment details ({s.reference})</Link>
    </div>
  );
}

export default function LiveQueue() {
  const { id } = useParams();
  const navigate = useNavigate();
  // With no id in the address we look for today's active appointments
  const list = useFetch(() => api.get('/appointments', { params: { date: todayStr(), status: 'BOOKED,CONFIRMED,CHECKED_IN,WAITING,CALLED,IN_CONSULTATION', limit: 10, sort: 'startsAt', order: 'asc' } }).then((r) => r.data.items), [], { enabled: !id });
  useLive(list.reload, { doctorIds: [] });

  let body;
  if (id) body = <Tracker id={id} />;
  else if (list.loading && !list.data) body = <Async state={list}>{() => null}</Async>;
  else if (list.error) body = <ErrorState error={list.error} onRetry={list.reload} />;
  else if (list.data.length === 0) {
    body = <Card><EmptyState icon={Hourglass} title="No appointment today" action={<Link to="/patient/book" className="btn btn-primary">Book an appointment</Link>}>The live queue appears here on the day of your visit. You can also open it from My appointments.</EmptyState></Card>;
  } else if (list.data.length === 1) body = <Tracker id={list.data[0].id} />;
  else {
    body = (
      <Card title="Choose an appointment to track" flush>
        <ul className="q-list">
          {list.data.map((a) => (
            <li key={a.id} className="q-item">
              <Token number={a.queue?.queueNumber} tone="light" />
              <div className="q-main"><div className="q-name">{a.doctor.fullName}</div><div className="q-meta"><span>{fmtTime(a.startsAt)}</span><span>{a.doctor.specialization}</span></div></div>
              <StatusBadge status={a.status} />
              <button className="btn btn-primary btn-sm" onClick={() => navigate(`/patient/queue/${a.id}`)}>Track</button>
            </li>
          ))}
        </ul>
      </Card>
    );
  }
  return (<><PageHeader title="Live queue" subtitle="Follow your turn without waiting in the corridor." />{body}</>);
}
