import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import { bookSchema, cancelSchema, listAppointmentsQuery, rescheduleSchema, statusChangeSchema } from '../validators/appointment.js';
import * as ctrl from '../controllers/appointmentController.js';

export const appointmentRouter = Router();
appointmentRouter.use(authenticate);
appointmentRouter.post('/', authorize('PATIENT', 'RECEPTIONIST'), validate(bookSchema), ctrl.book);
appointmentRouter.get('/', validate(listAppointmentsQuery, 'query'), ctrl.list);
appointmentRouter.get('/:id', validate(idParam, 'params'), ctrl.get);
appointmentRouter.post('/:id/cancel', validate(idParam, 'params'), validate(cancelSchema), ctrl.cancel);
appointmentRouter.post('/:id/reschedule', authorize('PATIENT', 'RECEPTIONIST'), validate(idParam, 'params'), validate(rescheduleSchema), ctrl.reschedule);
appointmentRouter.patch('/:id/status', authorize('DOCTOR'), validate(idParam, 'params'), validate(statusChangeSchema), ctrl.changeStatus);
