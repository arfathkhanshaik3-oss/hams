import { useState } from 'react';
import { BellRing, CheckCheck, Play, SkipForward, UserX } from 'lucide-react';
import { api, getError } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useConfirm } from '../../context/ConfirmContext.jsx';
import QueueRow from './QueueRow.jsx';
import { Alert, Badge, Button, Card, EmptyState } from '../ui/ui.jsx';
import { Users } from 'lucide-react';

const DOCTOR_STATUS = { IN_CONSULTATION: 'In consultation', CALLING: 'Calling a patient', AVAILABLE: 'Ready for next patient', IDLE: 'No one waiting' };

/** Queue controls for one doctor. `me` = the logged-in doctor, so call-next uses /queue/doctor/me. */
export default function DoctorQueuePanel({ queue, reload, doctorId = 'me', canCall = true }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState('');

  const run = async (key, fn, okMessage) => {
    setBusy(key);
    try { await fn(); if (okMessage) toast.success(okMessage); await reload({ silent: true }); }
    catch (err) { toast.error(getError(err).message); reload({ silent: true }); }
    finally { setBusy(''); }
  };

  const callNext = () => run('next', () => api.post(`/queue/doctor/${doctorId}/call-next`), 'Next patient called.');
  const start = (e) => run(`start${e.entryId}`, () => api.post(`/queue/${e.entryId}/start`), 'Consultation started.');
  const complete = (e) => run(`done${e.entryId}`, () => api.post(`/queue/${e.entryId}/complete`), 'Consultation completed.');
  const skip = async (e) => {
    const a = await confirm({ title: `Skip ${e.patient.fullName}?`, message: 'The patient moves back in the line. A second skip marks them as a no-show.', confirmLabel: 'Skip patient', reason: { label: 'Reason for skipping', min: 3 } });
    if (a) run(`skip${e.entryId}`, () => api.post(`/queue/${e.entryId}/skip`, { reason: a.reason }), 'Patient skipped.');
  };
  const noShow = async (e) => {
    const a = await confirm({ title: `Mark ${e.patient.fullName} as no-show?`, message: 'Use this when the patient has left or did not respond to the call.', confirmLabel: 'Mark no-show', tone: 'danger', reason: { label: 'Reason', min: 3 } });
    if (a) run(`ns${e.entryId}`, () => api.post(`/queue/${e.entryId}/no-show`, { reason: a.reason }), 'Marked as no-show.');
  };

  const cur = queue.current;
  const nothingToCall = queue.waiting.length === 0;
  return (
    <div className="stack">
      <Card title="Now" actions={<Badge tone={cur ? 'violet' : 'slate'}>{DOCTOR_STATUS[queue.doctorStatus] ?? '-'}</Badge>}>
        {cur ? (
          <ul className="q-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            <QueueRow item={cur} showWait={false} highlight actions={<>
              {cur.status === 'CALLED' && <>
                <Button size="sm" icon={Play} loading={busy === `start${cur.entryId}`} onClick={() => start(cur)}>Start consultation</Button>
                <Button size="sm" variant="outline" icon={SkipForward} onClick={() => skip(cur)}>Skip</Button>
                <Button size="sm" variant="ghost" icon={UserX} onClick={() => noShow(cur)}>No-show</Button>
              </>}
              {cur.status === 'IN_CONSULTATION' && <Button size="sm" variant="teal" icon={CheckCheck} loading={busy === `done${cur.entryId}`} onClick={() => complete(cur)}>Complete</Button>}
            </>} />
          </ul>
        ) : (
          <div className="row-between">
            <p className="muted">{nothingToCall ? 'No patient is waiting. Patients appear here after reception checks them in.' : `${queue.waiting.length} patient(s) waiting.`}</p>
            {canCall && <Button icon={BellRing} disabled={nothingToCall} loading={busy === 'next'} onClick={callNext}>Call next patient</Button>}
          </div>
        )}
        {cur && <p className="small muted" style={{ marginTop: 10 }}>{cur.status === 'CALLED' ? 'Patient has been called. Press Start when they enter the room.' : 'Press Complete when the consultation ends. Next patient can then be called.'}</p>}
      </Card>

      <Card title={`Waiting (${queue.waiting.length})`} flush>
        {queue.waiting.length === 0 ? <EmptyState icon={Users} title="Nobody waiting">Checked-in patients show up here in the order they will be called.</EmptyState> : (
          <ul className="q-list">{queue.waiting.map((e, i) => <QueueRow key={e.entryId} item={e} position={i + 1} />)}</ul>
        )}
        {queue.avgConsultationMinutes && <div style={{ padding: '10px 16px' }}><Alert tone="info">{queue.estimateNote}</Alert></div>}
      </Card>

      <Card title={`Expected later (${queue.upcoming.length})`} flush>
        {queue.upcoming.length === 0 ? <p className="muted" style={{ padding: 16 }}>No booked patients are still to arrive.</p> : (
          <ul className="q-list">{queue.upcoming.map((e) => <QueueRow key={e.entryId} item={e} showWait={false} />)}</ul>
        )}
      </Card>

      <Card title={`Finished today (${queue.finished.length})`} flush>
        {queue.finished.length === 0 ? <p className="muted" style={{ padding: 16 }}>Completed, cancelled and no-show patients will be listed here.</p> : (
          <ul className="q-list">{queue.finished.map((e) => <QueueRow key={e.entryId} item={e} showWait={false} />)}</ul>
        )}
      </Card>
    </div>
  );
}
