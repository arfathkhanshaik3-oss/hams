import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loading } from '../components/ui/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// Hides pages from the wrong people. This is for good UX only; the API enforces the same rules.
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}><Loading label="Checking your session..." /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/unauthorized" replace />;
  return <Outlet />;
}
