import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtDayMonth } from '../../utils/format.js';

const COLORS = { total: '#1f5fa8', completed: '#0e8f8a', cancelled: '#9aa9b4', noShow: '#b93a2e', wait: '#9a6208' };
const axis = { fontSize: 12, fill: '#647c8d' };

// days: [{ date, total, completed, cancelled, noShow }] straight from the API
export function TrendChart({ days, height = 280 }) {
  const data = days.map((d) => ({ ...d, label: fmtDayMonth(d.date) }));
  return (
    <div style={{ height }} role="img" aria-label="Appointments per day, split by completed, cancelled and no-show">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5edf2" vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} />
          <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip cursor={{ fill: 'rgba(31,95,168,0.06)' }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="completed" name="Completed" stackId="a" fill={COLORS.completed} />
          <Bar dataKey="cancelled" name="Cancelled" stackId="a" fill={COLORS.cancelled} />
          <Bar dataKey="noShow" name="No show" stackId="a" fill={COLORS.noShow} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WaitChart({ days, height = 260 }) {
  const data = days.map((d) => ({ label: fmtDayMonth(d.date), wait: d.avgWaitMinutes }));
  return (
    <div style={{ height }} role="img" aria-label="Average waiting time per day in minutes">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5edf2" vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} />
          <YAxis tick={axis} tickLine={false} axisLine={false} unit=" m" />
          <Tooltip formatter={(v) => (v == null ? 'No data' : `${v} min`)} />
          <Line type="monotone" dataKey="wait" name="Average wait" stroke={COLORS.wait} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// rows: [{ name, a, b }] horizontal comparison, used for doctor workload
export function WorkloadChart({ rows, height = 280 }) {
  const data = rows.map((r) => ({ name: r.fullName.replace(/^Dr\.?\s+/, ''), Completed: r.completed, Cancelled: r.cancelled ?? 0, 'No show': r.noShow ?? 0 }));
  return (
    <div style={{ height: Math.max(height, data.length * 38) }} role="img" aria-label="Appointments per doctor">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5edf2" horizontal={false} />
          <XAxis type="number" tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={axis} tickLine={false} axisLine={false} width={96} />
          <Tooltip cursor={{ fill: 'rgba(31,95,168,0.06)' }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Completed" stackId="a" fill={COLORS.completed} />
          <Bar dataKey="Cancelled" stackId="a" fill={COLORS.cancelled} />
          <Bar dataKey="No show" stackId="a" fill={COLORS.noShow} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SimpleBars({ data, height = 220, color = COLORS.total, name = 'Count' }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5edf2" vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
          <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip cursor={{ fill: 'rgba(31,95,168,0.06)' }} />
          <Bar dataKey="value" name={name} fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
