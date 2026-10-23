import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { api } from '../../services/api.js';
import { useFetch } from '../../hooks/useFetch.js';
import { Async, Badge, Card, EmptyState, Input, PageHeader, Pagination, Select } from '../../components/ui/ui.jsx';
import { fmtDateTime, ROLE_LABEL } from '../../utils/format.js';

const ENTITIES = ['User', 'Appointment', 'QueueEntry', 'Doctor', 'Specialization', 'ClinicSettings'];
const pretty = (s) => s.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export default function AuditLogs() {
  const [f, setF] = useState({ entityType: '', action: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setPage(1); };
  const state = useFetch(() => api.get('/admin/audit-logs', { params: { entityType: f.entityType || undefined, action: f.action.trim() || undefined, from: f.from || undefined, to: f.to || undefined, page, limit: 20 } }).then((r) => r.data), [f.entityType, f.action, f.from, f.to, page]);
  return (
    <>
      <PageHeader title="Audit log" subtitle="Who changed what, and when. Entries cannot be edited or deleted." />
      <Card flush>
        <div className="filters">
          <Select label="Type" value={f.entityType} onChange={set('entityType')}><option value="">All</option>{ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}</Select>
          <Input label="Action" value={f.action} onChange={set('action')} placeholder="For example APPOINTMENT_CANCELLED" />
          <Input label="From" type="date" max={f.to || undefined} value={f.from} onChange={set('from')} />
          <Input label="To" type="date" min={f.from || undefined} value={f.to} onChange={set('to')} />
        </div>
        <Async state={state} isEmpty={(d) => d.items.length === 0} empty={<EmptyState icon={ScrollText} title="No log entries">Nothing matches these filters.</EmptyState>}>
          {(d) => (<>
            <div className="table-wrap"><table className="table">
              <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col">Record</th><th scope="col">Details</th></tr></thead>
              <tbody>{d.items.map((x) => (
                <tr key={x.id}>
                  <td className="nowrap">{fmtDateTime(x.createdAt)}</td>
                  <td>{x.actor ? <>{x.actor.fullName}<div className="small muted">{ROLE_LABEL[x.actor.role]}</div></> : <span className="muted">System</span>}</td>
                  <td><Badge tone="blue" plain>{pretty(x.action)}</Badge></td>
                  <td>{x.entityType}{x.entityId && <div className="small muted code">{String(x.entityId).slice(0, 8)}</div>}</td>
                  <td className="small">{x.details ? <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(x.details)}</code> : '-'}</td>
                </tr>))}
              </tbody>
            </table></div>
            <Pagination meta={d.meta} onPage={setPage} noun="entries" />
          </>)}
        </Async>
      </Card>
    </>
  );
}
