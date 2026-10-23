import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api.js';
import { setClinicTimeZone } from '../utils/format.js';

const DEFAULTS = { clinicName: 'City Care Clinic', opensAt: '08:00', closesAt: '20:00', timeZone: 'Asia/Kolkata', closedWeekdays: [0], cancellationCutoffHours: 2, lateGraceMinutes: 15, maxAdvanceBookingDays: 30, maxReschedules: 2 };
const SettingsContext = createContext({ settings: DEFAULTS, reload: () => {} });
export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    try {
      const { data } = await api.get('/settings/public');
      setClinicTimeZone(data.settings.timeZone);
      setSettings(data.settings);
    } catch {
      /* keep defaults; the API may be offline - pages show their own error states */
    } finally {
      setReady(true);
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const value = useMemo(() => ({ settings, reload, ready }), [settings, reload, ready]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
