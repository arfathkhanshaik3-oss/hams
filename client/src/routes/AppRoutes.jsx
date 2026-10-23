import { Navigate, Route, Routes } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout.jsx';
import PublicLayout from '../layouts/PublicLayout.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';

import Landing from '../pages/public/Landing.jsx';
import About from '../pages/public/About.jsx';
import DoctorDirectory from '../pages/public/DoctorDirectory.jsx';
import DoctorDetail from '../pages/public/DoctorDetail.jsx';
import Login from '../pages/public/Login.jsx';
import Register from '../pages/public/Register.jsx';
import { NotFound, Unauthorized } from '../pages/public/Errors.jsx';

import AppointmentDetails from '../pages/shared/AppointmentDetails.jsx';
import Notifications from '../pages/shared/Notifications.jsx';
import Profile from '../pages/shared/Profile.jsx';

import PatientDashboard from '../pages/patient/PatientDashboard.jsx';
import BookAppointment from '../pages/patient/BookAppointment.jsx';
import BookingConfirmation from '../pages/patient/BookingConfirmation.jsx';
import MyAppointments from '../pages/patient/MyAppointments.jsx';
import LiveQueue from '../pages/patient/LiveQueue.jsx';

import DoctorDashboard from '../pages/doctor/DoctorDashboard.jsx';
import TodayAppointments from '../pages/doctor/TodayAppointments.jsx';
import QueueManagement from '../pages/doctor/QueueManagement.jsx';
import ScheduleManagement from '../pages/doctor/ScheduleManagement.jsx';

import ReceptionDashboard from '../pages/reception/ReceptionDashboard.jsx';
import WalkIn from '../pages/reception/WalkIn.jsx';
import CheckIn from '../pages/reception/CheckIn.jsx';
import DailyQueue from '../pages/reception/DailyQueue.jsx';
import AppointmentLookup from '../pages/reception/AppointmentLookup.jsx';
import BookForPatient from '../pages/reception/BookForPatient.jsx';

import AdminDashboard from '../pages/admin/AdminDashboard.jsx';
import Users from '../pages/admin/Users.jsx';
import DoctorsAdmin from '../pages/admin/DoctorsAdmin.jsx';
import Specializations from '../pages/admin/Specializations.jsx';
import AppointmentsAdmin from '../pages/admin/AppointmentsAdmin.jsx';
import Reports from '../pages/admin/Reports.jsx';
import AuditLogs from '../pages/admin/AuditLogs.jsx';
import SettingsPage from '../pages/admin/SettingsPage.jsx';

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/about" element={<About />} />
        <Route path="/doctors" element={<DoctorDirectory mode="public" />} />
        <Route path="/doctors/:id" element={<DoctorDetail mode="public" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
      </Route>

      <Route element={<ProtectedRoute roles={['PATIENT']} />}>
        <Route path="/patient" element={<DashboardLayout />}>
          <Route index element={<PatientDashboard />} />
          <Route path="doctors" element={<DoctorDirectory mode="patient" />} />
          <Route path="doctors/:id" element={<DoctorDetail mode="patient" />} />
          <Route path="book" element={<BookAppointment />} />
          <Route path="book/:doctorId" element={<BookAppointment />} />
          <Route path="appointments" element={<MyAppointments />} />
          <Route path="appointments/:id" element={<AppointmentDetails />} />
          <Route path="appointments/:id/confirmation" element={<BookingConfirmation />} />
          <Route path="queue" element={<LiveQueue />} />
          <Route path="queue/:id" element={<LiveQueue />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['DOCTOR']} />}>
        <Route path="/doctor" element={<DashboardLayout />}>
          <Route index element={<DoctorDashboard />} />
          <Route path="today" element={<TodayAppointments />} />
          <Route path="appointments/:id" element={<AppointmentDetails />} />
          <Route path="queue" element={<QueueManagement />} />
          <Route path="schedule" element={<ScheduleManagement />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['RECEPTIONIST']} />}>
        <Route path="/reception" element={<DashboardLayout />}>
          <Route index element={<ReceptionDashboard />} />
          <Route path="walk-in" element={<WalkIn />} />
          <Route path="check-in" element={<CheckIn />} />
          <Route path="queue" element={<DailyQueue />} />
          <Route path="lookup" element={<AppointmentLookup />} />
          <Route path="book" element={<BookForPatient />} />
          <Route path="appointments/:id" element={<AppointmentDetails />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['ADMIN']} />}>
        <Route path="/admin" element={<DashboardLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="doctors" element={<DoctorsAdmin />} />
          <Route path="specializations" element={<Specializations />} />
          <Route path="appointments" element={<AppointmentsAdmin />} />
          <Route path="appointments/:id" element={<AppointmentDetails />} />
          <Route path="reports" element={<Reports />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Route>

      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="*" element={<PublicLayout />}><Route path="*" element={<NotFound />} /></Route>
    </Routes>
  );
}
