import { Link } from 'react-router-dom';
import { CalendarCheck, CheckCircle2, Footprints, Hourglass, Stethoscope, UserCheck } from 'lucide-react';
import { api } from '../../services/api.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useLive } from '../../hooks/useLive.js';
import { Async, Card, LiveIndicator, PageHeader, StatCard } from '../../components/ui/ui.jsx';
import { fmtDateStr } from '../../utils/format.js';

export default function ReceptionDashboard() {
  const state = useFetch(() => api.get('/dashboard/receptionist').then((r) => r.data), []);
  const { connected } = useLive(state.reload);
  return (
    <>
      <PageHeader title="Front desk" subtitle={state.data ? `Today, ${fmtDateStr(state.data.date)}` : 'Today'}
        actions={<><LiveIndicator connected={connected} /><Link to="/reception/check-in" className="btn btn-outline"><UserCheck size={16} aria-hidden="true" />Check in</Link><Link to="/reception/walk-in" className="btn btn-primary"><Footprints size={16} aria-hidden="true" />Walk-in</Link></>} />
      <Async state={state}>
        {(d) => (
          <div className="stack">
            <div className="grid grid-4">
              <StatCard icon={CalendarCheck} tone="blue" label="Appointments today" value={d.totals.appointments} note={`${d.totals.walkIns} walk-in`} />
              <StatCard icon={UserCheck} tone="teal" label="Still to arrive" value={d.totals.expectedToArrive} />
              <StatCard icon={Hourglass} tone="amber" label="Waiting now" value={d.totals.waiting} />
              <StatCard icon={Stethoscope} tone="violet" label="In consultation" value={d.totals.inProgress} />
              <StatCard icon={CheckCircle2} tone="green" label="Completed" value={d.totals.completed} />
              <StatCard icon={UserCheck} tone="blue" label="Arrivals" value={d.totals.arrivals} />
              <StatCard icon={CalendarCheck} tone="red" label="Cancelled" value={d.totals.cancelled} />
              <StatCard icon={CalendarCheck} tone="red" label="No-shows" value={d.totals.noShow} />
            </div>
            <Card title="Doctors today" flush actions={<Link to="/reception/queue" className="small">Open daily queue</Link>}>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th scope="col">Doctor</th><th scope="col">Room</th><th scope="col">Now serving</th><th scope="col">Waiting</th><th scope="col">Expected</th><th scope="col">Done</th><th scope="col">Total</th></tr></thead>
                  <tbody>{d.doctors.map((x) => (
                    <tr key={x.id}><td><b>{x.fullName}</b><div className="small muted">{x.specialization}</div></td><td>{x.room || '-'}</td>
                      <td>{x.nowServing != null ? <span className="num">#{x.nowServing}</span> : '-'}</td><td className="num">{x.waiting}</td><td className="num">{x.upcoming}</td><td className="num">{x.completed}</td><td className="num">{x.total}</td></tr>))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </Async>
    </>
  );
}
