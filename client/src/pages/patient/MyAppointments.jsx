import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarX } from 'lucide-react';
import { api } from '../../services/api.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useLive } from '../../hooks/useLive.js';
import AppointmentTable from '../../components/AppointmentTable.jsx';
import { Async, Card, EmptyState, Input, PageHeader, Pagination, Tabs } from '../../components/ui/ui.jsx';

const TABS = {
  upcoming: { label: 'Upcoming', params: { scope: 'upcoming', sort: 'startsAt', order: 'asc' } },
  past: { label: 'Previous', params: { status: 'COMPLETED', sort: 'startsAt', order: 'desc' } },
  cancelled: { label: 'Cancelled and missed', params: { status: 'CANCELLED,NO_SHOW', sort: 'startsAt', order: 'desc' } },
};

export default function MyAppointments() {
  const [tab, setTab] = useState('upcoming');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const q = useDebounce(search.trim(), 350);
  const state = useFetch(() => api.get('/appointments', { params: { ...TABS[tab].params, page, limit: 10, search: q || undefined } }).then((r) => r.data), [tab, page, q]);
  useLive(state.reload);

  return (
    <>
      <PageHeader title="My appointments" subtitle="Everything you have booked, in one list."
        actions={<Link to="/patient/book" className="btn btn-primary">Book appointment</Link>} />
      <Card flush>
        <div style={{ padding: '0 12px' }}><Tabs value={tab} onChange={(t) => { setTab(t); setPage(1); }} tabs={Object.entries(TABS).map(([value, t]) => ({ value, label: t.label }))} /></div>
        <div className="filters"><Input wrapperClass="search" label="Search" type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Reference or doctor name" /></div>
        <Async state={state} isEmpty={(d) => d.items.length === 0}
          empty={<EmptyState icon={CalendarX} title={q ? 'No appointments match your search' : tab === 'upcoming' ? 'No upcoming appointments' : 'Nothing here yet'}
            action={tab === 'upcoming' && !q ? <Link to="/patient/book" className="btn btn-primary">Book your first appointment</Link> : null}>
            {tab === 'upcoming' ? 'When you book a visit it will show up here.' : 'Appointments move here once they are finished.'}</EmptyState>}>
          {(d) => (<><AppointmentTable items={d.items} viewer="PATIENT" base="/patient" /><Pagination meta={d.meta} onPage={setPage} noun="appointments" /></>)}
        </Async>
      </Card>
    </>
  );
}
