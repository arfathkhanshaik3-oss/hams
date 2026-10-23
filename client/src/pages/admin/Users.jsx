import { useState } from 'react';
import { KeyRound, Pencil, Plus, UserCheck, UserX } from 'lucide-react';
import { api, clean, fieldErrors, getError } from '../../services/api.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useConfirm } from '../../context/ConfirmContext.jsx';
import { Alert, Async, Avatar, Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Pagination, Select } from '../../components/ui/ui.jsx';
import { ROLE_LABEL } from '../../utils/format.js';
import { compact, minLen, validEmail, validPassword, validPhone } from '../../utils/validators.js';

function UserModal({ user, onClose, onSaved }) {
  const toast = useToast();
  const editing = !!user;
  const [f, setF] = useState({ fullName: user?.fullName ?? '', email: user?.email ?? '', phone: user?.phone ?? '', role: 'RECEPTIONIST', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: '' })); };
  const submit = async (e) => {
    e.preventDefault();
    const errs = compact({ fullName: minLen(f.fullName, 2, 'Full name'), email: validEmail(f.email), phone: validPhone(f.phone, { optional: true }), ...(editing ? {} : { password: validPassword(f.password) }) });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setError('');
    try {
      if (editing) await api.patch(`/admin/users/${user.id}`, clean({ fullName: f.fullName, email: f.email, phone: f.phone }));
      else await api.post('/admin/users', clean(f));
      toast.success(editing ? 'User updated.' : 'User created.');
      onSaved();
    } catch (err) { setError(getError(err).message); setErrors(fieldErrors(err)); setBusy(false); }
  };
  return (
    <Modal title={editing ? `Edit ${user.fullName}` : 'Add a user'} onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="user-form" loading={busy}>{editing ? 'Save changes' : 'Create user'}</Button></>}>
      <form id="user-form" onSubmit={submit} noValidate className="stack">
        {error && <Alert tone="error">{error}</Alert>}
        <Input label="Full name" required value={f.fullName} onChange={set('fullName')} error={errors.fullName} />
        <Input label="Email" required type="email" value={f.email} onChange={set('email')} error={errors.email} />
        <Input label="Phone" type="tel" value={f.phone} onChange={set('phone')} error={errors.phone} />
        {!editing && <>
          <Select label="Role" required value={f.role} onChange={set('role')} error={errors.role} hint="Doctors are added in Doctors.">
            <option value="RECEPTIONIST">Receptionist</option><option value="ADMIN">Administrator</option><option value="PATIENT">Patient</option>
          </Select>
          <Input label="Temporary password" required type="password" autoComplete="new-password" value={f.password} onChange={set('password')} error={errors.password} hint="At least 8 characters with a letter and a number. The user should change it after logging in." />
        </>}
      </form>
    </Modal>
  );
}

function ResetModal({ user, onClose }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const msg = validPassword(password);
    if (msg) return setError(msg);
    setBusy(true);
    try { await api.post(`/admin/users/${user.id}/reset-password`, { password }); toast.success(`Password reset for ${user.fullName}.`); onClose(); }
    catch (err) { setError(getError(err).message); setBusy(false); }
  };
  return (
    <Modal title={`Reset password for ${user.fullName}`} onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="reset-form" loading={busy}>Reset password</Button></>}>
      <form id="reset-form" onSubmit={submit} noValidate className="stack">
        <Input label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} error={error} hint="Share the new password with the user directly. They can change it later from Profile." />
      </form>
    </Modal>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [f, setF] = useState({ search: '', role: '', isActive: '' });
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const q = useDebounce(f.search.trim(), 350);
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setPage(1); };
  const state = useFetch(() => api.get('/admin/users', { params: { search: q || undefined, role: f.role || undefined, isActive: f.isActive || undefined, page, limit: 15 } }).then((r) => r.data), [q, f.role, f.isActive, page]);

  const toggle = async (u) => {
    const next = !u.isActive;
    if (!next && !(await confirm({ title: `Deactivate ${u.fullName}?`, message: 'They will no longer be able to log in. Their records are kept.', confirmLabel: 'Deactivate', tone: 'danger' }))) return;
    try { await api.patch(`/admin/users/${u.id}/status`, { isActive: next }); toast.success(next ? 'User activated.' : 'User deactivated.'); state.reload({ silent: true }); }
    catch (err) { toast.error(getError(err).message); }
  };

  return (
    <>
      <PageHeader title="Users" subtitle="Everyone who can log in to the system." actions={<Button icon={Plus} onClick={() => setModal({ type: 'edit' })}>Add user</Button>} />
      <Card flush>
        <div className="filters">
          <Input label="Search" type="search" value={f.search} onChange={set('search')} placeholder="Name, email or phone" />
          <Select label="Role" value={f.role} onChange={set('role')}><option value="">All roles</option>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
          <Select label="Status" value={f.isActive} onChange={set('isActive')}><option value="">All</option><option value="true">Active</option><option value="false">Inactive</option></Select>
        </div>
        <Async state={state} isEmpty={(d) => d.items.length === 0} empty={<EmptyState title="No users found">Try changing the filters.</EmptyState>}>
          {(d) => (<>
            <div className="table-wrap"><table className="table">
              <thead><tr><th scope="col">User</th><th scope="col">Role</th><th scope="col">Phone</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>{d.items.map((u) => (
                <tr key={u.id}>
                  <td><div className="row"><Avatar name={u.fullName} size="sm" /><div><b>{u.fullName}</b>{u.id === me.id && <> <Badge tone="blue" plain>You</Badge></>}<div className="small muted">{u.email ?? 'No email (walk-in)'}</div></div></div></td>
                  <td>{ROLE_LABEL[u.role]}</td><td>{u.phone || '-'}</td>
                  <td><Badge tone={u.isActive ? 'green' : 'gray'}>{u.isActive ? 'Active' : 'Inactive'}</Badge></td>
                  <td><div className="actions">
                    {u.role !== 'DOCTOR' && <Button size="sm" variant="outline" icon={Pencil} onClick={() => setModal({ type: 'edit', user: u })}>Edit</Button>}
                    <Button size="sm" variant="outline" icon={KeyRound} onClick={() => setModal({ type: 'reset', user: u })}>Reset password</Button>
                    {u.id !== me.id && <Button size="sm" variant="ghost" icon={u.isActive ? UserX : UserCheck} onClick={() => toggle(u)}>{u.isActive ? 'Deactivate' : 'Activate'}</Button>}
                  </div></td>
                </tr>))}
              </tbody>
            </table></div>
            <Pagination meta={d.meta} onPage={setPage} noun="users" />
          </>)}
        </Async>
      </Card>
      {modal?.type === 'edit' && <UserModal user={modal.user} onClose={() => setModal(null)} onSaved={() => { setModal(null); state.reload({ silent: true }); }} />}
      {modal?.type === 'reset' && <ResetModal user={modal.user} onClose={() => setModal(null)} />}
    </>
  );
}
