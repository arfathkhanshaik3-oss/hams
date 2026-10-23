import { Link } from 'react-router-dom';
import { CalendarCheck, CheckCircle2, Hourglass, UserX, Users, Timer } from 'lucide-react';
import { api } from '../../services/api.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useLive } from '../../hooks/useLive.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { TrendChart } from '../../components/charts/charts.jsx';
import { Async, Card, EmptyState, LiveIndicator, PageHeader, StatCard, StatusBadge, Token } from '../../components/ui/ui.jsx';
import { fmtTime } from '../../utils/format.js';

export default function DoctorDashboard() {
  const { user } = useAuth();
  const state = useFetch(() => api.get('/dashboard/doctor').then((r) => r.data), []);
  const { connected } = useLive(state.reload, { doctorIds: [user.doctor?.id] });
  return (
    <>
      <PageHeader title={`Good day, ${user.fullName}`} subtitle="Your clinic today."
        actions={<><LiveIndicator connected={connected} /><Link to="/doctor/queue" className="btn btn-primary">Open queue</Link></>} />
      <Async state={state}>
        {(d) => (
          <div className="stack">
            <div className="grid grid-4">
              <StatCard icon={CalendarCheck} tone="blue" label="Appointments today" value={d.counts.total} />
              <StatCard icon={Hourglass} tone="amber" label="Waiting now" value={d.counts.waiting} />
              <StatCard icon={CheckCircle2} tone="green" label="Completed" value={d.counts.completed} />
              <StatCard icon={UserX} tone="red" label="No-shows" value={d.counts.noShow} />
            </div>
            <div className="grid grid-2">
              <Card title="Current patient">
                {d.current ? (
                  <div className="row"><Token number={d.current.queueNumber} tone="violet" /><div className="grow"><b>{d.current.patient.fullName}</b><div className="small muted">{d.current.reasonForVisit || 'No reason given'}</div></div><StatusBadge status={d.current.status} /></div>
                ) : d.nextWaiting ? (
                  <div className="row"><Token number={d.nextWaiting.queueNumber} tone="amber" label="Next" /><div className="grow"><b>{d.nextWaiting.patient.fullName}</b><div className="small muted">Waiting. Go to the queue to call them.</div></div></div>
                ) : <p className="muted">No one is in consultation or waiting.</p>}
                <div className="row small muted" style={{ marginTop: 12 }}><Timer size={14} aria-hidden="true" />{d.avgConsultationMinutes ? `Your average consultation is ${d.avgConsultationMinutes} min.` : 'Average consultation time will appear after a few visits.'}</div>
              </Card>
              <Card title="Next appointments" flush actions={<Link to="/doctor/today" className="small">See all</Link>}>
                {d.nextAppointments.length === 0 ? <EmptyState icon={Users} title="Nothing more scheduled">All of today's active appointments are done.</EmptyState> : (
                  <ul className="q-list">{d.nextAppointments.map((a) => (
                    <li key={a.id} className="q-item"><Token number={a.queue?.queueNumber} tone="light" />
                      <div className="q-main"><Link to={`/doctor/appointments/${a.id}`} className="q-name">{a.patient.fullName}</Link><div className="q-meta"><span>{fmtTime(a.startsAt)}</span></div></div><StatusBadge status={a.status} /></li>))}
                  </ul>
                )}
              </Card>
            </div>
            <Card title="Last 7 days"><TrendChart days={d.trend} height={240} /></Card>
          </div>
        )}
      </Async>
    </>
  );
}
