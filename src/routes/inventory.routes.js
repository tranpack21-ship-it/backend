import { Router } from 'express';
import * as inventoryController from '../controllers/inventory.controller.js';
import { validate } from '../middlewares/validate.js';
import {
  createMovementSchema,
  listMovementsQuerySchema,
  stockAlertsQuerySchema,
} from '../validations/inventory.validation.js';
import { authenticate, authorizePermission } from '../middlewares/auth.js';
import { PERMISSION_CODES } from '../constants/permissions.js';

const router = Router();

router.use(authenticate);

router.get(
  '/summary',
  authorizePermission(PERMISSION_CODES.INVENTARIO_VER),
  inventoryController.summary
);

router.get(
  '/stock-alerts',
  authorizePermission(
    PERMISSION_CODES.INVENTARIO_VER,
    PERMISSION_CODES.PRODUCTOS_VER,
    PERMISSION_CODES.REPORTES_VER
  ),
  validate(stockAlertsQuerySchema, 'query'),
  inventoryController.stockAlerts
);

router.get(
  '/',
  authorizePermission(PERMISSION_CODES.INVENTARIO_VER),
  validate(listMovementsQuerySchema, 'query'),
  inventoryController.list
);

router.post(
  '/movements',
  authorizePermission(PERMISSION_CODES.INVENTARIO_MOVIMIENTO),
  validate(createMovementSchema),
  inventoryController.createMovement
);

export default router;
