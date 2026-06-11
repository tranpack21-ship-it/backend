import { Router } from 'express';
import * as paymentMethodController from '../controllers/paymentMethod.controller.js';
import { validate } from '../middlewares/validate.js';
import {
  createPaymentMethodSchema,
  updatePaymentMethodSchema,
  listPaymentMethodsQuerySchema,
} from '../validations/paymentMethod.validation.js';
import { authenticate, authorizePermission } from '../middlewares/auth.js';
import { PERMISSION_CODES } from '../constants/permissions.js';

const router = Router();

const canRead = [
  PERMISSION_CODES.METODOS_PAGO_VER,
  PERMISSION_CODES.METODOS_PAGO_GESTIONAR,
  PERMISSION_CODES.VENTAS_VER,
  PERMISSION_CODES.VENTAS_CREAR,
];

router.use(authenticate);

router.get(
  '/',
  authorizePermission(...canRead),
  validate(listPaymentMethodsQuerySchema, 'query'),
  paymentMethodController.list
);

router.get(
  '/:id',
  authorizePermission(PERMISSION_CODES.METODOS_PAGO_GESTIONAR),
  paymentMethodController.getById
);

router.post(
  '/',
  authorizePermission(PERMISSION_CODES.METODOS_PAGO_GESTIONAR),
  validate(createPaymentMethodSchema),
  paymentMethodController.create
);

router.put(
  '/:id',
  authorizePermission(PERMISSION_CODES.METODOS_PAGO_GESTIONAR),
  validate(updatePaymentMethodSchema),
  paymentMethodController.update
);

router.patch(
  '/:id/deactivate',
  authorizePermission(PERMISSION_CODES.METODOS_PAGO_GESTIONAR),
  paymentMethodController.deactivate
);

export default router;
