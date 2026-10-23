import { useState } from 'react';
import { CalendarClock, Pencil, Plus, UserCheck, UserX } from 'lucide-react';
import { api, clean, fieldErrors, getError } from '../../services/api.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useConfirm } from '../../context/ConfirmContext.jsx';
import ScheduleManagement from '../doctor/ScheduleManagement.jsx';
import { Alert, Async, Avatar, Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Pagination, Select, Textarea } from '../../components/ui/ui.jsx';
import { money } from '../../utils/format.js';
import { compact, minLen, validEmail, validPassword, validPhone } from '../../utils/validators.js';

function DoctorModal({ doctor, specs, onClose, onSaved }) {
  const toast = useToast();
  const editing = !!doctor;
  const [f, setF] = useState({
    fullName: doctor?.fullName ?? '', email: doctor?.email ?? '', password: '', phone: doctor?.phone ?? '', specializationId: doctor?.specialization.id ?? '',
    consultationFee: doctor?.consultationFee ?? 500, consultationMinutes: doctor?.consultationMinutes ?? 15, experienceYears: doctor?.experienceYears ?? 0,
    qualification: doctor?.qualification ?? '', room: doctor?.room ?? '', bio: doctor?.bio ?? '',
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: '' })); };
  const submit = async (e) => {
    e.preventDefault();
    const errs = compact({
      fullName: minLen(f.fullName, 2, 'Full name'), email: validEmail(f.email), phone: validPhone(f.phone, { optional: true }),
      specializationId: f.specializationId ? '' : 'Choose a specialization',
      consultationFee: Number(f.consultationFee) >= 0 ? '' : 'Fee cannot be negative',
      consultationMinutes: Number(f.consultationMinutes) >= 5 && Number(f.consultationMinutes) <= 120 ? '' : 'Between 5 and 120 minutes',
      ...(editing ? {} : { password: validPassword(f.password) }),
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setError('');
    try {
      const body = { ...f, consultationFee: Number(f.consultationFee), consultationMinutes: Number(f.consultationMinutes), experienceYears: Number(f.experienceYears) };
      if (editing) { delete body.password; await api.patch(`/doctors/${doctor.id}`, clean(body)); }
      else await api.post('/doctors', clean(body));
      toast.success(editing ? 'Doctor updated.' : 'Doctor created. Set their weekly schedule next.');
      onSaved();
    } catch (err) { setError(getError(err).message); setErrors(fieldErrors(err)); setBusy(false); }
  };
  return (
    <Modal size="lg" title={editing ? `Edit ${doctor.fullName}` : 'Add a doctor'} onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="doctor-form" loading={busy}>{editing ? 'Save changes' : 'Create doctor'}</Button></>}>
      <form id="doctor-form" onSubmit={submit} noValidate className="stack">
        {error && <Alert tone="error">{error}</Alert>}
        <div className="form-grid">
          <Input label="Full name" required value={f.fullName} onChange={set('fullName')} error={errors.fullName} hint="Include Dr., for example Dr. Meera Nair" />
          <Select label="Specialization" required value={f.specializationId} onChange={set('specializationId')} error={errors.specializationId}>
            <option value="">Select</option>{specs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Input label="Email" required type="email" value={f.email} onChange={set('email')} error={errors.email} />
          {!editing && <Input label="Temporary password" required type="password" autoComplete="new-password" value={f.password} onChange={set('password')} error={errors.password} />}
          <Input label="Phone" type="tel" value={f.phone} onChange={set('phone')} error={errors.phone} />
          <Input label="Room" value={f.room} onChange={set('room')} error={errors.room} />
          <Input label="Consultation fee" type="number" min={0} value={f.consultationFee} onChange={set('consultationFee')} error={errors.consultationFee} />
          <Input label="Minutes per consultation" type="number" min={5} max={120} value={f.consultationMinutes} onChange={set('consultationMinutes')} error={errors.consultationMinutes} />
          <Input label="Years of experience" type="number" min={0} max={70} value={f.experienceYears} onChange={set('experienceYears')} error={errors.experienceYears} />
          <Input label="Qualification" value={f.qualification} onChange={set('qualification')} error={errors.qualification} />
        </div>
        <Textarea label="Short bio (shown to patients)" value={f.bio} maxLength={1000} onChange={set('bio')} error={errors.bio} />
      </form>
    </Modal>
  );
}

export default function DoctorsAdmin() {
  const toast = useToast();
  const confirm = useConfirm();
  const [f, setF] = useState({ search: '', status: '', specializationId: '' });
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const q = useDebounce(f.search.trim(), 350);
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setPage(1); };
  const specs = useFetch(() => api.get('/specializations').then((r) => r.data.items), []);
  const state = useFetch(() => api.get('/admin/doctors', { params: { search: q || undefined, status: f.status || undefined, specializationId: f.specializationId || undefined, page, limit: 10 } }).then((r) => r.data), [q, f.status, f.specializationId, page]);

  const toggle = async (d) => {
    const next = !d.isActive;
    if (!next && !(await confirm({ title: `Deactivate ${d.fullName}?`, message: 'They disappear from the directory and cannot log in or be booked. Existing appointments are kept.', confirmLabel: 'Deactivate', tone: 'danger' }))) return;
    try { await api.patch(`/doctors/${d.id}/status`, { isActive: next }); toast.success(next ? 'Doctor activated.' : 'Doctor deactivated.'); state.reload({ silent: true }); }
    catch (err) { toast.error(getError(err).message); }
  };

  return (
    <>
      <PageHeader title="Doctors" subtitle="Add doctors, update their details and manage their working hours." actions={<Button icon={Plus} disabled={!specs.data?.length} onClick={() => setModal({ type: 'edit' })}>Add doctor</Button>} />
      {specs.data?.length === 0 && <div style={{ marginBottom: 16 }}><Alert tone="warn">Add a specialization first. Doctors need one.</Alert></div>}
      <Card flush>
        <div className="filters">
          <Input label="Search" type="search" value={f.search} onChange={set('search')} placeholder="Name, email or room" />
          <Select label="Specialization" value={f.specializationId} onChange={set('specializationId')}><option value="">All</option>{specs.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
          <Select label="Status" value={f.status} onChange={set('status')}><option value="">All</option><option value="active">Active</option><option value="inactive">Inactive</option></Select>
        </div>
        <Async state={state} isEmpty={(d) => d.items.length === 0} empty={<EmptyState title="No doctors found">Try different filters or add a doctor.</EmptyState>}>
          {(d) => (<>
            <div className="table-wrap"><table className="table">
              <thead><tr><th scope="col">Doctor</th><th scope="col">Specialization</th><th scope="col">Fee</th><th scope="col">Room</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>{d.items.map((x) => (
                <tr key={x.id}>
                  <td><div className="row"><Avatar name={x.fullName} size="sm" /><div><b>{x.fullName}</b><div className="small muted">{x.email}</div></div></div></td>
                  <td>{x.specialization.name}</td><td>{money(x.consultationFee)}</td><td>{x.room || '-'}</td>
                  <td><Badge tone={x.isActive ? 'green' : 'gray'}>{x.isActive ? 'Active' : 'Inactive'}</Badge>{x.schedule.length === 0 && <> <Badge tone="amber" plain>No schedule</Badge></>}</td>
                  <td><div className="actions">
                    <Button size="sm" variant="outline" icon={Pencil} onClick={() => setModal({ type: 'edit', doctor: x })}>Edit</Button>
                    <Button size="sm" variant="outline" icon={CalendarClock} onClick={() => setModal({ type: 'schedule', doctor: x })}>Schedule</Button>
                    <Button size="sm" variant="ghost" icon={x.isActive ? UserX : UserCheck} onClick={() => toggle(x)}>{x.isActive ? 'Deactivate' : 'Activate'}</Button>
                  </div></td>
                </tr>))}
              </tbody>
            </table></div>
            <Pagination meta={d.meta} onPage={setPage} noun="doctors" />
          </>)}
        </Async>
      </Card>
      {modal?.type === 'edit' && <DoctorModal doctor={modal.doctor} specs={specs.data ?? []} onClose={() => setModal(null)} onSaved={() => { setModal(null); state.reload({ silent: true }); }} />}
      {modal?.type === 'schedule' && (
        <Modal size="lg" title={`Schedule: ${modal.doctor.fullName}`} onClose={() => { setModal(null); state.reload({ silent: true }); }}>
          <ScheduleManagement doctorId={modal.doctor.id} />
        </Modal>
      )}
    </>
  );
}
