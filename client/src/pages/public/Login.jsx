import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { getError } from '../../services/api.js';
import { Alert, Button, Card, Input } from '../../components/ui/ui.jsx';
import { ROLE_HOME } from '../../utils/format.js';
import { compact, validEmail, required } from '../../utils/validators.js';

// Fictional accounts created by `npm run db:seed` in the server folder
const DEMOS = [
  ['Patient', 'patient@hams.test', 'Patient@123'],
  ['Doctor', 'ananya.rao@hams.test', 'Doctor@123'],
  ['Receptionist', 'reception@hams.test', 'Reception@123'],
  ['Admin', 'admin@hams.test', 'Admin@123'],
];

export default function Login() {
  const { user, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: '' })); setFormError(''); };
  const submit = async (e) => {
    e.preventDefault();
    const errs = compact({ email: validEmail(form.email), password: required(form.password, 'Password') });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const me = await login(form.email.trim(), form.password);
      toast.success(`Welcome back, ${me.fullName.split(' ')[0]}.`, 'Logged in');
      const from = location.state?.from;
      const home = ROLE_HOME[me.role];
      navigate(from && from.startsWith(home) ? from : home, { replace: true });
    } catch (err) {
      setFormError(getError(err).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="auth-wrap">
      <div className="stack" style={{ width: 'min(460px, 100%)' }}>
        <Card className="auth-card" pad={false}>
          <form onSubmit={submit} noValidate className="stack" style={{ padding: 32 }}>
            <div><h1>Log in</h1><p className="muted" style={{ marginTop: 4 }}>Welcome back. Enter your details to continue.</p></div>
            {location.state?.from && <Alert tone="info">Please log in to continue.</Alert>}
            {formError && <Alert tone="error">{formError}</Alert>}
            <Input label="Email" type="email" autoComplete="email" icon={Mail} value={form.email} onChange={set('email')} error={errors.email} />
            <div className="field">
              <Input label="Password" type={show ? 'text' : 'password'} autoComplete="current-password" icon={Lock} value={form.password} onChange={set('password')} error={errors.password} />
              <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setShow((s) => !s)}>{show ? <EyeOff size={14} /> : <Eye size={14} />}{show ? 'Hide password' : 'Show password'}</button>
            </div>
            <Button type="submit" size="lg" block loading={busy}>Log in</Button>
            <p className="small muted" style={{ textAlign: 'center' }}>New here? <Link to="/register">Create a patient account</Link></p>
          </form>
        </Card>
        <div className="demo-box">
          <b>Demo accounts (fictional data).</b> Fill in a login:
          <div className="row" style={{ gap: 14, marginTop: 6 }}>
            {DEMOS.map(([label, email, password]) => <button key={label} type="button" onClick={() => { setForm({ email, password }); setErrors({}); setFormError(''); }}>{label}</button>)}
          </div>
        </div>
      </div>
    </div>
  );
}
