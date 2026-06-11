import { Router } from 'express';
import * as productController from '../controllers/product.controller.js';
import { validate } from '../middlewares/validate.js';
import {
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
  quickSearchProductsSchema,
} from '../validations/product.validation.js';

const QUICK_SEARCH_PERMISSIONS = [
  PERMISSION_CODES.PRODUCTOS_VER,
  PERMISSION_CODES.INVENTARIO_VER,
  PERMISSION_CODES.VENTAS_VER,
  PERMISSION_CODES.VENTAS_CREAR,
];
import { authenticate, authorizePermission } from '../middlewares/auth.js';
import { PERMISSION_CODES } from '../constants/permissions.js';

const router = Router();

router.use(authenticate);

router.get(
  '/quick-search',
  authorizePermission(...QUICK_SEARCH_PERMISSIONS),
  validate(quickSearchProductsSchema, 'query'),
  productController.quickSearch
);

router.get(
  '/unidades',
  authorizePermission(
    PERMISSION_CODES.PRODUCTOS_VER,
    PERMISSION_CODES.PRODUCTOS_CREAR,
    PERMISSION_CODES.PRODUCTOS_EDITAR
  ),
  productController.getUnits
);

router.get(
  '/',
  authorizePermission(PERMISSION_CODES.PRODUCTOS_VER),
  validate(listProductsQuerySchema, 'query'),
  productController.list
);

router.get(
  '/:id',
  authorizePermission(PERMISSION_CODES.PRODUCTOS_VER),
  productController.getById
);

router.post(
  '/',
  authorizePermission(PERMISSION_CODES.PRODUCTOS_CREAR),
  validate(createProductSchema),
  productController.create
);

router.put(
  '/:id',
  authorizePermission(PERMISSION_CODES.PRODUCTOS_EDITAR),
  validate(updateProductSchema),
  productController.update
);

router.patch(
  '/:id/deactivate',
  authorizePermission(PERMISSION_CODES.PRODUCTOS_DESACTIVAR),
  productController.deactivate
);

export default router;
