import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { clean, fieldErrors, getError } from '../../services/api.js';
import { Alert, Button, Card, Input, Select } from '../../components/ui/ui.jsx';
import { ROLE_HOME, todayStr } from '../../utils/format.js';
import { compact, minLen, validEmail, validPassword, validPhone } from '../../utils/validators.js';

export default function Register() {
  const { user, register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', dateOfBirth: '', gender: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: '' })); setFormError(''); };
  const submit = async (e) => {
    e.preventDefault();
    const errs = compact({
      fullName: minLen(form.fullName, 2, 'Full name'),
      email: validEmail(form.email),
      phone: validPhone(form.phone),
      password: validPassword(form.password),
      confirm: form.confirm === form.password ? '' : 'Passwords do not match',
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const { confirm, ...body } = form;
      await register(clean(body));
      toast.success('Your account is ready. You can book your first appointment now.', 'Welcome');
      navigate('/patient', { replace: true });
    } catch (err) {
      setErrors((x) => ({ ...x, ...fieldErrors(err) }));
      setFormError(getError(err).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="auth-wrap">
      <Card className="auth-card wide" pad={false}>
        <form onSubmit={submit} noValidate className="stack" style={{ padding: 32 }}>
          <div><h1>Create your patient account</h1><p className="muted" style={{ marginTop: 4 }}>It takes a minute. You can then book and track appointments online.</p></div>
          {formError && <Alert tone="error">{formError}</Alert>}
          <div className="form-grid">
            <Input wrapperClass="span-2" label="Full name" autoComplete="name" required value={form.fullName} onChange={set('fullName')} error={errors.fullName} />
            <Input label="Email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} error={errors.email} />
            <Input label="Phone number" type="tel" autoComplete="tel" required value={form.phone} onChange={set('phone')} error={errors.phone} hint="The clinic may call this number." />
            <Input label="Date of birth" type="date" max={todayStr()} value={form.dateOfBirth} onChange={set('dateOfBirth')} error={errors.dateOfBirth} hint="Optional" />
            <Select label="Gender" value={form.gender} onChange={set('gender')} error={errors.gender} hint="Optional">
              <option value="">Prefer not to say</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="OTHER">Other</option>
            </Select>
            <Input label="Password" type="password" autoComplete="new-password" required value={form.password} onChange={set('password')} error={errors.password} hint="At least 8 characters with a letter and a number." />
            <Input label="Confirm password" type="password" autoComplete="new-password" required value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
          </div>
          <Button type="submit" size="lg" block loading={busy}>Create account</Button>
          <p className="small muted" style={{ textAlign: 'center' }}>Already registered? <Link to="/login">Log in</Link></p>
        </form>
      </Card>
    </div>
  );
}
