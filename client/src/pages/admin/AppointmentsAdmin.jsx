import AppointmentLookup from '../reception/AppointmentLookup.jsx';

export default function AppointmentsAdmin() {
  return <AppointmentLookup base="/admin" viewer="ADMIN" title="Appointments" />;
}
