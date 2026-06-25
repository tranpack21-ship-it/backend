import { Router } from 'express';
import * as quoteController from '../controllers/quote.controller.js';
import { validate } from '../middlewares/validate.js';
import {
  createQuoteSchema,
  listQuotesQuerySchema,
} from '../validations/quote.validation.js';
import { authenticate, authorizePermission } from '../middlewares/auth.js';
import { PERMISSION_CODES } from '../constants/permissions.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorizePermission(PERMISSION_CODES.PRESUPUESTOS_VER),
  validate(listQuotesQuerySchema, 'query'),
  quoteController.list
);

router.get(
  '/:id/print',
  authorizePermission(PERMISSION_CODES.PRESUPUESTOS_VER),
  quoteController.getPrintData
);

router.get(
  '/:id',
  authorizePermission(PERMISSION_CODES.PRESUPUESTOS_VER),
  quoteController.getById
);

router.post(
  '/',
  authorizePermission(PERMISSION_CODES.PRESUPUESTOS_CREAR),
  validate(createQuoteSchema),
  quoteController.create
);

router.patch(
  '/:id/cancel',
  authorizePermission(PERMISSION_CODES.PRESUPUESTOS_ANULAR),
  quoteController.cancel
);

export default router;
