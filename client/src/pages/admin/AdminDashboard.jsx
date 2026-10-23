import { Link } from 'react-router-dom';
import { CalendarCheck, CheckCircle2, Clock, Hourglass, Stethoscope, UserX, Users } from 'lucide-react';
import { api } from '../../services/api.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useLive } from '../../hooks/useLive.js';
import { SimpleBars, TrendChart, WorkloadChart } from '../../components/charts/charts.jsx';
import { Async, Card, EmptyState, LiveIndicator, PageHeader, StatCard } from '../../components/ui/ui.jsx';
import { fmtDateStr, statusLabel } from '../../utils/format.js';

export default function AdminDashboard() {
  const state = useFetch(() => api.get('/dashboard/admin').then((r) => r.data), []);
  const { connected } = useLive(state.reload);
  return (
    <>
      <PageHeader title="Administration" subtitle={state.data ? `Clinic overview for ${fmtDateStr(state.data.date)}` : 'Clinic overview'}
        actions={<><LiveIndicator connected={connected} /><Link to="/admin/reports" className="btn btn-outline">Reports</Link></>} />
      <Async state={state}>
        {(d) => (
          <div className="stack">
            <div className="grid grid-4">
              <StatCard icon={Users} tone="blue" label="Registered patients" value={d.totals.patients} />
              <StatCard icon={Stethoscope} tone="teal" label="Active doctors" value={d.totals.activeDoctors} />
              <StatCard icon={CalendarCheck} tone="violet" label="Appointments today" value={d.totals.todayAppointments} />
              <StatCard icon={CheckCircle2} tone="green" label="Completed today" value={d.totals.completedToday} />
              <StatCard icon={Hourglass} tone="amber" label="Waiting now" value={d.totals.waitingNow} />
              <StatCard icon={Stethoscope} tone="violet" label="In consultation" value={d.totals.inConsultationNow} />
              <StatCard icon={UserX} tone="red" label="Cancelled / no-show today" value={`${d.totals.cancelledToday} / ${d.totals.noShowToday}`} />
              <StatCard icon={Clock} tone="blue" label="Average wait today" value={d.avgWaitMinutesToday != null ? `${d.avgWaitMinutesToday} min` : '-'} note={d.avgWaitMinutes30d != null ? `${d.avgWaitMinutes30d} min over 30 days (${d.waitSamples30d} visits)` : 'No data yet'} />
            </div>
            <Card title="Appointments in the last 7 days"><TrendChart days={d.trend} /></Card>
            <div className="grid grid-2">
              <Card title="Doctor workload today">
                {d.workloadToday.length === 0 ? <EmptyState title="No doctors yet" /> : <WorkloadChart rows={d.workloadToday} height={220} />}
              </Card>
              <Card title="Queue activity today">
                {d.queueActivityToday.length === 0 ? <EmptyState title="No activity yet">Numbers appear when patients are booked or checked in.</EmptyState>
                  : <SimpleBars data={d.queueActivityToday.map((x) => ({ label: statusLabel(x.status), value: x.count }))} />}
              </Card>
            </div>
          </div>
        )}
      </Async>
    </>
  );
}
