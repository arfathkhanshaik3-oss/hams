import { useEffect, useState } from 'react';
import { KeyRound, Save } from 'lucide-react';
import { api, clean, fieldErrors, getError } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Alert, Avatar, Badge, Button, Card, DescriptionList, Input, PageHeader, Select, Textarea } from '../../components/ui/ui.jsx';
import { ROLE_LABEL, money, todayStr } from '../../utils/format.js';
import { compact, minLen, validPassword, validPhone } from '../../utils/validators.js';

function PasswordCard() {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: '' })); };
  const submit = async (e) => {
    e.preventDefault();
    const errs = compact({ currentPassword: form.currentPassword ? '' : 'Enter your current password', newPassword: validPassword(form.newPassword), confirm: form.confirm === form.newPassword ? '' : 'Passwords do not match' });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await api.post('/profile/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast.success('Your password was changed.', 'Password updated');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(getError(err).message);
    } finally { setBusy(false); }
  };
  return (
    <Card title="Change password">
      <form onSubmit={submit} noValidate className="stack" style={{ maxWidth: 420 }}>
        <Input label="Current password" type="password" autoComplete="current-password" value={form.currentPassword} onChange={set('currentPassword')} error={errors.currentPassword} />
        <Input label="New password" type="password" autoComplete="new-password" value={form.newPassword} onChange={set('newPassword')} error={errors.newPassword} hint="At least 8 characters with a letter and a number." />
        <Input label="Confirm new password" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
        <Button type="submit" icon={KeyRound} loading={busy} style={{ alignSelf: 'flex-start' }}>Update password</Button>
      </form>
    </Card>
  );
}

export default function Profile() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const isPatient = user.role === 'PATIENT';
  const isDoctor = user.role === 'DOCTOR';
  const init = () => ({
    fullName: user.fullName ?? '', phone: user.phone ?? '',
    dateOfBirth: user.patient?.dateOfBirth ?? '', gender: user.patient?.gender ?? '', address: user.patient?.address ?? '', emergencyContact: user.patient?.emergencyContact ?? '',
    bio: user.doctor?.bio ?? '', qualification: user.doctor?.qualification ?? '',
  });
  const [form, setForm] = useState(init);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { setForm(init()); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: '' })); };

  const submit = async (e) => {
    e.preventDefault();
    const errs = compact({ fullName: minLen(form.fullName, 2, 'Full name'), phone: validPhone(form.phone, { optional: !isPatient }) });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const body = { fullName: form.fullName, phone: form.phone };
      if (isPatient) Object.assign(body, { dateOfBirth: form.dateOfBirth, gender: form.gender, address: form.address, emergencyContact: form.emergencyContact });
      if (isDoctor) Object.assign(body, { bio: form.bio, qualification: form.qualification });
      await api.patch('/profile', clean(body));
      await refresh();
      toast.success('Your profile was saved.', 'Saved');
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(getError(err).message);
    } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="My profile" subtitle="Keep your details up to date so the clinic can reach you." />
      <div className="stack">
        <div className="card card-pad row" style={{ gap: 18 }}>
          <Avatar name={user.fullName} size="lg" />
          <div><h2>{user.fullName}</h2><div className="muted">{user.email}</div><div style={{ marginTop: 6 }}><Badge tone="teal" plain>{ROLE_LABEL[user.role]}</Badge></div></div>
        </div>
        <Card title="Personal details">
          <form onSubmit={submit} noValidate className="stack">
            <div className="form-grid">
              <Input label="Full name" value={form.fullName} onChange={set('fullName')} error={errors.fullName} required />
              <Input label="Phone number" type="tel" value={form.phone} onChange={set('phone')} error={errors.phone} required={isPatient} />
              <Input label="Email" value={user.email ?? ''} disabled hint="Your email is your login and cannot be changed here." />
              {isPatient && (
                <>
                  <Input label="Date of birth" type="date" max={todayStr()} value={form.dateOfBirth} onChange={set('dateOfBirth')} error={errors.dateOfBirth} />
                  <Select label="Gender" value={form.gender} onChange={set('gender')} error={errors.gender}>
                    <option value="">Prefer not to say</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="OTHER">Other</option>
                  </Select>
                  <Input label="Emergency contact" value={form.emergencyContact} onChange={set('emergencyContact')} error={errors.emergencyContact} hint="Name and phone number" />
                  <Textarea wrapperClass="span-2" label="Address" value={form.address} onChange={set('address')} error={errors.address} />
                </>
              )}
              {isDoctor && (
                <>
                  <Input wrapperClass="span-2" label="Qualifications" value={form.qualification} onChange={set('qualification')} error={errors.qualification} />
                  <Textarea wrapperClass="span-2" label="About you" value={form.bio} onChange={set('bio')} error={errors.bio} hint="Shown to patients on your public profile. Do not include medical advice." />
                </>
              )}
            </div>
            <Button type="submit" icon={Save} loading={busy} style={{ alignSelf: 'flex-start' }}>Save changes</Button>
          </form>
        </Card>
        {isDoctor && (
          <Card title="Set by the administrator">
            <DescriptionList items={[
              { label: 'Specialization', value: user.doctor?.specialization },
              { label: 'Consultation fee', value: money(user.doctor?.consultationFee) },
              { label: 'Experience', value: `${user.doctor?.experienceYears} years` },
              { label: 'Room', value: user.doctor?.room },
            ]} />
            <Alert tone="info">To change these, please ask an administrator.</Alert>
          </Card>
        )}
        <PasswordCard />
      </div>
    </>
  );
}
