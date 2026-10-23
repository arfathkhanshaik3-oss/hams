import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, Plus, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { ROLE_HOME } from '../utils/format.js';

export default function PublicLayout() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <header className={`pub-nav ${open ? 'open' : ''}`}>
        <div className="pub-nav-in">
          <Link to="/" className="brand">
            <span className="brand-mark"><Plus size={20} strokeWidth={3} aria-hidden="true" /></span>
            <span>{settings.clinicName}<small>Appointments &amp; queue</small></span>
          </Link>
          <nav className="pub-links" aria-label="Main">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/doctors">Doctors</NavLink>
            <NavLink to="/about">About</NavLink>
          </nav>
          <div className="pub-actions">
            {user ? (
              <Link className="btn btn-primary" to={ROLE_HOME[user.role]}>Go to dashboard</Link>
            ) : (
              <>
                <Link className="btn btn-ghost" to="/login">Log in</Link>
                <Link className="btn btn-primary" to="/register">Create account</Link>
              </>
            )}
          </div>
          <button className="icon-btn pub-burger" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>{open ? <X /> : <Menu />}</button>
        </div>
      </header>
      <main id="main" className="pub-main" tabIndex={-1}><Outlet /></main>
      <footer className="pub-foot">
        <div className="pub-wrap pub-foot-grid">
          <div>
            <h4>{settings.clinicName}</h4>
            <p className="small">A learning project that shows how appointment booking and live queue management can work together. It is not a certified clinical system and gives no medical advice.</p>
          </div>
          <div><h4>Patients</h4><div className="stack-sm small"><Link to="/doctors">Find a doctor</Link><Link to="/register">Create an account</Link><Link to="/login">Log in</Link></div></div>
          <div><h4>Platform</h4><div className="stack-sm small"><Link to="/about">How it works</Link><span>All demo data is fictional.</span></div></div>
        </div>
      </footer>
    </>
  );
}
