import { Router } from 'express';
import * as auditController from '../controllers/audit.controller.js';
import { validate } from '../middlewares/validate.js';
import { listAuditSchema } from '../validations/audit.validation.js';
import { authenticate, authorizePermission } from '../middlewares/auth.js';
import { PERMISSION_CODES } from '../constants/permissions.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorizePermission(PERMISSION_CODES.AUDITORIA_VER),
  validate(listAuditSchema, 'query'),
  auditController.list
);

export default router;
