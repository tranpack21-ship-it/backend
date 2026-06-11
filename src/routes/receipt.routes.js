import { Router } from 'express';
import * as receiptController from '../controllers/receipt.controller.js';
import { validate } from '../middlewares/validate.js';
import { listReceiptsSchema } from '../validations/receipt.validation.js';
import { authenticate, authorizePermission } from '../middlewares/auth.js';
import { PERMISSION_CODES } from '../constants/permissions.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorizePermission(PERMISSION_CODES.COMPROBANTES_VER),
  validate(listReceiptsSchema, 'query'),
  receiptController.list
);

router.get(
  '/venta/:ventaId',
  authorizePermission(PERMISSION_CODES.COMPROBANTES_VER),
  receiptController.getByVenta
);

export default router;
