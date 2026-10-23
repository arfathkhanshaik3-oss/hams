import { Badge, StatusBadge, Token } from '../ui/ui.jsx';
import { fmtTime, minutesLabel } from '../../utils/format.js';

const TONE = { CALLED: 'violet', IN_CONSULTATION: 'dark', WAITING: 'amber', CHECKED_IN: 'light', BOOKED: 'light', CONFIRMED: 'light' };

/** One patient in a queue. `actions` is any buttons the caller wants on the right. */
export default function QueueRow({ item, position, actions, showWait = true, highlight }) {
  const meta = [];
  if (item.patient.age != null) meta.push(`${item.patient.age} yrs${item.patient.gender ? `, ${item.patient.gender.toLowerCase()}` : ''}`);
  if (item.reasonForVisit) meta.push(item.reasonForVisit);
  return (
    <li className={`q-item ${highlight ? 'is-current' : ''}`}>
      {position != null && <span className="q-pos num" aria-label={`Position ${position}`}>{position}</span>}
      <Token number={item.queueNumber} tone={TONE[item.status] ?? 'light'} />
      <div className="q-main">
        <div className="q-name">{item.patient.fullName}</div>
        <div className="q-meta">
          <span>Slot {fmtTime(item.startsAt)}</span>
          {item.checkedInAt && <span>Arrived {fmtTime(item.checkedInAt)}</span>}
          {showWait && item.estimatedWaitMinutes != null && <span>Est. wait {minutesLabel(item.estimatedWaitMinutes)}</span>}
          {meta.map((m) => <span key={m}>{m}</span>)}
        </div>
        <div className="row" style={{ gap: 6, marginTop: 4 }}>
          <StatusBadge status={item.status} />
          {item.type === 'WALK_IN' && <Badge tone="blue" plain>Walk-in</Badge>}
          {item.isLate && <Badge tone="amber" plain>Late arrival</Badge>}
          {item.skipCount > 0 && <Badge tone="red" plain>Skipped {item.skipCount}x</Badge>}
        </div>
      </div>
      {actions && <div className="q-actions">{actions}</div>}
    </li>
  );
}
