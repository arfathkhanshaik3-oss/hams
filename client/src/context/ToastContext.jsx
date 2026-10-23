import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((type, message, title) => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-3), { id, type, message, title }]);
    setTimeout(() => dismiss(id), type === 'error' ? 7000 : 4500);
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (message, title = 'Done') => push('success', message, title),
    error: (message, title = 'Something went wrong') => push('error', message, title),
    info: (message, title) => push('info', message, title),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <div key={t.id} className={`toast toast-${t.type}`} role={t.type === 'error' ? 'alert' : 'status'}>
              <Icon size={18} className="t-icon" aria-hidden="true" />
              <div className="grow">
                {t.title && <div className="toast-title">{t.title}</div>}
                <div className="toast-msg">{t.message}</div>
              </div>
              <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => dismiss(t.id)} aria-label="Dismiss notification"><X size={16} /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
