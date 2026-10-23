import { useState } from 'react';
import { CalendarX } from 'lucide-react';
import { api } from '../../services/api.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useLive } from '../../hooks/useLive.js';
import { useAuth } from '../../context/AuthContext.jsx';
import AppointmentTable from '../../components/AppointmentTable.jsx';
import { Async, Card, EmptyState, Input, PageHeader, Pagination, Select } from '../../components/ui/ui.jsx';
import { STATUS, todayStr } from '../../utils/format.js';

export default function TodayAppointments() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayStr());
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const state = useFetch(() => api.get('/appointments', { params: { date, status: status || undefined, page, limit: 15, sort: 'startsAt', order: 'asc' } }).then((r) => r.data), [date, status, page]);
  useLive(state.reload, { doctorIds: [user.doctor?.id] });
  return (
    <>
      <PageHeader title="Appointments" subtitle="Your appointments for the chosen day." />
      <Card flush>
        <div className="filters">
          <Input label="Date" type="date" value={date} onChange={(e) => { setDate(e.target.value || todayStr()); setPage(1); }} />
          <Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </div>
        <Async state={state} isEmpty={(d) => d.items.length === 0} empty={<EmptyState icon={CalendarX} title="No appointments">Nothing matches this day and status.</EmptyState>}>
          {(d) => (<><AppointmentTable items={d.items} viewer="DOCTOR" base="/doctor" /><Pagination meta={d.meta} onPage={setPage} noun="appointments" /></>)}
        </Async>
      </Card>
    </>
  );
}
