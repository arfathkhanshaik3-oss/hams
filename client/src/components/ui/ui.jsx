import { useEffect, useId, useRef } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, Loader2, Search, X } from 'lucide-react';
import { STATUS, initials } from '../../utils/format.js';

/* ---------- buttons ---------- */
export function Button({ variant = 'primary', size, loading = false, icon: Icon, block, children, className = '', disabled, type = 'button', ...rest }) {
  const cls = ['btn', `btn-${variant}`, size ? `btn-${size}` : '', block ? 'btn-block' : '', className].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Loader2 size={16} className="spin" aria-hidden="true" /> : Icon ? <Icon size={16} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export const Spinner = ({ size = 18 }) => <Loader2 size={size} className="spin" aria-hidden="true" />;
export const Loading = ({ label = 'Loading...' }) => (
  <div className="loading" role="status"><Spinner />{label}</div>
);
export const Skeleton = ({ h = 16, w = '100%', style }) => <div className="skeleton" style={{ height: h, width: w, ...style }} aria-hidden="true" />;

/* ---------- containers ---------- */
export function Card({ title, actions, children, pad = true, flush = false, className = '', ...rest }) {
  return (
    <section className={`card ${flush ? 'card-flush' : ''} ${className}`} {...rest}>
      {(title || actions) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      {flush ? children : pad ? <div className="card-body">{children}</div> : children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

export function StatCard({ icon: Icon, tone = 'blue', label, value, note, loading }) {
  return (
    <div className="card stat">
      <div className={`stat-icon tone-${tone}`}>{Icon && <Icon size={20} aria-hidden="true" />}</div>
      <div>
        <div className="stat-value">{loading ? <Skeleton h={28} w={56} /> : value}</div>
        <div className="stat-label">{label}</div>
        {note && <div className="stat-note">{note}</div>}
      </div>
    </div>
  );
}

/* ---------- badges / avatar / token ---------- */
export const Badge = ({ tone = 'slate', plain, children }) => <span className={`badge badge-${tone} ${plain ? 'badge-plain' : ''}`}>{children}</span>;
export function StatusBadge({ status }) {
  const s = STATUS[status] ?? { label: status, tone: 'slate' };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
export const Avatar = ({ name, size = '', className = '' }) => <span className={`avatar ${size ? `avatar-${size}` : ''} ${className}`} aria-hidden="true">{initials(name)}</span>;

// The clinic queue token: a ticket-shaped number. The one deliberately expressive element of the UI.
export function Token({ number, size = 'md', tone = 'dark', label = 'No.' }) {
  const cls = ['token', tone !== 'dark' ? `token-${tone}` : '', size === 'lg' ? 'token-lg' : size === 'xl' ? 'token-lg token-xl' : ''].filter(Boolean).join(' ');
  return (
    <span className={cls} aria-label={`Queue number ${number ?? 'not assigned'}`}>
      <small aria-hidden="true">{label}</small>
      <b aria-hidden="true">{number ?? '-'}</b>
    </span>
  );
}

/* ---------- feedback ---------- */
const ALERT_ICON = { info: Info, warn: AlertTriangle, error: AlertCircle, ok: CheckCircle2 };
export function Alert({ tone = 'info', children, role }) {
  const Icon = ALERT_ICON[tone];
  return <div className={`alert alert-${tone}`} role={role ?? (tone === 'error' ? 'alert' : 'status')}><Icon size={18} aria-hidden="true" /><div>{children}</div></div>;
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="empty">
      {Icon && <div className="empty-icon"><Icon size={26} aria-hidden="true" /></div>}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="empty" role="alert">
      <div className="empty-icon" style={{ background: 'var(--coral-50)', color: 'var(--coral)' }}><AlertCircle size={26} aria-hidden="true" /></div>
      <h3>We could not load this</h3>
      <p>{error?.message ?? 'Something went wrong.'}</p>
      {onRetry && <Button variant="outline" onClick={() => onRetry()}>Try again</Button>}
    </div>
  );
}

/** Shows the right thing for a useFetch result: spinner, error, empty, or the content */
export function Async({ state, empty, isEmpty, children, loadingLabel }) {
  if (state.loading && !state.data) return <Loading label={loadingLabel} />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (!state.data) return null;
  if (isEmpty?.(state.data)) return empty;
  return children(state.data);
}

export function LiveIndicator({ connected }) {
  return connected
    ? <span className="live live-on" role="status"><span className="dot" />Live</span>
    : <span className="live live-off" role="status" title="Real-time connection unavailable. This page refreshes itself every 15 seconds."><span className="dot" />Refreshing every 15 s</span>;
}

/* ---------- forms ---------- */
function FieldShell({ id, label, error, hint, required, children, className = '' }) {
  return (
    <div className={`field ${className}`}>
      {label && <label htmlFor={id}>{label}{required && <span aria-hidden="true" style={{ color: 'var(--coral)' }}> *</span>}</label>}
      {children}
      {hint && !error && <span className="hint" id={`${id}-hint`}>{hint}</span>}
      {error && <span className="error" id={`${id}-err`} role="alert"><AlertCircle size={14} aria-hidden="true" />{error}</span>}
    </div>
  );
}
const aria = (id, error, hint) => ({ 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? `${id}-err` : hint ? `${id}-hint` : undefined });

export function Input({ label, error, hint, required, className, wrapperClass, icon: Icon, ...props }) {
  const id = useId();
  const input = <input id={id} className={`input ${className ?? ''}`} required={required} {...aria(id, error, hint)} {...props} />;
  return <FieldShell id={id} label={label} error={error} hint={hint} required={required} className={wrapperClass}>{Icon ? <div className="input-icon"><Icon size={16} aria-hidden="true" />{input}</div> : input}</FieldShell>;
}
export function Select({ label, error, hint, required, children, wrapperClass, ...props }) {
  const id = useId();
  return <FieldShell id={id} label={label} error={error} hint={hint} required={required} className={wrapperClass}><select id={id} className="select" required={required} {...aria(id, error, hint)} {...props}>{children}</select></FieldShell>;
}
export function Textarea({ label, error, hint, required, wrapperClass, ...props }) {
  const id = useId();
  return <FieldShell id={id} label={label} error={error} hint={hint} required={required} className={wrapperClass}><textarea id={id} className="textarea" required={required} {...aria(id, error, hint)} {...props} /></FieldShell>;
}
export function SearchInput({ label = 'Search', ...props }) {
  return <Input label={label} icon={Search} type="search" {...props} />;
}

/* ---------- modal (focus is moved in, trapped, and restored; Esc closes) ---------- */
export function Modal({ title, onClose, children, footer, size }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const node = ref.current;
    const focusables = () => node.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (!node.contains(document.activeElement)) (focusables()[1] ?? focusables()[0])?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        const list = [...focusables()];
        if (!list.length) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; previous?.focus?.(); };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${size === 'lg' ? 'modal-lg' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- navigation helpers ---------- */
export function Tabs({ tabs, value, onChange, label = 'Sections' }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.value} role="tab" className="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}>
          {t.label}{t.count != null && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ meta, onPage, noun = 'results' }) {
  if (!meta || meta.total === 0) return null;
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.total, meta.page * meta.limit);
  return (
    <nav className="pager" aria-label="Pagination">
      <span>Showing {from}-{to} of {meta.total} {noun}</span>
      <div className="row" style={{ gap: 8 }}>
        <Button variant="outline" size="sm" icon={ChevronLeft} disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Previous</Button>
        <span>Page {meta.page} of {meta.totalPages}</span>
        <Button variant="outline" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>Next<ChevronRight size={16} aria-hidden="true" /></Button>
      </div>
    </nav>
  );
}

export function DescriptionList({ items }) {
  return (
    <dl className="kv">
      {items.filter((i) => i.value !== undefined).map((i) => (
        <div key={i.label} style={{ display: 'contents' }}><dt>{i.label}</dt><dd>{i.value ?? '-'}</dd></div>
      ))}
    </dl>
  );
}
