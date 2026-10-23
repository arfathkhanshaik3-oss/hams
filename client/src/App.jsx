import { AuthProvider } from './context/AuthContext.jsx';
import { ConfirmProvider } from './context/ConfirmContext.jsx';
import { SettingsProvider } from './context/SettingsContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import AppRoutes from './routes/AppRoutes.jsx';

export default function App() {
  return (
    <ToastProvider>
      <SettingsProvider>
        <AuthProvider>
          <SocketProvider>
            <ConfirmProvider>
              <AppRoutes />
            </ConfirmProvider>
          </SocketProvider>
        </AuthProvider>
      </SettingsProvider>
    </ToastProvider>
  );
}
