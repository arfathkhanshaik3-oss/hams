import { useState } from 'react';
import { Stethoscope } from 'lucide-react';
import { api } from '../../services/api.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import DoctorCard from '../../components/DoctorCard.jsx';
import { Async, Button, EmptyState, Input, PageHeader, Pagination, Select } from '../../components/ui/ui.jsx';
import { addDaysStr, todayStr } from '../../utils/format.js';
import { useSettings } from '../../context/SettingsContext.jsx';

// Used twice: the public directory (/doctors) and inside the patient area (/patient/doctors)
export default function DoctorDirectory({ mode }) {
  const { settings } = useSettings();
  const [search, setSearch] = useState('');
  const [spec, setSpec] = useState('');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounce(search.trim(), 350);
  const specs = useFetch(() => api.get('/specializations').then((r) => r.data.items), []);
  const state = useFetch(
    () => api.get('/doctors', { params: { search: q || undefined, specializationId: spec || undefined, availableOn: date || undefined, page, limit: 9 } }).then((r) => r.data),
    [q, spec, date, page],
  );
  const prefix = mode === 'patient' ? '/patient' : '';
  const reset = () => { setSearch(''); setSpec(''); setDate(''); setPage(1); };
  const filtered = q || spec || date;

  const body = (
    <>
      <PageHeader title="Find a doctor" subtitle="Search by name or specialization, or choose a date to see who has free times." />
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="filters" style={{ borderBottom: 0 }}>
          <Input wrapperClass="search" label="Search" type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Doctor name or specialization" />
          <Select label="Specialization" value={spec} onChange={(e) => { setSpec(e.target.value); setPage(1); }}>
            <option value="">All specializations</option>
            {specs.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Input label="Available on" type="date" value={date} min={todayStr()} max={addDaysStr(todayStr(), settings.maxAdvanceBookingDays)} onChange={(e) => { setDate(e.target.value); setPage(1); }} />
          {filtered && <Button variant="ghost" onClick={reset}>Clear filters</Button>}
        </div>
      </div>
      <Async state={state} isEmpty={(d) => d.items.length === 0}
        empty={<div className="card"><EmptyState icon={Stethoscope} title="No doctors match" action={filtered ? <Button variant="outline" onClick={reset}>Clear filters</Button> : null}>Try a different name or specialization, or pick another date.</EmptyState></div>}>
        {(d) => (
          <>
            <div className="grid grid-3">{d.items.map((doc) => <DoctorCard key={doc.id} doctor={doc} detailsTo={`${prefix}/doctors/${doc.id}`} bookTo={`/patient/book/${doc.id}${date ? `?date=${date}` : ''}`} />)}</div>
            <div className="card" style={{ marginTop: 20 }}><Pagination meta={d.meta} onPage={setPage} noun="doctors" /></div>
          </>
        )}
      </Async>
    </>
  );
  return mode === 'public' ? <div className="pub-wrap section">{body}</div> : body;
}
