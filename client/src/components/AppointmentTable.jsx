import { Link } from 'react-router-dom';
import { StatusBadge, Token, Badge } from './ui/ui.jsx';
import { fmtDate, fmtTime } from '../utils/format.js';

/**
 * viewer: 'PATIENT' shows the doctor; everyone else shows the patient (and the doctor for staff).
 * base: route prefix for the details page, e.g. "/patient".
 */
export default function AppointmentTable({ items, viewer, base, extra }) {
  const patientView = viewer === 'PATIENT';
  const doctorView = viewer === 'DOCTOR';
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Reference</th><th scope="col">Date and time</th>
            {!patientView && <th scope="col">Patient</th>}
            {!doctorView && <th scope="col">Doctor</th>}
            <th scope="col">Token</th><th scope="col">Status</th>{extra && <th scope="col"><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id}>
              <td><Link to={`${base}/appointments/${a.id}`} className="code">{a.reference}</Link>{a.type === 'WALK_IN' && <> <Badge tone="blue" plain>Walk-in</Badge></>}</td>
              <td><div>{fmtDate(a.startsAt)}</div><div className="small muted">{fmtTime(a.startsAt)}</div></td>
              {!patientView && <td>{a.patient.fullName}{a.patient.phone && <div className="small muted">{a.patient.phone}</div>}</td>}
              {!doctorView && <td>{a.doctor.fullName}<div className="small muted">{a.doctor.specialization}</div></td>}
              <td>{a.queue ? <span className="num" style={{ fontWeight: 600 }}>#{a.queue.queueNumber}</span> : '-'}</td>
              <td><StatusBadge status={a.status} /></td>
              {extra && <td><div className="actions">{extra(a)}</div></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export { Token };
