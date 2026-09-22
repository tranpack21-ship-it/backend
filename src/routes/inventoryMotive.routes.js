import { Router } from 'express';
import * as inventoryMotiveController from '../controllers/inventoryMotive.controller.js';
import { validate } from '../middlewares/validate.js';
import {
  createInventoryMotiveSchema,
  updateInventoryMotiveSchema,
  listInventoryMotivesQuerySchema,
} from '../validations/inventoryMotive.validation.js';
import { authenticate, authorizePermission } from '../middlewares/auth.js';
import { PERMISSION_CODES } from '../constants/permissions.js';

const router = Router();

const canRead = [
  PERMISSION_CODES.INVENTARIO_MOTIVOS_VER,
  PERMISSION_CODES.INVENTARIO_MOTIVOS_GESTIONAR,
  PERMISSION_CODES.INVENTARIO_VER,
  PERMISSION_CODES.INVENTARIO_MOVIMIENTO,
  PERMISSION_CODES.REPORTES_VER,
];

router.use(authenticate);

router.get(
  '/',
  authorizePermission(...canRead),
  validate(listInventoryMotivesQuerySchema, 'query'),
  inventoryMotiveController.list
);

router.get(
  '/:id',
  authorizePermission(PERMISSION_CODES.INVENTARIO_MOTIVOS_GESTIONAR),
  inventoryMotiveController.getById
);

router.post(
  '/',
  authorizePermission(PERMISSION_CODES.INVENTARIO_MOTIVOS_GESTIONAR),
  validate(createInventoryMotiveSchema),
  inventoryMotiveController.create
);

router.put(
  '/:id',
  authorizePermission(PERMISSION_CODES.INVENTARIO_MOTIVOS_GESTIONAR),
  validate(updateInventoryMotiveSchema),
  inventoryMotiveController.update
);

router.patch(
  '/:id/deactivate',
  authorizePermission(PERMISSION_CODES.INVENTARIO_MOTIVOS_GESTIONAR),
  inventoryMotiveController.deactivate
);

export default router;
