import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { idParam } from '../validators/common.js';
import {
  auditQuery, createUserSchema, listUsersQuery, notificationQuery, reportQuery, resetPasswordSchema, settingsSchema, updateUserSchema,
} from '../validators/admin.js';
import { listDoctorsQuery, statusSchema } from '../validators/doctor.js';
import * as admin from '../controllers/adminController.js';
import * as doctors from '../controllers/doctorController.js';

export const notificationRouter = Router();
notificationRouter.use(authenticate);
notificationRouter.get('/', validate(notificationQuery, 'query'), admin.listNotifications);
notificationRouter.post('/read-all', admin.readAllNotifications);
notificationRouter.patch('/:id/read', validate(idParam, 'params'), admin.readNotification);

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);
dashboardRouter.get('/patient', authorize('PATIENT'), admin.dashboard.patient);
dashboardRouter.get('/doctor', authorize('DOCTOR'), admin.dashboard.doctor);
dashboardRouter.get('/receptionist', authorize('RECEPTIONIST'), admin.dashboard.receptionist);
dashboardRouter.get('/admin', authorize('ADMIN'), admin.dashboard.admin);

export const reportRouter = Router();
reportRouter.use(authenticate, authorize('ADMIN'));
reportRouter.get('/trends', validate(reportQuery, 'query'), admin.report.trends);
reportRouter.get('/workload', validate(reportQuery, 'query'), admin.report.workload);
reportRouter.get('/waiting-times', validate(reportQuery, 'query'), admin.report.waitingTimes);
reportRouter.get('/cancellations', validate(reportQuery, 'query'), admin.report.cancellations);

export const settingsRouter = Router();
settingsRouter.get('/public', admin.publicSettings);

export const adminRouter = Router();
adminRouter.use(authenticate, authorize('ADMIN'));
adminRouter.get('/users', validate(listUsersQuery, 'query'), admin.users);
adminRouter.post('/users', authLimiter, validate(createUserSchema), admin.createUser);
adminRouter.patch('/users/:id', validate(idParam, 'params'), validate(updateUserSchema), admin.updateUser);
adminRouter.patch('/users/:id/status', validate(idParam, 'params'), validate(statusSchema), admin.setUserStatus);
adminRouter.post('/users/:id/reset-password', authLimiter, validate(idParam, 'params'), validate(resetPasswordSchema), admin.resetPassword);
adminRouter.get('/doctors', validate(listDoctorsQuery, 'query'), doctors.adminListDoctors);
adminRouter.get('/audit-logs', validate(auditQuery, 'query'), admin.auditLogs);
adminRouter.get('/settings', admin.getSettings);
adminRouter.put('/settings', validate(settingsSchema), admin.putSettings);
