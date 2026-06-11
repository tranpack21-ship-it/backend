import { Router } from 'express';
import * as cuentaCorrienteController from '../controllers/cuentaCorriente.controller.js';
import { validate } from '../middlewares/validate.js';
import {
  listAccountsQuerySchema,
  listMovementsQuerySchema,
  registerPaymentSchema,
  registerAdjustmentSchema,
} from '../validations/cuentaCorriente.validation.js';
import { authenticate, authorizePermission } from '../middlewares/auth.js';
import { PERMISSION_CODES } from '../constants/permissions.js';

const router = Router();

router.use(authenticate);

router.get(
  '/resumen',
  authorizePermission(
    PERMISSION_CODES.CUENTA_CORRIENTE_VER,
    PERMISSION_CODES.CLIENTES_VER
  ),
  cuentaCorrienteController.summary
);

router.get(
  '/',
  authorizePermission(
    PERMISSION_CODES.CUENTA_CORRIENTE_VER,
    PERMISSION_CODES.CLIENTES_VER
  ),
  validate(listAccountsQuerySchema, 'query'),
  cuentaCorrienteController.list
);

router.get(
  '/cliente/:clienteId',
  authorizePermission(
    PERMISSION_CODES.CUENTA_CORRIENTE_VER,
    PERMISSION_CODES.CLIENTES_VER
  ),
  cuentaCorrienteController.getByClient
);

router.get(
  '/cliente/:clienteId/movimientos',
  authorizePermission(
    PERMISSION_CODES.CUENTA_CORRIENTE_VER,
    PERMISSION_CODES.CLIENTES_VER
  ),
  validate(listMovementsQuerySchema, 'query'),
  cuentaCorrienteController.movements
);

router.post(
  '/cliente/:clienteId/cobro',
  authorizePermission(PERMISSION_CODES.CUENTA_CORRIENTE_COBRAR),
  validate(registerPaymentSchema),
  cuentaCorrienteController.pay
);

router.post(
  '/cliente/:clienteId/ajuste',
  authorizePermission(PERMISSION_CODES.CUENTA_CORRIENTE_AJUSTAR),
  validate(registerAdjustmentSchema),
  cuentaCorrienteController.adjust
);

export default router;
