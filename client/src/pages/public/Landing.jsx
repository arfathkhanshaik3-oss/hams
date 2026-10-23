import { Link } from 'react-router-dom';
import { Activity, CalendarCheck, Clock, ShieldCheck, Smartphone, Stethoscope } from 'lucide-react';
import { api } from '../../services/api.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import DoctorCard from '../../components/DoctorCard.jsx';
import { Async, Card, EmptyState, Token } from '../../components/ui/ui.jsx';
import { WEEKDAYS, fmtTimeStr } from '../../utils/format.js';

const FEATURES = [
  { icon: CalendarCheck, tone: 'blue', title: 'No double bookings', text: 'Every time slot is checked on the server the moment you book, so two people can never hold the same time.' },
  { icon: Activity, tone: 'teal', title: 'A live queue you can follow', text: 'See who is being seen, your position and an estimated wait. It updates by itself when the doctor calls the next patient.' },
  { icon: Clock, tone: 'amber', title: 'Honest waiting times', text: 'Estimates are based on how long consultations really take, and are always labelled as estimates, never promises.' },
  { icon: Smartphone, tone: 'violet', title: 'Works on your phone', text: 'Book, reschedule, cancel and track your turn from any screen size.' },
  { icon: Stethoscope, tone: 'green', title: 'Built for the whole clinic', text: 'Patients, doctors, receptionists and administrators each get tools made for their job.' },
  { icon: ShieldCheck, tone: 'red', title: 'Private by design', text: 'You only ever see your own records. Staff see what their role needs, and important actions are logged.' },
];

export default function Landing() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const docs = useFetch(() => api.get('/doctors', { params: { limit: 3 } }).then((r) => r.data), []);
  const closed = settings.closedWeekdays.map((d) => WEEKDAYS[d]).join(', ');

  return (
    <>
      <div className="pub-wrap">
        <section className="hero">
          <div>
            <h1>See the doctor, skip the waiting-room guesswork.</h1>
            <p className="lead">Book a time with the doctor you need, then follow your place in the queue live from your phone. Open {fmtTimeStr(settings.opensAt)} to {fmtTimeStr(settings.closesAt)}{closed ? `, closed ${closed}` : ''}.</p>
            <div className="row">
              <Link to={user ? '/patient/book' : '/register'} className="btn btn-primary btn-lg">{user ? 'Book an appointment' : 'Create a free account'}</Link>
              <Link to="/doctors" className="btn btn-outline btn-lg">Find a doctor</Link>
            </div>
          </div>
          <div className="hero-board" role="img" aria-label="Illustration of the live queue screen: one patient is being seen, two are waiting">
            <div className="row-line"><Token number={14} tone="violet" label="Now" /><div><div className="nm">Your doctor is seeing patient 14</div><div className="st">Illustration of the live queue</div></div></div>
            <div className="row-line"><Token number={15} tone="amber" /><div><div className="nm">You are next</div><div className="st">Estimated wait: about 10 minutes</div></div></div>
            <div className="row-line"><Token number={16} tone="light" /><div><div className="nm">Waiting</div><div className="st">2 people ahead of this token</div></div></div>
          </div>
        </section>
      </div>

      <div className="pub-wrap section">
        <div className="section-head"><h2>Everything a visit needs, in one place</h2><p>From choosing a doctor to being called into the room.</p></div>
        <div className="grid grid-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card feature">
              <div className={`stat-icon tone-${f.tone}`}><f.icon size={20} aria-hidden="true" /></div>
              <h3>{f.title}</h3><p>{f.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="pub-wrap section">
        <div className="row-between section-head" style={{ maxWidth: 'none' }}>
          <div><h2>Our doctors</h2><p>Pick a specialist and see their real availability.</p></div>
          <Link to="/doctors" className="btn btn-outline">See all doctors</Link>
        </div>
        <Async state={docs} isEmpty={(d) => d.items.length === 0}
          empty={<Card><EmptyState icon={Stethoscope} title="No doctors listed yet">Doctors appear here as soon as an administrator adds them.</EmptyState></Card>}>
          {(d) => <div className="grid grid-3">{d.items.map((doc) => <DoctorCard key={doc.id} doctor={doc} detailsTo={`/doctors/${doc.id}`} bookTo={`/patient/book/${doc.id}`} />)}</div>}
        </Async>
      </div>
    </>
  );
}
