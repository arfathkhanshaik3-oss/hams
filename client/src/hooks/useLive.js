import { useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext.jsx';

/**
 * Keeps a page fresh without a manual refresh.
 *  - Socket connected: reload (silently) whenever the server says the queue / an appointment changed.
 *  - Socket NOT connected: fall back to polling the API every 15 seconds.
 * Returns { connected } so the page can show a "Live" / "Reconnecting" indicator.
 */
export function useLive(reload, { doctorIds = [], events = ['queue:updated', 'appointment:statusChanged'], pollMs = 15000 } = {}) {
  const { connected, on, watchDoctor } = useSocket();
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  const key = doctorIds.filter(Boolean).join(',');

  useEffect(() => {
    const unsubscribers = key.split(',').filter(Boolean).map((id) => watchDoctor(id));
    return () => unsubscribers.forEach((u) => u());
  }, [key, watchDoctor]);

  useEffect(() => {
    let timer = null;
    const trigger = () => { clearTimeout(timer); timer = setTimeout(() => reloadRef.current({ silent: true }), 250); };
    const offs = events.map((e) => on(e, trigger));
    return () => { clearTimeout(timer); offs.forEach((off) => off()); };
  }, [on, connected, events.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const interval = setInterval(() => reloadRef.current({ silent: true }), connected ? 60000 : pollMs); // 60 s safety refresh while live
    const onVisible = () => { if (document.visibilityState === 'visible') reloadRef.current({ silent: true }); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, [connected, pollMs]);

  return { connected };
}
