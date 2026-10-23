import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { useLive } from '../../hooks/useLive.js';
import { Async, Button, Card, EmptyState, PageHeader, Pagination, Tabs } from '../../components/ui/ui.jsx';
import { ROLE_HOME, fmtDateTime } from '../../utils/format.js';

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);
  const state = useFetch(() => api.get('/notifications', { params: { page, limit: 15, unread: tab === 'unread' ? 'true' : undefined } }).then((r) => r.data), [tab, page]);
  useLive(state.reload, { events: ['notification:new'] });

  const open = async (n) => {
    if (!n.readAt) { await api.patch(`/notifications/${n.id}/read`); state.reload({ silent: true }); }
    if (n.appointmentId) navigate(`${ROLE_HOME[user.role]}/appointments/${n.appointmentId}`);
  };
  const readAll = async () => { await api.post('/notifications/read-all'); state.reload({ silent: true }); };

  return (
    <>
      <PageHeader title="Notifications" subtitle="Updates about your appointments and your place in the queue."
        actions={<Button variant="outline" icon={CheckCheck} onClick={readAll} disabled={!state.data?.unread}>Mark all as read</Button>} />
      <Card pad={false} flush>
        <div style={{ padding: '0 12px' }}><Tabs value={tab} onChange={(t) => { setTab(t); setPage(1); }} tabs={[{ value: 'all', label: 'All' }, { value: 'unread', label: 'Unread', count: state.data?.unread }]} /></div>
        <Async state={state} isEmpty={(d) => d.items.length === 0} empty={<EmptyState icon={Bell} title={tab === 'unread' ? 'You are all caught up' : 'No notifications yet'}>When something changes with an appointment, you will see it here.</EmptyState>}>
          {(d) => (
            <>
              <div>{d.items.map((n) => (
                <button key={n.id} className={`notif ${n.readAt ? '' : 'unread'}`} onClick={() => open(n)}>
                  <span className={`n-dot ${n.readAt ? 'read' : ''}`} aria-hidden="true" />
                  <span><span className="n-title">{n.title}</span><br /><span className="n-msg">{n.message}</span><br /><span className="n-time">{fmtDateTime(n.createdAt)}</span></span>
                </button>
              ))}</div>
              <Pagination meta={d.meta} onPage={setPage} noun="notifications" />
            </>
          )}
        </Async>
      </Card>
    </>
  );
}
