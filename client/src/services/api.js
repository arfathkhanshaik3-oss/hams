import axios from 'axios';

// All requests go to /api (the Vite dev server forwards them to Express).
// The login token lives in an httpOnly cookie, so JavaScript never touches it.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  timeout: 20000,
});

const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/me', '/auth/logout'];

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const data = err.response?.data?.error;
    err.apiError = data
      ? { status: err.response.status, code: data.code, message: data.message, details: data.details }
      : err.code === 'ECONNABORTED'
        ? { status: 0, code: 'TIMEOUT', message: 'The server took too long to respond. Please try again.' }
        : { status: 0, code: 'NETWORK', message: 'Cannot reach the server. Check your connection and that the API is running.' };
    const url = err.config?.url ?? '';
    if (err.apiError.status === 401 && err.apiError.code === 'UNAUTHENTICATED' && !AUTH_PATHS.some((p) => url.startsWith(p))) {
      window.dispatchEvent(new CustomEvent('hams:unauthenticated'));
    }
    return Promise.reject(err);
  },
);

/** Always returns { status, code, message, details } whatever went wrong */
export const getError = (err) => err?.apiError ?? { status: 0, code: 'UNKNOWN', message: err?.message || 'Something went wrong.' };
export const fieldErrors = (err) => {
  const d = getError(err).details;
  return d && typeof d === 'object' ? Object.fromEntries(Object.entries(d).filter(([, v]) => typeof v === 'string')) : {};
};
// Removes empty values so optional fields are not sent as ""
export const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined));
