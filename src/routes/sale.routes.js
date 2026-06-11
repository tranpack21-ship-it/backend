import { Router } from 'express';
import * as saleController from '../controllers/sale.controller.js';
import { validate } from '../middlewares/validate.js';
import {
  createSaleSchema,
  listSalesQuerySchema,
  salesSummaryQuerySchema,
} from '../validations/sale.validation.js';
import { authenticate, authorizePermission } from '../middlewares/auth.js';
import { PERMISSION_CODES } from '../constants/permissions.js';

const router = Router();

router.use(authenticate);

router.get(
  '/summary',
  authorizePermission(PERMISSION_CODES.VENTAS_VER),
  validate(salesSummaryQuerySchema, 'query'),
  saleController.summary
);

router.get(
  '/',
  authorizePermission(PERMISSION_CODES.VENTAS_VER),
  validate(listSalesQuerySchema, 'query'),
  saleController.list
);

router.get(
  '/:id',
  authorizePermission(PERMISSION_CODES.VENTAS_VER),
  saleController.getById
);

router.post(
  '/',
  authorizePermission(PERMISSION_CODES.VENTAS_CREAR),
  validate(createSaleSchema),
  saleController.create
);

router.patch(
  '/:id/cancel',
  authorizePermission(PERMISSION_CODES.VENTAS_ANULAR),
  saleController.cancel
);

export default router;
