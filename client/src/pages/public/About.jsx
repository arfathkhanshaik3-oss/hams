import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/ui.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';

export default function About() {
  const { settings } = useSettings();
  return (
    <div className="pub-wrap section" style={{ maxWidth: 860 }}>
      <div className="section-head"><h1>About this platform</h1><p>The Healthcare Appointment &amp; Queue Management System helps a clinic replace phone calls and paper registers with one connected system.</p></div>
      <div className="stack">
        <Card title="How the queue works">
          <div className="stack-sm" style={{ maxWidth: '68ch' }}>
            <p><b>Queue number.</b> When you book, you receive a token for that doctor and day. It tells you where your booking sits; it is not always the calling order.</p>
            <p><b>Calling order.</b> Patients who have arrived are seen by their appointment time. Walk-ins join in the next free slot. If you arrive more than {settings.lateGraceMinutes} minutes late, you are seen after the patients who arrived on time.</p>
            <p><b>Skipped patients.</b> If you are not present when called, the doctor can skip you with a recorded reason and you move to the back of the line. A second skip is recorded as a no-show.</p>
            <p><b>No-shows.</b> Appointments nobody checked in for are marked as no-shows {settings.noShowAfterMinutes} minutes after the slot ends. The slot is then free again.</p>
            <p><b>Waiting time.</b> The estimate is the time left in the current consultation plus the patients ahead of you multiplied by the doctor's average consultation length. It is an estimate, not a guaranteed time.</p>
          </div>
        </Card>
        <Card title="Cancelling and rescheduling">
          <p style={{ maxWidth: '68ch' }}>You can cancel or reschedule online until {settings.cancellationCutoffHours} hour(s) before your appointment, and reschedule up to {settings.maxReschedules} times. After that, please contact the clinic. Clinic staff can cancel at any time and always record a reason.</p>
        </Card>
        <Card title="Your privacy">
          <p style={{ maxWidth: '68ch' }}>You can only see your own appointments. Doctors see the patients booked with them, receptionists see what they need to run the front desk, and administrative actions are written to an audit log. Passwords are stored as one-way hashes.</p>
        </Card>
        <Card title="Please note">
          <p style={{ maxWidth: '68ch' }}>This is an educational project, not a certified clinical system. It does not diagnose, suggest treatment or store medical records, and all demo data is fictional. In an emergency, call your local emergency number.</p>
        </Card>
        <div><Link to="/doctors" className="btn btn-primary">Find a doctor</Link></div>
      </div>
    </div>
  );
}
