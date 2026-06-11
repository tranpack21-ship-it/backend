import { Router } from 'express';
import * as permissionController from '../controllers/permission.controller.js';
import { authenticate, authorizePermission } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { assignPermissionsSchema } from '../validations/permission.validation.js';
import { PERMISSION_CODES } from '../constants/permissions.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorizePermission(PERMISSION_CODES.PERMISOS_VER, PERMISSION_CODES.PERMISOS_ASIGNAR),
  permissionController.listAll
);

router.get(
  '/empleados',
  authorizePermission(PERMISSION_CODES.PERMISOS_VER, PERMISSION_CODES.PERMISOS_ASIGNAR),
  permissionController.listEmployees
);

router.get(
  '/usuarios/:userId',
  authorizePermission(PERMISSION_CODES.PERMISOS_VER, PERMISSION_CODES.PERMISOS_ASIGNAR),
  permissionController.getByUser
);

router.put(
  '/usuarios/:userId',
  authorizePermission(PERMISSION_CODES.PERMISOS_ASIGNAR),
  validate(assignPermissionsSchema),
  permissionController.assign
);

export default router;
