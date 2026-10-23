import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Footprints } from 'lucide-react';
import { api, fieldErrors, clean, getError } from '../../services/api.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useToast } from '../../context/ToastContext.jsx';
import PatientPicker from '../../components/PatientPicker.jsx';
import NewPatientForm from '../../components/NewPatientForm.jsx';
import { Alert, Button, Card, PageHeader, Select, Tabs, Textarea, Token } from '../../components/ui/ui.jsx';
import { fmtTime } from '../../utils/format.js';

export default function WalkIn() {
  const toast = useToast();
  const navigate = useNavigate();
  const [mode, setMode] = useState('existing');
  const [patient, setPatient] = useState(null);
  const [doctorId, setDoctorId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(null);
  const docs = useFetch(() => api.get('/doctors', { params: { limit: 50 } }).then((r) => r.data.items), []);

  const submit = async () => {
    setBusy(true); setError(''); setErrors({});
    try {
      const { data } = await api.post('/queue/walk-in', clean({ patientId: patient.id, doctorId, reasonForVisit: reason }));
      toast.success('Walk-in added to the queue.');
      setDone(data.appointment);
    } catch (err) { setError(getError(err).message); setErrors(fieldErrors(err)); }
    finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="card card-pad stack" style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
        <h1>Walk-in registered</h1>
        <div style={{ margin: '0 auto' }}><Token number={done.queue?.queueNumber} size="xl" label="Queue number" /></div>
        <p>{done.patient.fullName} is with <b>{done.doctor.fullName}</b>. Slot {fmtTime(done.startsAt)}.</p>
        <p className="small muted">Reference <span className="code">{done.reference}</span>. The patient is already checked in.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Button onClick={() => navigate('/reception/queue')}>Open daily queue</Button>
          <Button variant="outline" onClick={() => { setDone(null); setPatient(null); setReason(''); }}>Add another walk-in</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Walk-in registration" subtitle="Patient arrived without an appointment. They take the next free slot, or join the end of the queue if the day is full." />
      <div className="grid grid-main">
        <div className="stack">
          <Card title="1. Patient">
            {!patient && <Tabs value={mode} onChange={setMode} tabs={[{ value: 'existing', label: 'Existing patient' }, { value: 'new', label: 'New patient' }]} />}
            <div style={{ marginTop: 12 }}>
              {mode === 'existing' || patient
                ? <PatientPicker value={patient} onChange={setPatient} registerTo="/reception/walk-in" />
                : <NewPatientForm onCreated={(p) => { setPatient(p); setMode('existing'); }} />}
            </div>
          </Card>
          <Card title="2. Doctor and reason">
            <div className="stack">
              <Select label="Doctor" required value={doctorId} onChange={(e) => setDoctorId(e.target.value)} error={errors.doctorId}>
                <option value="">{docs.loading ? 'Loading...' : 'Select a doctor'}</option>
                {docs.data?.map((d) => <option key={d.id} value={d.id}>{d.fullName} - {d.specialization.name}</option>)}
              </Select>
              <Textarea label="Reason for visit (optional)" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} error={errors.reasonForVisit} />
            </div>
          </Card>
        </div>
        <Card title="Register" style={{ alignSelf: 'start' }}>
          <div className="stack">
            {error && <Alert tone="error">{error}</Alert>}
            <p className="small muted">Walk-ins are checked in right away and get a queue number. Patients with earlier appointments are still called first.</p>
            <Button block size="lg" icon={Footprints} disabled={!patient || !doctorId} loading={busy} onClick={submit}>Add to queue</Button>
          </div>
        </Card>
      </div>
    </>
  );
}
