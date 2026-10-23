import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { api } from '../services/api.js';
import { useSocket } from '../context/SocketContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { timeAgo } from '../utils/format.js';

export default function NotificationBell({ base }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();
  const { on, connected } = useSocket();

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications', { params: { limit: 8 } });
      setItems(data.items);
      setUnread(data.unread);
    } catch { /* the bell is optional; stay quiet if the API hiccups */ }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);
  useEffect(() => on('notification:new', (n) => { toast.info(n.message, n.title); load(); }), [on, connected, load, toast]);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const openItem = async (n) => {
    setOpen(false);
    if (!n.readAt) { try { await api.patch(`/notifications/${n.id}/read`); } catch { /* ignore */ } load(); }
    if (n.appointmentId) navigate(`${base}/appointments/${n.appointmentId}`);
  };
  const readAll = async () => { await api.post('/notifications/read-all'); load(); };

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} aria-haspopup="true">
        <Bell size={20} />
        {unread > 0 && <span className="bell-count" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="dropdown" role="menu">
          <div className="dropdown-head"><span>Notifications</span>{unread > 0 && <button className="btn btn-ghost btn-sm" onClick={readAll}>Mark all as read</button>}</div>
          {items.length === 0 && <div className="empty" style={{ padding: 28 }}><p>No notifications yet. Updates about your appointments appear here.</p></div>}
          {items.map((n) => (
            <button key={n.id} className={`notif ${n.readAt ? '' : 'unread'}`} onClick={() => openItem(n)} role="menuitem">
              <span className={`n-dot ${n.readAt ? 'read' : ''}`} aria-hidden="true" />
              <span>
                <span className="n-title">{n.title}</span><br />
                <span className="n-msg">{n.message}</span><br />
                <span className="n-time">{timeAgo(n.createdAt)}</span>
              </span>
            </button>
          ))}
          <div style={{ padding: 10, textAlign: 'center' }}><Link to={`${base}/notifications`} onClick={() => setOpen(false)}>View all notifications</Link></div>
        </div>
      )}
    </div>
  );
}
