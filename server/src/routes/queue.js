import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { appointmentParam, dateQuery, doctorParam, entryParam, reasonSchema, reorderSchema, walkInSchema } from '../validators/queue.js';
import * as ctrl from '../controllers/queueController.js';

export const queueRouter = Router();
queueRouter.use(authenticate);

queueRouter.get('/overview', authorize('RECEPTIONIST', 'ADMIN'), validate(dateQuery, 'query'), ctrl.overview);
queueRouter.get('/doctor/:doctorId', authorize('DOCTOR', 'RECEPTIONIST', 'ADMIN'), validate(doctorParam, 'params'), validate(dateQuery, 'query'), ctrl.doctorQueue);
queueRouter.post('/doctor/:doctorId/call-next', authorize('DOCTOR'), validate(doctorParam, 'params'), ctrl.callNext);
queueRouter.get('/my-status/:appointmentId', authorize('PATIENT'), validate(appointmentParam, 'params'), ctrl.myStatus);
queueRouter.post('/check-in/:appointmentId', authorize('RECEPTIONIST'), validate(appointmentParam, 'params'), ctrl.checkIn);
queueRouter.post('/walk-in', authorize('RECEPTIONIST'), validate(walkInSchema), ctrl.walkIn);

queueRouter.post('/:entryId/start', authorize('DOCTOR'), validate(entryParam, 'params'), ctrl.start);
queueRouter.post('/:entryId/complete', authorize('DOCTOR'), validate(entryParam, 'params'), ctrl.complete);
queueRouter.post('/:entryId/skip', authorize('DOCTOR', 'RECEPTIONIST'), validate(entryParam, 'params'), validate(reasonSchema), ctrl.skip);
queueRouter.post('/:entryId/no-show', authorize('DOCTOR', 'RECEPTIONIST'), validate(entryParam, 'params'), validate(reasonSchema), ctrl.noShow);
queueRouter.post('/:entryId/reorder', authorize('RECEPTIONIST'), validate(entryParam, 'params'), validate(reorderSchema), ctrl.reorder);
queueRouter.post('/:entryId/seat', authorize('RECEPTIONIST'), validate(entryParam, 'params'), ctrl.seat);
