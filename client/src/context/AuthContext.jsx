import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api.js';
import { useToast } from './ToastContext.jsx';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
      return data.user;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // The API answered 401 on a normal request: the session expired or the account was disabled
  useEffect(() => {
    const onExpired = () => {
      setUser((u) => {
        if (u) toast.info('Your session has ended. Please log in again.', 'Logged out');
        return null;
      });
    };
    window.addEventListener('hams:unauthenticated', onExpired);
    return () => window.removeEventListener('hams:unauthenticated', onExpired);
  }, [toast]);

  const login = useCallback(async (email, password) => {
    await api.post('/auth/login', { email, password });
    return refresh();
  }, [refresh]);

  const register = useCallback(async (body) => {
    await api.post('/auth/register', body);
    return refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* cookie may already be gone */ }
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout, refresh }), [user, loading, login, register, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
