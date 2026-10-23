import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { changePasswordSchema, loginSchema, registerSchema, updateProfileSchema } from '../validators/auth.js';
import * as ctrl from '../controllers/authController.js';

export const authRouter = Router();
authRouter.post('/register', authLimiter, validate(registerSchema), ctrl.register);
authRouter.post('/login', authLimiter, validate(loginSchema), ctrl.login);
authRouter.post('/logout', ctrl.logout);
authRouter.get('/me', authenticate, ctrl.me);

export const profileRouter = Router();
profileRouter.use(authenticate);
profileRouter.get('/', ctrl.getProfile);
profileRouter.patch('/', validate(updateProfileSchema), ctrl.updateProfile);
profileRouter.post('/change-password', authLimiter, validate(changePasswordSchema), ctrl.changePassword);
