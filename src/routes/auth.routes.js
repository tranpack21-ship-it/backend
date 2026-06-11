import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.js';
import { loginSchema, registerSchema } from '../validations/auth.validation.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { authLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

router.post('/login', authLimiter, validate(loginSchema), authController.login);

router.post(
  '/register',
  authenticate,
  authorize('admin'),
  validate(registerSchema),
  authController.register
);

router.get('/me', authenticate, authController.getMe);

export default router;
