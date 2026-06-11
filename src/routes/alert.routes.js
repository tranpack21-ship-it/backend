import { Router } from 'express';
import * as alertController from '../controllers/alert.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { alertQuerySchema } from '../validations/alert.validation.js';

const router = Router();

router.use(authenticate);
router.get('/', validate(alertQuerySchema, 'query'), alertController.list);

export default router;
