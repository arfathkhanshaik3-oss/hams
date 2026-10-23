import { Link } from 'react-router-dom';
import { Bell, CalendarCheck, CalendarX, CheckCircle2, Search, Ticket } from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { useLive } from '../../hooks/useLive.js';
import { Async, Card, EmptyState, PageHeader, StatCard, StatusBadge, Token } from '../../components/ui/ui.jsx';
import { fmtDate, fmtTime } from '../../utils/format.js';

export default function PatientDashboard() {
  const { user } = useAuth();
  const state = useFetch(() => api.get('/dashboard/patient').then((r) => r.data), []);
  const { connected } = useLive(state.reload, { doctorIds: [state.data?.today?.doctor.id] });
  void connected;

  return (
    <>
      <PageHeader title={`Hello, ${user.fullName.split(' ')[0]}`} subtitle="Your appointments and today's queue at a glance."
        actions={<><Link to="/patient/doctors" className="btn btn-outline"><Search size={16} aria-hidden="true" />Find doctors</Link><Link to="/patient/book" className="btn btn-primary"><CalendarCheck size={16} aria-hidden="true" />Book appointment</Link></>} />
      <Async state={state}>
        {(d) => (
          <div className="stack">
            {d.today && (
              <div className="board" role="region" aria-label="Today's appointment">
                <Token number={d.today.queue?.queueNumber} size="lg" tone={d.today.status === 'CALLED' ? 'violet' : 'dark'} label="Your number" />
                <div>
                  <div className="board-title">{d.today.status === 'CALLED' ? "It's your turn. Please go to the doctor's room." : `You have a visit today at ${fmtTime(d.today.startsAt)}`}</div>
                  <div className="board-meta"><span>{d.today.doctor.fullName}</span><span>{d.today.doctor.room ? `Room ${d.today.doctor.room}` : ''}</span><StatusBadge status={d.today.status} /></div>
                  <div style={{ marginTop: 16 }}><Link to={`/patient/queue/${d.today.id}`} className="btn btn-teal"><Ticket size={16} aria-hidden="true" />Track live queue</Link></div>
                </div>
              </div>
            )}
            <div className="grid grid-4">
              <StatCard icon={CalendarCheck} tone="blue" label="Upcoming" value={d.counts.upcoming} />
              <StatCard icon={CheckCircle2} tone="green" label="Completed visits" value={d.counts.completed} />
              <StatCard icon={CalendarX} tone="red" label="Cancelled" value={d.counts.cancelled} />
              <StatCard icon={Bell} tone="amber" label="Unread notifications" value={d.unreadNotifications} />
            </div>
            <Card title="Next appointments" actions={<Link to="/patient/appointments" className="small">See all</Link>} flush>
              {d.upcoming.length === 0 ? (
                <EmptyState icon={CalendarX} title="No upcoming appointments" action={<Link to="/patient/book" className="btn btn-primary">Book an appointment</Link>}>Choose a doctor and a time that suits you.</EmptyState>
              ) : (
                <ul className="q-list">
                  {d.upcoming.map((a) => (
                    <li key={a.id} className="q-item">
                      <Token number={a.queue?.queueNumber} tone="light" />
                      <div className="q-main">
                        <Link to={`/patient/appointments/${a.id}`} className="q-name">{a.doctor.fullName}</Link>
                        <div className="q-meta"><span>{fmtDate(a.startsAt)}</span><span>{fmtTime(a.startsAt)}</span><span>{a.doctor.specialization}</span></div>
                      </div>
                      <StatusBadge status={a.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </Async>
    </>
  );
}
