import { api } from '../../services/api.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useLive } from '../../hooks/useLive.js';
import { useAuth } from '../../context/AuthContext.jsx';
import DoctorQueuePanel from '../../components/queue/DoctorQueuePanel.jsx';
import { Async, LiveIndicator, PageHeader } from '../../components/ui/ui.jsx';
import { fmtDateStr } from '../../utils/format.js';

export default function QueueManagement() {
  const { user } = useAuth();
  const state = useFetch(() => api.get('/queue/doctor/me').then((r) => r.data), []);
  const { connected } = useLive(state.reload, { doctorIds: [user.doctor?.id] });
  return (
    <>
      <PageHeader title="Queue management" subtitle={state.data ? `Today, ${fmtDateStr(state.data.date)}` : 'Today'} actions={<LiveIndicator connected={connected} />} />
      <Async state={state}>{(q) => <DoctorQueuePanel queue={q} reload={state.reload} />}</Async>
    </>
  );
}
