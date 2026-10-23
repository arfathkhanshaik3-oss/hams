// Quick client-side checks so people get instant feedback. The server re-validates everything.
export const required = (v, label = 'This field') => (String(v ?? '').trim() ? '' : `${label} is required`);
export const validEmail = (v) => (!String(v ?? '').trim() ? 'Email is required' : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Enter a valid email address');
export const validPassword = (v) => {
  if (!v) return 'Password is required';
  if (v.length < 8) return 'Use at least 8 characters';
  if (!/[A-Za-z]/.test(v)) return 'Include at least one letter';
  if (!/\d/.test(v)) return 'Include at least one number';
  return '';
};
export const validPhone = (v, { optional = false } = {}) => {
  if (!String(v ?? '').trim()) return optional ? '' : 'Phone number is required';
  return /^\+?[0-9 ()-]{7,18}$/.test(v.trim()) ? '' : 'Enter a valid phone number';
};
export const minLen = (v, n, label = 'This field') => (String(v ?? '').trim().length >= n ? '' : `${label} must be at least ${n} characters`);
// Remove empty-string errors so `Object.keys(errors).length === 0` means "valid"
export const compact = (errors) => Object.fromEntries(Object.entries(errors).filter(([, v]) => v));
