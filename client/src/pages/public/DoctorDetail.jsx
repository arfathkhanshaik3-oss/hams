import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Award, DoorOpen, GraduationCap } from 'lucide-react';
import { api } from '../../services/api.js';
import { useFetch } from '../../hooks/useFetch.js';
import { Async, Avatar, Badge, Button, Card } from '../../components/ui/ui.jsx';
import { WEEKDAYS, fmtTimeStr, money } from '../../utils/format.js';

export default function DoctorDetail({ mode }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const state = useFetch(() => api.get(`/doctors/${id}`).then((r) => r.data.doctor), [id]);
  const back = mode === 'patient' ? '/patient/doctors' : '/doctors';

  const content = (
    <Async state={state}>
      {(d) => {
        const byDay = WEEKDAYS.map((name, i) => ({ name, sessions: d.schedule.filter((s) => s.weekday === i) }));
        return (
          <div className="stack">
            <Link to={back} className="row small" style={{ gap: 6 }}><ArrowLeft size={14} aria-hidden="true" />All doctors</Link>
            <div className="card card-pad">
              <div className="row" style={{ gap: 20, alignItems: 'flex-start' }}>
                <Avatar name={d.fullName} size="lg" />
                <div className="grow">
                  <h1>{d.fullName}</h1>
                  <div className="row" style={{ marginTop: 8 }}><Badge tone="teal" plain>{d.specialization.name}</Badge></div>
                  <div className="row small" style={{ marginTop: 12, color: 'var(--ink-2)', gap: 20 }}>
                    {d.qualification && <span className="row" style={{ gap: 6 }}><GraduationCap size={16} aria-hidden="true" />{d.qualification}</span>}
                    <span className="row" style={{ gap: 6 }}><Award size={16} aria-hidden="true" />{d.experienceYears} years of experience</span>
                    {d.room && <span className="row" style={{ gap: 6 }}><DoorOpen size={16} aria-hidden="true" />Room {d.room}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 700 }}>{money(d.consultationFee)}</div>
                  <div className="small muted" style={{ marginBottom: 12 }}>per consultation (about {d.consultationMinutes} min)</div>
                  <Button size="lg" onClick={() => navigate(`/patient/book/${d.id}`)}>Book appointment</Button>
                </div>
              </div>
              {d.bio && <><hr className="divider" /><p style={{ maxWidth: '70ch' }}>{d.bio}</p></>}
            </div>
            <Card title="Weekly working hours">
              <div className="week">
                {byDay.map((day) => (
                  <div key={day.name} className={`week-day ${day.sessions.length ? '' : 'off'}`}>
                    <h4>{day.name.slice(0, 3)}</h4>
                    {day.sessions.length === 0 ? <span className="small muted">Not working</span> : day.sessions.map((s) => (
                      <div key={s.id} className="small"><b>{fmtTimeStr(s.startTime)}</b> to <b>{fmtTimeStr(s.endTime)}</b><div className="muted">{s.slotMinutes}-min slots</div></div>
                    ))}
                  </div>
                ))}
              </div>
              <p className="small muted" style={{ marginTop: 12 }}>Specific times are shown when you book. Public holidays and leave are taken into account there.</p>
            </Card>
          </div>
        );
      }}
    </Async>
  );
  return mode === 'public' ? <div className="pub-wrap section">{content}</div> : content;
}
