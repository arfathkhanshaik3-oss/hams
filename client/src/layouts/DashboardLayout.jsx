import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, Bell, CalendarClock, CalendarDays, CalendarPlus, ClipboardList, FileClock, LayoutDashboard, ListChecks, LogOut, Menu, Settings, ShieldCheck,
  Stethoscope, Tags, Ticket, UserCheck, UserPlus, UserRound, Users, BarChart3, Search, Plus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { Avatar } from '../components/ui/ui.jsx';
import { ROLE_LABEL } from '../utils/format.js';
import NotificationBell from './NotificationBell.jsx';

const NAV = {
  PATIENT: [
    { to: '/patient', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/patient/doctors', label: 'Find doctors', icon: Stethoscope },
    { to: '/patient/book', label: 'Book appointment', icon: CalendarPlus },
    { to: '/patient/appointments', label: 'My appointments', icon: CalendarDays },
    { to: '/patient/queue', label: 'Live queue', icon: Ticket },
    { to: '/patient/notifications', label: 'Notifications', icon: Bell },
    { to: '/patient/profile', label: 'My profile', icon: UserRound },
  ],
  DOCTOR: [
    { to: '/doctor', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/doctor/today', label: 'Appointments', icon: CalendarDays },
    { to: '/doctor/queue', label: 'Queue', icon: Activity },
    { to: '/doctor/schedule', label: 'Schedule', icon: CalendarClock },
    { to: '/doctor/notifications', label: 'Notifications', icon: Bell },
    { to: '/doctor/profile', label: 'My profile', icon: UserRound },
  ],
  RECEPTIONIST: [
    { to: '/reception', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/reception/check-in', label: 'Patient check-in', icon: UserCheck },
    { to: '/reception/queue', label: 'Daily queue', icon: ListChecks },
    { to: '/reception/walk-in', label: 'Walk-in registration', icon: UserPlus },
    { to: '/reception/book', label: 'Book for a patient', icon: CalendarPlus },
    { to: '/reception/lookup', label: 'Appointment lookup', icon: Search },
    { to: '/reception/notifications', label: 'Notifications', icon: Bell },
    { to: '/reception/profile', label: 'My profile', icon: UserRound },
  ],
  ADMIN: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { group: 'People' },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/doctors', label: 'Doctors', icon: Stethoscope },
    { to: '/admin/specializations', label: 'Specializations', icon: Tags },
    { group: 'Clinic' },
    { to: '/admin/appointments', label: 'Appointments', icon: ClipboardList },
    { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
    { to: '/admin/audit-logs', label: 'Audit logs', icon: FileClock },
    { to: '/admin/settings', label: 'Settings', icon: Settings },
    { to: '/admin/profile', label: 'My profile', icon: UserRound },
  ],
};
const BASE = { PATIENT: '/patient', DOCTOR: '/doctor', RECEPTIONIST: '/reception', ADMIN: '/admin' };

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);

  const items = NAV[user.role] ?? [];
  const base = BASE[user.role];
  const doLogout = async () => { await logout(); navigate('/login', { replace: true }); };

  return (
    <div className="app">
      <a href="#main" className="skip-link">Skip to content</a>
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
        <NavLink to={base} className="brand" end>
          <span className="brand-mark"><Plus size={20} strokeWidth={3} aria-hidden="true" /></span>
          <span>{settings.clinicName}<small>Appointments &amp; queue</small></span>
        </NavLink>
        <nav className="nav">
          {items.map((it, i) => it.group
            ? <div className="nav-group" key={`g${i}`}>{it.group}</div>
            : (
              <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                <it.icon size={19} aria-hidden="true" />{it.label}
              </NavLink>
            ))}
        </nav>
        <div className="sidebar-foot">
          <div className="sidebar-user">
            <Avatar name={user.fullName} size="sm" />
            <div style={{ minWidth: 0 }}><b>{user.fullName}</b><span>{ROLE_LABEL[user.role]}</span></div>
          </div>
          <button className="btn btn-ghost logout" onClick={doLogout}><LogOut size={18} aria-hidden="true" />Log out</button>
        </div>
      </aside>
      <div className={`scrim ${open ? 'open' : ''}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Open navigation menu"><Menu size={22} /></button>
          <span className="clinic grow">{settings.clinicName}</span>
          <NotificationBell base={base} />
        </header>
        <main id="main" className="content" tabIndex={-1}><Outlet /></main>
      </div>
    </div>
  );
}
