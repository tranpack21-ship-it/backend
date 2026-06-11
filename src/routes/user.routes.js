import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { validate } from '../middlewares/validate.js';
import {
  createUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
} from '../validations/user.validation.js';
import { authenticate, authorizePermission } from '../middlewares/auth.js';
import { PERMISSION_CODES } from '../constants/permissions.js';

const router = Router();

router.use(authenticate);

router.get(
  '/roles',
  authorizePermission(
    PERMISSION_CODES.USUARIOS_VER,
    PERMISSION_CODES.USUARIOS_CREAR
  ),
  userController.getRoles
);

router.get(
  '/',
  authorizePermission(PERMISSION_CODES.USUARIOS_VER),
  validate(listUsersQuerySchema, 'query'),
  userController.list
);

router.get(
  '/:id',
  authorizePermission(PERMISSION_CODES.USUARIOS_VER),
  userController.getById
);

router.post(
  '/',
  authorizePermission(PERMISSION_CODES.USUARIOS_CREAR),
  validate(createUserSchema),
  userController.create
);

router.put(
  '/:id',
  authorizePermission(PERMISSION_CODES.USUARIOS_EDITAR),
  validate(updateUserSchema),
  userController.update
);

router.patch(
  '/:id/deactivate',
  authorizePermission(PERMISSION_CODES.USUARIOS_DESACTIVAR),
  userController.deactivate
);

export default router;
