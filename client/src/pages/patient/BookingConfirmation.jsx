import { Link, useParams } from 'react-router-dom';
import { CalendarPlus, CheckCircle2, Ticket } from 'lucide-react';
import { api } from '../../services/api.js';
import { useFetch } from '../../hooks/useFetch.js';
import { Async, Button, Card, DescriptionList, Token } from '../../components/ui/ui.jsx';
import { fmtDate, fmtTime, isToday, money } from '../../utils/format.js';

const icsStamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
function downloadCalendar(a) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HAMS//Appointments//EN', 'BEGIN:VEVENT', `UID:${a.reference}@hams`, `DTSTAMP:${icsStamp(new Date().toISOString())}`,
    `DTSTART:${icsStamp(a.startsAt)}`, `DTEND:${icsStamp(a.endsAt)}`, `SUMMARY:Appointment with ${a.doctor.fullName}`, `DESCRIPTION:Reference ${a.reference}. Queue number ${a.queue?.queueNumber ?? ''}.`,
    a.doctor.room ? `LOCATION:Room ${a.doctor.room}` : 'LOCATION:Clinic', 'END:VEVENT', 'END:VCALENDAR'];
  const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `appointment-${a.reference}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function BookingConfirmation() {
  const { id } = useParams();
  const state = useFetch(() => api.get(`/appointments/${id}`).then((r) => r.data.appointment), [id]);
  return (
    <Async state={state}>
      {(a) => (
        <div className="stack" style={{ maxWidth: 760, margin: '0 auto' }}>
          <div className="card card-pad" style={{ textAlign: 'center' }}>
            <div className="stat-icon tone-green" style={{ margin: '0 auto 12px', width: 52, height: 52, borderRadius: '50%' }}><CheckCircle2 size={28} aria-hidden="true" /></div>
            <h1>Your appointment is booked</h1>
            <p className="muted" style={{ margin: '6px 0 20px' }}>{fmtDate(a.startsAt)} at {fmtTime(a.startsAt)} with {a.doctor.fullName}</p>
            <Token number={a.queue?.queueNumber} size="xl" label="Your queue number" />
            <p className="small muted" style={{ marginTop: 12 }}>Keep this number. It is also saved under My appointments.</p>
            <div className="row" style={{ justifyContent: 'center', marginTop: 20 }}>
              <Link to={`/patient/appointments/${a.id}`} className="btn btn-primary">View appointment</Link>
              {isToday(a.startsAt) && <Link to={`/patient/queue/${a.id}`} className="btn btn-teal"><Ticket size={16} aria-hidden="true" />Track live queue</Link>}
              <Button variant="outline" icon={CalendarPlus} onClick={() => downloadCalendar(a)}>Add to calendar</Button>
            </div>
          </div>
          <Card title="Details">
            <DescriptionList items={[
              { label: 'Reference', value: <span className="code">{a.reference}</span> },
              { label: 'Doctor', value: `${a.doctor.fullName} (${a.doctor.specialization})` },
              { label: 'Room', value: a.doctor.room },
              { label: 'Fee', value: `${money(a.doctor.consultationFee)}, paid at the clinic` },
              { label: 'Reason', value: a.reasonForVisit },
            ]} />
          </Card>
          <Card title="What happens next">
            <ul style={{ margin: 0, paddingLeft: 20 }} className="stack-sm">
              <li>Arrive about 10 minutes early and give your reference at reception to check in.</li>
              <li>On the day, follow your place in the queue from Live queue. The estimate updates by itself.</li>
              <li>Need to change plans? You can reschedule or cancel from the appointment page, up to the clinic's cut-off time.</li>
            </ul>
          </Card>
        </div>
      )}
    </Async>
  );
}
