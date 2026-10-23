import { Link } from 'react-router-dom';
import { Award, DoorOpen } from 'lucide-react';
import { Avatar, Badge, Button } from './ui/ui.jsx';
import { WEEKDAYS_SHORT, money } from '../utils/format.js';

export const workingDays = (schedule = []) => [...new Set(schedule.map((s) => s.weekday))].sort().map((d) => WEEKDAYS_SHORT[d]).join(', ');

export default function DoctorCard({ doctor, detailsTo, bookTo }) {
  const days = workingDays(doctor.schedule);
  return (
    <article className="card doc-card">
      <div className="doc-top">
        <Avatar name={doctor.fullName} size="lg" />
        <div style={{ minWidth: 0 }}>
          <h3>{doctor.fullName}</h3>
          <Badge tone="teal" plain>{doctor.specialization.name}</Badge>
        </div>
      </div>
      <div className="stack-sm small" style={{ color: 'var(--ink-2)' }}>
        {doctor.qualification && <span>{doctor.qualification}</span>}
        <span className="row" style={{ gap: 6 }}><Award size={14} aria-hidden="true" />{doctor.experienceYears} years of experience</span>
        {doctor.room && <span className="row" style={{ gap: 6 }}><DoorOpen size={14} aria-hidden="true" />Room {doctor.room}</span>}
        <span>{days ? `Works ${days}` : 'No schedule published yet'}</span>
        {doctor.freeSlots != null && <Badge tone={doctor.freeSlots ? 'green' : 'gray'}>{doctor.freeSlots ? `${doctor.freeSlots} times free on that day` : 'Fully booked that day'}</Badge>}
      </div>
      <div className="doc-foot">
        <div><div style={{ fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: '1.125rem' }}>{money(doctor.consultationFee)}</div><div className="small muted">per consultation</div></div>
        <div className="row" style={{ gap: 8 }}>
          <Link to={detailsTo} className="btn btn-outline btn-sm">Profile</Link>
          <Link to={bookTo} className="btn btn-primary btn-sm">Book</Link>
        </div>
      </div>
    </article>
  );
}
export { Button };
