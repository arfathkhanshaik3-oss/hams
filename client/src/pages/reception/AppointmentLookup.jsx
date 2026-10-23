import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { api } from '../../services/api.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import AppointmentTable from '../../components/AppointmentTable.jsx';
import { Async, Card, EmptyState, Input, PageHeader, Pagination, Select } from '../../components/ui/ui.jsx';
import { STATUS } from '../../utils/format.js';

/** Search every appointment. Used by receptionists (base /reception) and admins (base /admin). */
export default function AppointmentLookup({ base = '/reception', viewer = 'RECEPTIONIST', title = 'Appointment lookup' }) {
  const [f, setF] = useState({ search: '', status: '', doctorId: '', from: '', to: '', type: '' });
  const [page, setPage] = useState(1);
  const q = useDebounce(f.search.trim(), 350);
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setPage(1); };
  const docs = useFetch(() => api.get('/doctors', { params: { limit: 50 } }).then((r) => r.data.items), []);
  const state = useFetch(() => api.get('/appointments', { params: { search: q || undefined, status: f.status || undefined, doctorId: f.doctorId || undefined, from: f.from || undefined, to: f.to || undefined, type: f.type || undefined, page, limit: 15, sort: 'startsAt', order: 'desc' } }).then((r) => r.data), [q, f.status, f.doctorId, f.from, f.to, f.type, page]);
  return (
    <>
      <PageHeader title={title} subtitle="Find an appointment by reference, patient name or phone." actions={viewer === 'RECEPTIONIST' && <Link to="/reception/book" className="btn btn-primary">Book for a patient</Link>} />
      <Card flush>
        <div className="filters">
          <Input label="Search" type="search" value={f.search} onChange={set('search')} placeholder="Reference, name or phone" />
          <Select label="Status" value={f.status} onChange={set('status')}><option value="">All</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
          <Select label="Doctor" value={f.doctorId} onChange={set('doctorId')}><option value="">All</option>{docs.data?.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}</Select>
          <Select label="Type" value={f.type} onChange={set('type')}><option value="">All</option><option value="ONLINE">Online</option><option value="STAFF_BOOKED">Booked by staff</option><option value="WALK_IN">Walk-in</option></Select>
          <Input label="From" type="date" value={f.from} max={f.to || undefined} onChange={set('from')} />
          <Input label="To" type="date" value={f.to} min={f.from || undefined} onChange={set('to')} />
        </div>
        <Async state={state} isEmpty={(d) => d.items.length === 0} empty={<EmptyState icon={SearchX} title="No appointments found">Try a different reference, name or date range.</EmptyState>}>
          {(d) => (<><AppointmentTable items={d.items} viewer={viewer} base={base} /><Pagination meta={d.meta} onPage={setPage} noun="appointments" /></>)}
        </Async>
      </Card>
    </>
  );
}
