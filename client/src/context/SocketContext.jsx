import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext({ connected: false, on: () => () => {}, watchDoctor: () => () => {} });
export const useSocket = () => useContext(SocketContext);

/**
 * One Socket.IO connection per logged-in user. The login cookie authenticates it.
 * Pages never depend on it: if it drops, useLive() falls back to polling the API.
 */
export function SocketProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const watched = useRef(new Map()); // doctorId -> number of watchers
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) return undefined;
    const socket = io(import.meta.env.VITE_SOCKET_URL || undefined, { withCredentials: true, transports: ['websocket', 'polling'], reconnectionDelayMax: 8000 });
    socketRef.current = socket;
    const resubscribe = () => watched.current.forEach((_, id) => socket.emit('queue:subscribe', id));
    socket.on('connect', () => { setConnected(true); resubscribe(); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    return () => { socket.disconnect(); socketRef.current = null; setConnected(false); };
  }, [user]);

  const on = useCallback((event, handler) => {
    const s = socketRef.current;
    if (!s) return () => {};
    s.on(event, handler);
    return () => s.off(event, handler);
  }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps

  const watchDoctor = useCallback((doctorId) => {
    if (!doctorId) return () => {};
    watched.current.set(doctorId, (watched.current.get(doctorId) ?? 0) + 1);
    socketRef.current?.emit('queue:subscribe', doctorId);
    return () => {
      const n = (watched.current.get(doctorId) ?? 1) - 1;
      if (n <= 0) { watched.current.delete(doctorId); socketRef.current?.emit('queue:unsubscribe', doctorId); } else watched.current.set(doctorId, n);
    };
  }, []);

  const value = useMemo(() => ({ connected, on, watchDoctor }), [connected, on, watchDoctor]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}
