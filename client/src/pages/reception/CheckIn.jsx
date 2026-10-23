import { useState } from 'react';
import { LogIn, UserCheck } from 'lucide-react';
import { api, getError } from '../../services/api.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useLive } from '../../hooks/useLive.js';
import { useToast } from '../../context/ToastContext.jsx';
import AppointmentTable from '../../components/AppointmentTable.jsx';
import { Async, Button, Card, EmptyState, Input, PageHeader, Select } from '../../components/ui/ui.jsx';
import { todayStr } from '../../utils/format.js';

export default function CheckIn() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [busyId, setBusyId] = useState('');
  const q = useDebounce(search.trim(), 300);
  const docs = useFetch(() => api.get('/doctors', { params: { limit: 50 } }).then((r) => r.data.items), []);
  const state = useFetch(() => api.get('/appointments', { params: { date: todayStr(), status: 'BOOKED,CONFIRMED', search: q || undefined, doctorId: doctorId || undefined, limit: 50, sort: 'startsAt', order: 'asc' } }).then((r) => r.data), [q, doctorId]);
  useLive(state.reload);

  const checkIn = async (a) => {
    setBusyId(a.id);
    try {
      const { data } = await api.post(`/queue/check-in/${a.id}`);
      toast.success(`${a.patient.fullName} checked in. Queue number ${a.queue?.queueNumber ?? ''}${data.isLate ? ' (arrived late, placed after on-time patients)' : ''}.`);
      state.reload({ silent: true });
    } catch (err) { toast.error(getError(err).message); state.reload({ silent: true }); }
    finally { setBusyId(''); }
  };

  return (
    <>
      <PageHeader title="Patient check-in" subtitle="Find today's appointment by reference, name or phone, then check the patient in." />
      <Card flush>
        <div className="filters">
          <Input label="Search" type="search" autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Reference, name or phone" />
          <Select label="Doctor" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            <option value="">All doctors</option>{docs.data?.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}
          </Select>
        </div>
        <Async state={state} isEmpty={(d) => d.items.length === 0} empty={<EmptyState icon={UserCheck} title="No one left to check in">Today's booked appointments that are not checked in yet appear here. Walk-ins use Walk-in registration.</EmptyState>}>
          {(d) => <AppointmentTable items={d.items} viewer="RECEPTIONIST" base="/reception"
            extra={(a) => <Button size="sm" icon={LogIn} loading={busyId === a.id} onClick={() => checkIn(a)}>Check in</Button>} />}
        </Async>
      </Card>
    </>
  );
}
