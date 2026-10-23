import { asyncHandler } from '../utils/asyncHandler.js';
import { audit } from '../services/auditService.js';
import * as admin from '../services/adminService.js';
import * as dashboards from '../services/dashboardService.js';
import * as reports from '../services/reportService.js';
import * as notifications from '../services/notificationService.js';

export const users = asyncHandler(async (req, res) => res.json(await admin.listUsers(req.query)));
export const createUser = asyncHandler(async (req, res) => {
  const user = await admin.createUser(req.body);
  await audit(req, { action: 'USER_CREATED', entityType: 'User', entityId: user.id, details: { role: user.role } });
  res.status(201).json({ user });
});
export const updateUser = asyncHandler(async (req, res) => {
  const user = await admin.updateUser(req.params.id, req.body);
  await audit(req, { action: 'USER_UPDATED', entityType: 'User', entityId: user.id, details: { fields: Object.keys(req.body) } });
  res.json({ user });
});
export const setUserStatus = asyncHandler(async (req, res) => {
  const user = await admin.setUserActive(req.user, req.params.id, req.body.isActive);
  await audit(req, { action: user.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', entityType: 'User', entityId: user.id, details: { role: user.role } });
  res.json({ user });
});
export const resetPassword = asyncHandler(async (req, res) => {
  await admin.resetPassword(req.params.id, req.body.password);
  await audit(req, { action: 'USER_PASSWORD_RESET', entityType: 'User', entityId: req.params.id });
  res.json({ message: 'Password reset' });
});
export const auditLogs = asyncHandler(async (req, res) => res.json(await admin.listAuditLogs(req.query)));
export const getSettings = asyncHandler(async (_req, res) => res.json({ settings: await admin.readSettings() }));
export const putSettings = asyncHandler(async (req, res) => {
  const settings = await admin.saveSettings(req.body);
  await audit(req, { action: 'SETTINGS_UPDATED', entityType: 'ClinicSettings', entityId: '1', details: req.body });
  res.json({ settings });
});

export const dashboard = {
  patient: asyncHandler(async (req, res) => res.json(await dashboards.patientDashboard(req.user))),
  doctor: asyncHandler(async (req, res) => res.json(await dashboards.doctorDashboard(req.user))),
  receptionist: asyncHandler(async (_req, res) => res.json(await dashboards.receptionistDashboard())),
  admin: asyncHandler(async (_req, res) => res.json(await dashboards.adminDashboard())),
};
export const report = {
  trends: asyncHandler(async (req, res) => res.json(await reports.trends(req.query))),
  workload: asyncHandler(async (req, res) => res.json(await reports.workload(req.query))),
  waitingTimes: asyncHandler(async (req, res) => res.json(await reports.waitingTimes(req.query))),
  cancellations: asyncHandler(async (req, res) => res.json(await reports.cancellations(req.query))),
};

export const listNotifications = asyncHandler(async (req, res) => res.json(await notifications.listNotifications(req.user.id, req.query)));
export const readNotification = asyncHandler(async (req, res) => {
  await notifications.markRead(req.user.id, req.params.id);
  res.json({ message: 'Marked as read' });
});
export const readAllNotifications = asyncHandler(async (req, res) => {
  await notifications.markAllRead(req.user.id);
  res.json({ message: 'All marked as read' });
});

// Safe subset of clinic settings that every logged-in user (and the public landing page) may read
export const publicSettings = asyncHandler(async (_req, res) => {
  const s = await admin.readSettings();
  res.json({
    settings: {
      clinicName: s.clinicName,
      opensAt: s.opensAt,
      closesAt: s.closesAt,
      timeZone: s.timeZone,
      closedWeekdays: s.closedWeekdays,
      cancellationCutoffHours: s.cancellationCutoffHours,
      lateGraceMinutes: s.lateGraceMinutes,
      maxAdvanceBookingDays: s.maxAdvanceBookingDays,
      maxReschedules: s.maxReschedules,
    },
  });
});
