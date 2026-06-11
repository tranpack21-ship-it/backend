import { Router } from 'express';
import * as reportController from '../controllers/report.controller.js';
import { validate } from '../middlewares/validate.js';
import { reportDateRangeSchema } from '../validations/report.validation.js';
import { authenticate, authorizePermission } from '../middlewares/auth.js';
import { PERMISSION_CODES } from '../constants/permissions.js';

const router = Router();

router.use(authenticate);
router.use(authorizePermission(PERMISSION_CODES.REPORTES_VER));

router.get(
  '/dashboard',
  validate(reportDateRangeSchema, 'query'),
  reportController.dashboard
);
router.get(
  '/sales-by-day',
  validate(reportDateRangeSchema, 'query'),
  reportController.salesByDay
);
router.get(
  '/top-products',
  validate(reportDateRangeSchema, 'query'),
  reportController.topProducts
);
router.get('/low-stock', reportController.lowStock);
router.get(
  '/sales-by-user',
  validate(reportDateRangeSchema, 'query'),
  reportController.salesByUser
);

export default router;
