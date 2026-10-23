import { useCallback, useEffect, useRef, useState } from "react";
import { getError } from "../services/api.js";

/**
 * const { data, loading, error, reload } = useFetch(() => api.get('/x').then(r => r.data), [deps]);
 * reload({ silent: true }) refreshes without showing the loading spinner (used by live updates).
 */
export function useFetch(fetcher, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({
    data: null,
    loading: enabled,
    error: null,
  });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const requestId = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(async ({ silent = false } = {}) => {
    const id = ++requestId.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetcherRef.current();
      if (alive.current && id === requestId.current)
        setState({ data, loading: false, error: null });
    } catch (err) {
      if (alive.current && id === requestId.current)
        setState((s) => ({
          data: silent ? s.data : null,
          loading: false,
          error: silent ? s.error : getError(err),
        }));
    }
  }, []);

  useEffect(() => {
    if (enabled) run();
    else setState({ data: null, loading: false, error: null });
  }, [enabled, run, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  const setData = useCallback(
    (updater) =>
      setState((s) => ({
        ...s,
        data: typeof updater === "function" ? updater(s.data) : updater,
      })),
    [],
  );
  const loading =
    state.loading || (enabled && state.data === null && !state.error);
  return { ...state, loading, reload: run, setData };
}
