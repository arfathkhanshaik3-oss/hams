import { useState } from 'react';
import { Download } from 'lucide-react';
import { api } from '../../services/api.js';
import { useFetch } from '../../hooks/useFetch.js';
import { SimpleBars, TrendChart, WaitChart, WorkloadChart } from '../../components/charts/charts.jsx';
import { Alert, Async, Button, Card, EmptyState, Input, PageHeader, StatCard, Tabs } from '../../components/ui/ui.jsx';
import { fmtDayMonth, ROLE_LABEL, addDaysStr, todayStr } from '../../utils/format.js';
import { CalendarCheck, CheckCircle2, Clock, UserX } from 'lucide-react';

function csv(rows, name) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const text = rows.map((r) => r.map(esc).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [range, setRange] = useState({ from: addDaysStr(todayStr(), -29), to: todayStr() });
  const [tab, setTab] = useState('trends');
  const params = { from: range.from, to: range.to };
  const valid = range.from && range.to && range.from <= range.to;
  const trends = useFetch(() => api.get('/reports/trends', { params }).then((r) => r.data), [range.from, range.to], { enabled: valid });
  const workload = useFetch(() => api.get('/reports/workload', { params }).then((r) => r.data), [range.from, range.to], { enabled: valid });
  const waits = useFetch(() => api.get('/reports/waiting-times', { params }).then((r) => r.data), [range.from, range.to], { enabled: valid });
  const cancels = useFetch(() => api.get('/reports/cancellations', { params }).then((r) => r.data), [range.from, range.to], { enabled: valid });

  return (
    <>
      <PageHeader title="Reports" subtitle="Calculated from real appointments and queue records in the chosen period." />
      <Card>
        <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Input label="From" type="date" max={range.to} value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
          <Input label="To" type="date" min={range.from} max={todayStr()} value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
          <Button variant="outline" onClick={() => setRange({ from: addDaysStr(todayStr(), -6), to: todayStr() })}>Last 7 days</Button>
          <Button variant="outline" onClick={() => setRange({ from: addDaysStr(todayStr(), -29), to: todayStr() })}>Last 30 days</Button>
        </div>
        {!valid && <div style={{ marginTop: 12 }}><Alert tone="error">Choose a start date that is on or before the end date.</Alert></div>}
      </Card>
      <div style={{ marginTop: 16 }}>
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'trends', label: 'Appointments' }, { value: 'workload', label: 'Doctor workload' }, { value: 'waits', label: 'Waiting times' }, { value: 'cancels', label: 'Cancellations' }]} />
      </div>
      <div style={{ marginTop: 16 }}>
        {tab === 'trends' && (
          <Async state={trends}>{(d) => (
            <div className="stack">
              <div className="grid grid-4">
                <StatCard icon={CalendarCheck} tone="blue" label="Total appointments" value={d.totals.total} />
                <StatCard icon={CheckCircle2} tone="green" label="Completed" value={d.totals.completed} />
                <StatCard icon={UserX} tone="red" label="Cancelled" value={d.totals.cancelled} />
                <StatCard icon={UserX} tone="amber" label="No-shows" value={d.totals.noShow} />
              </div>
              <Card title="Appointments per day" actions={<Button size="sm" variant="outline" icon={Download} onClick={() => csv([['Date', 'Total', 'Completed', 'Cancelled', 'No-show'], ...d.days.map((x) => [x.date, x.total, x.completed, x.cancelled, x.noShow])], `appointments-${d.from}-to-${d.to}.csv`)}>Download CSV</Button>}>
                <TrendChart days={d.days} />
              </Card>
            </div>)}</Async>
        )}
        {tab === 'workload' && (
          <Async state={workload} isEmpty={(d) => d.doctors.length === 0} empty={<EmptyState title="No doctors" />}>{(d) => (
            <div className="stack">
              <Card title="Appointments per doctor"><WorkloadChart rows={d.doctors} /></Card>
              <Card flush title="Details" actions={<Button size="sm" variant="outline" icon={Download} onClick={() => csv([['Doctor', 'Specialization', 'Total', 'Completed', 'Cancelled', 'No-show', 'Avg consultation (min)'], ...d.doctors.map((x) => [x.fullName, x.specialization, x.total, x.completed, x.cancelled, x.noShow, x.avgConsultationMinutes])], `workload-${d.from}-to-${d.to}.csv`)}>Download CSV</Button>}>
                <div className="table-wrap"><table className="table">
                  <thead><tr><th scope="col">Doctor</th><th scope="col">Total</th><th scope="col">Completed</th><th scope="col">Cancelled</th><th scope="col">No-show</th><th scope="col">Avg consultation</th></tr></thead>
                  <tbody>{d.doctors.map((x) => <tr key={x.doctorId}><td><b>{x.fullName}</b><div className="small muted">{x.specialization}</div></td><td className="num">{x.total}</td><td className="num">{x.completed}</td><td className="num">{x.cancelled}</td><td className="num">{x.noShow}</td><td>{x.avgConsultationMinutes != null ? `${x.avgConsultationMinutes} min` : '-'}</td></tr>)}</tbody>
                </table></div>
              </Card>
            </div>)}</Async>
        )}
        {tab === 'waits' && (
          <Async state={waits}>{(d) => (
            <div className="stack">
              <div className="grid grid-3">
                <StatCard icon={Clock} tone="blue" label="Average wait (check-in to called)" value={d.overallAvgWaitMinutes != null ? `${d.overallAvgWaitMinutes} min` : '-'} note={`${d.samples} visits measured`} />
              </div>
              {d.samples === 0 ? <Card><EmptyState icon={Clock} title="No waiting-time data">Waiting time is measured when a patient is checked in and then called. It appears after a few visits.</EmptyState></Card> : (
                <>
                  <Card title="Average wait per day"><WaitChart days={d.perDay.filter((x) => x.samples > 0)} /></Card>
                  <Card title="Average wait per doctor"><SimpleBars name="Minutes" data={d.perDoctor.map((x) => ({ label: x.fullName.replace(/^Dr\.?\s+/, ''), value: x.avgWaitMinutes }))} /></Card>
                </>)}
            </div>)}</Async>
        )}
        {tab === 'cancels' && (
          <Async state={cancels}>{(d) => (
            <div className="stack">
              <div className="grid grid-3">
                <StatCard icon={UserX} tone="red" label="Cancelled" value={d.totalCancelled} />
                <StatCard icon={CheckCircle2} tone="green" label="Completed" value={d.totalCompleted} />
                <StatCard icon={CalendarCheck} tone="blue" label="Cancellation rate" value={d.totalCancelled + d.totalCompleted > 0 ? `${Math.round((d.totalCancelled / (d.totalCancelled + d.totalCompleted)) * 100)}%` : '-'} note="Cancelled / (cancelled + completed)" />
              </div>
              <div className="grid grid-2">
                <Card title="Cancelled per day"><SimpleBars name="Cancelled" color="#c0392b" data={d.byDay.map((x) => ({ label: fmtDayMonth(x.date), value: x.count }))} /></Card>
                <Card title="Cancelled by">{d.byRole.length === 0 ? <EmptyState title="No cancellations">Nothing was cancelled in this period.</EmptyState> : <SimpleBars name="Cancelled" data={d.byRole.map((x) => ({ label: ROLE_LABEL[x.role] ?? 'System', value: x.count }))} />}</Card>
              </div>
              <Card title="Recent cancellations" flush>
                {d.recent.length === 0 ? <p className="muted" style={{ padding: 16 }}>None in this period.</p> : (
                  <div className="table-wrap"><table className="table">
                    <thead><tr><th scope="col">Reference</th><th scope="col">Date</th><th scope="col">Doctor</th><th scope="col">Cancelled by</th><th scope="col">Reason</th></tr></thead>
                    <tbody>{d.recent.map((x) => <tr key={x.reference}><td className="code">{x.reference}</td><td>{fmtDayMonth(x.date)}</td><td>{x.doctor}</td><td>{ROLE_LABEL[x.cancelledByRole] ?? 'System'}</td><td>{x.reason || '-'}</td></tr>)}</tbody>
                  </table></div>)}
              </Card>
            </div>)}</Async>
        )}
      </div>
    </>
  );
}
