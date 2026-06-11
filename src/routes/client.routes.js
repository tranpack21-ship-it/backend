import { Router } from 'express';
import * as clientController from '../controllers/client.controller.js';
import { validate } from '../middlewares/validate.js';
import {
  createClientSchema,
  updateClientSchema,
  listClientsQuerySchema,
} from '../validations/client.validation.js';
import { authenticate, authorizePermission } from '../middlewares/auth.js';
import { PERMISSION_CODES } from '../constants/permissions.js';

const router = Router();

router.use(authenticate);

router.get(
  '/activos',
  authorizePermission(
    PERMISSION_CODES.CLIENTES_VER,
    PERMISSION_CODES.VENTAS_CREAR,
    PERMISSION_CODES.VENTAS_VER
  ),
  clientController.listActive
);

router.get(
  '/',
  authorizePermission(PERMISSION_CODES.CLIENTES_VER),
  validate(listClientsQuerySchema, 'query'),
  clientController.list
);

router.get(
  '/:id',
  authorizePermission(PERMISSION_CODES.CLIENTES_VER),
  clientController.getById
);

router.post(
  '/',
  authorizePermission(PERMISSION_CODES.CLIENTES_CREAR),
  validate(createClientSchema),
  clientController.create
);

router.put(
  '/:id',
  authorizePermission(PERMISSION_CODES.CLIENTES_EDITAR),
  validate(updateClientSchema),
  clientController.update
);

router.patch(
  '/:id/deactivate',
  authorizePermission(PERMISSION_CODES.CLIENTES_DESACTIVAR),
  clientController.deactivate
);

export default router;
