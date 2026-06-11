import { Router } from 'express';
import * as cashController from '../controllers/cash.controller.js';
import { validate } from '../middlewares/validate.js';
import {
  openCashSchema,
  closeCashSchema,
  cashMovementSchema,
  listCashSessionsSchema,
  listCashMovementsSchema,
} from '../validations/cash.validation.js';
import { authenticate, authorizePermission } from '../middlewares/auth.js';
import { PERMISSION_CODES } from '../constants/permissions.js';

const router = Router();

router.use(authenticate);

router.get(
  '/summary',
  authorizePermission(PERMISSION_CODES.CAJA_VER),
  cashController.summary
);

router.get(
  '/current',
  authorizePermission(
    PERMISSION_CODES.CAJA_VER,
    PERMISSION_CODES.CAJA_ABRIR,
    PERMISSION_CODES.CAJA_CERRAR,
    PERMISSION_CODES.CAJA_MOVIMIENTO,
    PERMISSION_CODES.VENTAS_VER,
    PERMISSION_CODES.VENTAS_CREAR
  ),
  cashController.current
);

router.get(
  '/current/detail',
  authorizePermission(
    PERMISSION_CODES.CAJA_VER,
    PERMISSION_CODES.CAJA_ABRIR,
    PERMISSION_CODES.CAJA_CERRAR,
    PERMISSION_CODES.CAJA_MOVIMIENTO
  ),
  cashController.currentDetail
);

router.post(
  '/open',
  authorizePermission(PERMISSION_CODES.CAJA_ABRIR),
  validate(openCashSchema),
  cashController.open
);

router.get(
  '/',
  authorizePermission(PERMISSION_CODES.CAJA_VER),
  validate(listCashSessionsSchema, 'query'),
  cashController.list
);

router.get(
  '/:id/detail',
  authorizePermission(PERMISSION_CODES.CAJA_VER),
  cashController.getDetail
);

router.get(
  '/:id/movements',
  authorizePermission(PERMISSION_CODES.CAJA_VER),
  validate(listCashMovementsSchema, 'query'),
  cashController.listMovements
);

router.get(
  '/:id',
  authorizePermission(PERMISSION_CODES.CAJA_VER),
  cashController.getById
);

router.post(
  '/:id/movements',
  authorizePermission(PERMISSION_CODES.CAJA_MOVIMIENTO),
  validate(cashMovementSchema),
  cashController.addMovement
);

router.patch(
  '/:id/close',
  authorizePermission(PERMISSION_CODES.CAJA_CERRAR),
  validate(closeCashSchema),
  cashController.close
);

export default router;
