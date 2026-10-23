import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, UserPlus, X } from 'lucide-react';
import { api } from '../services/api.js';
import { useFetch } from '../hooks/useFetch.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { Avatar, Button, Input, Loading } from './ui/ui.jsx';

/** Receptionist tool: find an existing patient by name, phone or email. */
export default function PatientPicker({ value, onChange, registerTo = '/reception/walk-in' }) {
  const [term, setTerm] = useState('');
  const q = useDebounce(term.trim(), 300);
  const state = useFetch(() => api.get('/patients', { params: { search: q, limit: 6 } }).then((r) => r.data), [q], { enabled: !value && q.length >= 2 });

  if (value) {
    return (
      <div className="row card card-pad" style={{ padding: 14 }}>
        <Avatar name={value.fullName} />
        <div className="grow"><b>{value.fullName}</b><div className="small muted">{value.phone}{value.age != null ? ` - ${value.age} yrs` : ''}</div></div>
        <Button variant="ghost" size="sm" icon={X} onClick={() => onChange(null)}>Change patient</Button>
      </div>
    );
  }
  return (
    <div className="stack-sm">
      <Input label="Find patient" icon={Search} type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Name, phone number or email" hint="Type at least 2 characters." />
      {q.length >= 2 && state.loading && <Loading label="Searching..." />}
      {state.data && state.data.items.length === 0 && (
        <p className="small muted">No patient found. <Link to={registerTo}>Register as a new patient</Link></p>
      )}
      {state.data?.items.map((p) => (
        <button key={p.id} type="button" className="btn btn-outline" style={{ justifyContent: 'flex-start', height: 'auto', padding: 10, textAlign: 'left' }} onClick={() => onChange(p)}>
          <Avatar name={p.fullName} size="sm" />
          <span><b>{p.fullName}</b><br /><span className="small muted">{p.phone}{p.email ? ` - ${p.email}` : ''}</span></span>
        </button>
      ))}
      {state.data?.items.length > 0 && <p className="small muted"><UserPlus size={14} style={{ verticalAlign: -2 }} aria-hidden="true" /> Not listed? <Link to={registerTo}>Register a new patient</Link></p>}
    </div>
  );
}
