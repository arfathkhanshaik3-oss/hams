import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Modal } from '../components/ui/ui.jsx';

const ConfirmContext = createContext(null);

/**
 * const confirm = useConfirm();
 * const answer = await confirm({ title, message, confirmLabel, tone: 'danger', reason: { label, min } });
 * answer === null  -> the person cancelled
 * answer.reason    -> the text they typed (only when a reason was requested)
 */
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const resolver = useRef(null);

  const confirm = useCallback((opts) => new Promise((resolve) => {
    resolver.current = resolve;
    setReason('');
    setError('');
    setState(opts);
  }), []);

  const close = (value) => {
    resolver.current?.(value);
    resolver.current = null;
    setState(null);
  };

  const submit = (e) => {
    e.preventDefault();
    if (state.reason) {
      const min = state.reason.min ?? 3;
      if (reason.trim().length < min) { setError(`Please write at least ${min} characters.`); return; }
      close({ reason: reason.trim() });
    } else close({});
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <Modal title={state.title} onClose={() => close(null)}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => close(null)}>{state.cancelLabel ?? 'Keep it'}</button>
              <button type="submit" form="confirm-form" className={`btn ${state.tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}>{state.confirmLabel ?? 'Confirm'}</button>
            </>
          )}>
          <form id="confirm-form" onSubmit={submit} className="stack">
            {state.message && <p>{state.message}</p>}
            {state.reason && (
              <div className="field">
                <label htmlFor="confirm-reason">{state.reason.label ?? 'Reason'}</label>
                <textarea id="confirm-reason" className="textarea" value={reason} autoFocus aria-invalid={!!error} placeholder={state.reason.placeholder}
                  onChange={(e) => { setReason(e.target.value); setError(''); }} maxLength={300} />
                {error && <span className="error" role="alert">{error}</span>}
              </div>
            )}
          </form>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}
