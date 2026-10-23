import { Link } from 'react-router-dom';
import { Compass, ShieldOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { EmptyState } from '../../components/ui/ui.jsx';
import { ROLE_HOME } from '../../utils/format.js';

export function NotFound() {
  return (
    <div className="pub-wrap section"><EmptyState icon={Compass} title="Page not found" action={<Link to="/" className="btn btn-primary">Back to home</Link>}>The page you are looking for does not exist or has moved.</EmptyState></div>
  );
}

export function Unauthorized() {
  const { user } = useAuth();
  return (
    <div className="pub-wrap section">
      <EmptyState icon={ShieldOff} title="You do not have access to this page"
        action={<Link to={user ? ROLE_HOME[user.role] : '/login'} className="btn btn-primary">{user ? 'Go to my dashboard' : 'Log in'}</Link>}>
        This area is for a different type of account. If you think this is a mistake, please contact the clinic.
      </EmptyState>
    </div>
  );
}
