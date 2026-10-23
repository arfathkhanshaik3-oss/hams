import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createPatientSchema, patientSearchQuery } from '../validators/queue.js';
import * as ctrl from '../controllers/queueController.js';

export const patientRouter = Router();
patientRouter.use(authenticate);
patientRouter.get('/', authorize('RECEPTIONIST', 'ADMIN'), validate(patientSearchQuery, 'query'), ctrl.searchPatients);
patientRouter.post('/', authorize('RECEPTIONIST'), validate(createPatientSchema), ctrl.createPatient);
