import { Router } from 'express';
import * as cashConceptController from '../controllers/cashConcept.controller.js';
import { validate } from '../middlewares/validate.js';
import {
  createCashConceptSchema,
  updateCashConceptSchema,
  listCashConceptsQuerySchema,
} from '../validations/cashConcept.validation.js';
import { authenticate, authorizePermission } from '../middlewares/auth.js';
import { PERMISSION_CODES } from '../constants/permissions.js';

const router = Router();

const canRead = [
  PERMISSION_CODES.CAJA_CONCEPTOS_VER,
  PERMISSION_CODES.CAJA_CONCEPTOS_GESTIONAR,
  PERMISSION_CODES.CAJA_VER,
  PERMISSION_CODES.CAJA_MOVIMIENTO,
  PERMISSION_CODES.REPORTES_VER,
];

router.use(authenticate);

router.get(
  '/',
  authorizePermission(...canRead),
  validate(listCashConceptsQuerySchema, 'query'),
  cashConceptController.list
);

router.get(
  '/:id',
  authorizePermission(PERMISSION_CODES.CAJA_CONCEPTOS_GESTIONAR),
  cashConceptController.getById
);

router.post(
  '/',
  authorizePermission(PERMISSION_CODES.CAJA_CONCEPTOS_GESTIONAR),
  validate(createCashConceptSchema),
  cashConceptController.create
);

router.put(
  '/:id',
  authorizePermission(PERMISSION_CODES.CAJA_CONCEPTOS_GESTIONAR),
  validate(updateCashConceptSchema),
  cashConceptController.update
);

router.patch(
  '/:id/deactivate',
  authorizePermission(PERMISSION_CODES.CAJA_CONCEPTOS_GESTIONAR),
  cashConceptController.deactivate
);

export default router;
