import { Router } from 'express';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import {
  createDoctorSchema, leaveParams, leaveSchema, listDoctorsQuery, scheduleSchema, slotsQuery, statusSchema, updateDoctorSchema,
} from '../validators/doctor.js';
import { specializationSchema, specializationUpdateSchema } from '../validators/admin.js';
import * as ctrl from '../controllers/doctorController.js';

export const specializationRouter = Router();
specializationRouter.get('/', ctrl.listSpecializations);
specializationRouter.post('/', authenticate, authorize('ADMIN'), validate(specializationSchema), ctrl.createSpecialization);
specializationRouter.patch('/:id', authenticate, authorize('ADMIN'), validate(idParam, 'params'), validate(specializationUpdateSchema), ctrl.updateSpecialization);
specializationRouter.delete('/:id', authenticate, authorize('ADMIN'), validate(idParam, 'params'), ctrl.deleteSpecialization);

export const doctorRouter = Router();
// Public: the doctor directory. An admin who sends the cookie also sees inactive doctors.
doctorRouter.get('/', optionalAuth, validate(listDoctorsQuery, 'query'), ctrl.listDoctors);
doctorRouter.post('/', authenticate, authorize('ADMIN'), validate(createDoctorSchema), ctrl.createDoctor);
doctorRouter.get('/:id', optionalAuth, validate(idParam, 'params'), ctrl.getDoctor);
doctorRouter.patch('/:id', authenticate, authorize('ADMIN'), validate(idParam, 'params'), validate(updateDoctorSchema), ctrl.updateDoctor);
doctorRouter.patch('/:id/status', authenticate, authorize('ADMIN'), validate(idParam, 'params'), validate(statusSchema), ctrl.setStatus);
doctorRouter.get('/:id/slots', authenticate, validate(idParam, 'params'), validate(slotsQuery, 'query'), ctrl.slots);
doctorRouter.get('/:id/schedule', authenticate, validate(idParam, 'params'), ctrl.getSchedule);
doctorRouter.put('/:id/schedule', authenticate, authorize('DOCTOR', 'ADMIN'), validate(idParam, 'params'), validate(scheduleSchema), ctrl.putSchedule);
doctorRouter.post('/:id/leaves', authenticate, authorize('DOCTOR', 'ADMIN'), validate(idParam, 'params'), validate(leaveSchema), ctrl.addLeave);
doctorRouter.delete('/:id/leaves/:leaveId', authenticate, authorize('DOCTOR', 'ADMIN'), validate(leaveParams, 'params'), ctrl.removeLeave);
