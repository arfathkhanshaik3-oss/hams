import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BookingForm from '../../components/BookingForm.jsx';
import NewPatientForm from '../../components/NewPatientForm.jsx';
import PatientPicker from '../../components/PatientPicker.jsx';
import { Card, PageHeader, Tabs } from '../../components/ui/ui.jsx';

export default function BookForPatient() {
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [mode, setMode] = useState('existing');
  return (
    <>
      <PageHeader title="Book for a patient" subtitle="For phone and desk bookings. The patient gets a notification if they have an account." />
      <div className="stack">
        <Card title="Patient">
          {!patient && <Tabs value={mode} onChange={setMode} tabs={[{ value: 'existing', label: 'Existing patient' }, { value: 'new', label: 'New patient' }]} />}
          <div style={{ marginTop: 12 }}>
            {mode === 'existing' || patient
              ? <PatientPicker value={patient} onChange={setPatient} registerTo="/reception/book" />
              : <NewPatientForm onCreated={(p) => { setPatient(p); setMode('existing'); }} />}
          </div>
        </Card>
        <BookingForm key={patient?.id ?? 'none'} patientId={patient?.id} disabledReason={patient ? '' : 'Choose a patient first.'}
          onBooked={(a) => navigate(`/reception/appointments/${a.id}`, { replace: true })} />
      </div>
    </>
  );
}
