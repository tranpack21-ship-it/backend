import { Router } from 'express';
import * as categoryController from '../controllers/category.controller.js';
import { validate } from '../middlewares/validate.js';
import {
  createCategorySchema,
  updateCategorySchema,
  listCategoriesQuerySchema,
} from '../validations/category.validation.js';
import { authenticate, authorizePermission } from '../middlewares/auth.js';
import { PERMISSION_CODES } from '../constants/permissions.js';

const router = Router();

router.use(authenticate);

router.get(
  '/activas',
  authorizePermission(
    PERMISSION_CODES.CATEGORIAS_VER,
    PERMISSION_CODES.PRODUCTOS_VER,
    PERMISSION_CODES.PRODUCTOS_CREAR,
    PERMISSION_CODES.PRODUCTOS_EDITAR
  ),
  categoryController.listActive
);

router.get(
  '/',
  authorizePermission(PERMISSION_CODES.CATEGORIAS_VER),
  validate(listCategoriesQuerySchema, 'query'),
  categoryController.list
);

router.get(
  '/:id',
  authorizePermission(PERMISSION_CODES.CATEGORIAS_VER),
  categoryController.getById
);

router.post(
  '/',
  authorizePermission(PERMISSION_CODES.CATEGORIAS_CREAR),
  validate(createCategorySchema),
  categoryController.create
);

router.put(
  '/:id',
  authorizePermission(PERMISSION_CODES.CATEGORIAS_EDITAR),
  validate(updateCategorySchema),
  categoryController.update
);

router.patch(
  '/:id/deactivate',
  authorizePermission(PERMISSION_CODES.CATEGORIAS_DESACTIVAR),
  categoryController.deactivate
);

export default router;
