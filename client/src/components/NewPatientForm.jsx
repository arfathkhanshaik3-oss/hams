import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { api, clean, fieldErrors, getError } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { todayStr } from '../utils/format.js';
import { compact, minLen, validPhone } from '../utils/validators.js';
import { Alert, Button, Input, Select } from './ui/ui.jsx';

/** Receptionist registers a person who has no account yet. Calls onCreated(patient). */
export default function NewPatientForm({ onCreated, onCancel }) {
  const toast = useToast();
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', dateOfBirth: '', gender: '', address: '', emergencyContact: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: '' })); };

  const submit = async (e) => {
    e.preventDefault();
    const errs = compact({ fullName: minLen(form.fullName, 2, 'Full name'), phone: validPhone(form.phone) });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setFormError('');
    try {
      const { data } = await api.post('/patients', clean(form));
      toast.success(`${data.patient.fullName} registered.`);
      onCreated(data.patient);
    } catch (err) { setFormError(getError(err).message); setErrors(fieldErrors(err)); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} noValidate className="stack">
      {formError && <Alert tone="error">{formError}</Alert>}
      <div className="form-grid">
        <Input label="Full name" required value={form.fullName} onChange={set('fullName')} error={errors.fullName} autoComplete="off" />
        <Input label="Phone number" required type="tel" value={form.phone} onChange={set('phone')} error={errors.phone} />
        <Input label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} hint="Optional. Leave empty if the patient has none." />
        <Input label="Date of birth" type="date" max={todayStr()} value={form.dateOfBirth} onChange={set('dateOfBirth')} error={errors.dateOfBirth} />
        <Select label="Gender" value={form.gender} onChange={set('gender')} error={errors.gender}>
          <option value="">Prefer not to say</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="OTHER">Other</option>
        </Select>
        <Input label="Emergency contact" value={form.emergencyContact} onChange={set('emergencyContact')} error={errors.emergencyContact} />
      </div>
      <Input label="Address" value={form.address} onChange={set('address')} error={errors.address} />
      <div className="row">
        <Button type="submit" icon={UserPlus} loading={busy}>Register patient</Button>
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}
