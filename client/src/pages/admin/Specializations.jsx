import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api, clean, fieldErrors, getError } from '../../services/api.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useConfirm } from '../../context/ConfirmContext.jsx';
import { Alert, Async, Button, Card, EmptyState, Input, Modal, PageHeader, Textarea } from '../../components/ui/ui.jsx';

function SpecModal({ item, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({ name: item?.name ?? '', description: item?.description ?? '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (f.name.trim().length < 2) return setErrors({ name: 'Name must be at least 2 characters' });
    setBusy(true); setError(''); setErrors({});
    try {
      if (item) await api.patch(`/specializations/${item.id}`, { name: f.name, description: f.description });
      else await api.post('/specializations', clean(f));
      toast.success(item ? 'Specialization updated.' : 'Specialization added.');
      onSaved();
    } catch (err) { setError(getError(err).message); setErrors(fieldErrors(err)); setBusy(false); }
  };
  return (
    <Modal title={item ? 'Edit specialization' : 'Add specialization'} onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="spec-form" loading={busy}>Save</Button></>}>
      <form id="spec-form" onSubmit={submit} noValidate className="stack">
        {error && <Alert tone="error">{error}</Alert>}
        <Input label="Name" required value={f.name} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} error={errors.name} />
        <Textarea label="Description" value={f.description} maxLength={300} onChange={(e) => setF({ ...f, description: e.target.value })} error={errors.description} />
      </form>
    </Modal>
  );
}

export default function Specializations() {
  const toast = useToast();
  const confirm = useConfirm();
  const state = useFetch(() => api.get('/specializations').then((r) => r.data.items), []);
  const [modal, setModal] = useState(null);
  const remove = async (s) => {
    if (!(await confirm({ title: `Delete ${s.name}?`, message: 'This cannot be undone. It only works if no doctor uses it.', confirmLabel: 'Delete', tone: 'danger' }))) return;
    try { await api.delete(`/specializations/${s.id}`); toast.success('Specialization deleted.'); state.reload({ silent: true }); }
    catch (err) { toast.error(getError(err).message); }
  };
  return (
    <>
      <PageHeader title="Specializations" subtitle="Departments patients can filter doctors by." actions={<Button icon={Plus} onClick={() => setModal({})}>Add specialization</Button>} />
      <Card flush>
        <Async state={state} isEmpty={(d) => d.length === 0} empty={<EmptyState title="No specializations yet">Add one so doctors can be created.</EmptyState>}>
          {(items) => (
            <div className="table-wrap"><table className="table">
              <thead><tr><th scope="col">Name</th><th scope="col">Description</th><th scope="col">Doctors</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>{items.map((s) => (
                <tr key={s.id}><td><b>{s.name}</b></td><td>{s.description || '-'}</td><td className="num">{s.doctorCount}</td>
                  <td><div className="actions"><Button size="sm" variant="outline" icon={Pencil} onClick={() => setModal({ item: s })}>Edit</Button><Button size="sm" variant="ghost" icon={Trash2} onClick={() => remove(s)}>Delete</Button></div></td></tr>))}
              </tbody>
            </table></div>
          )}
        </Async>
      </Card>
      {modal && <SpecModal item={modal.item} onClose={() => setModal(null)} onSaved={() => { setModal(null); state.reload({ silent: true }); }} />}
    </>
  );
}
