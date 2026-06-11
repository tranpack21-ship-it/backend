import * as permissionService from '../services/permission.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listAll = asyncHandler(async (_req, res) => {
  const permisos = await permissionService.listAllPermissions();
  res.json({ success: true, data: { permisos } });
});

export const listEmployees = asyncHandler(async (_req, res) => {
  const empleados = await permissionService.listEmployeesForPermissions();
  res.json({ success: true, data: { empleados } });
});

export const getByUser = asyncHandler(async (req, res) => {
  const result = await permissionService.getUserPermissionsDetail(req.params.userId);
  res.json({ success: true, data: result });
});

export const assign = asyncHandler(async (req, res) => {
  const result = await permissionService.setUserPermissions(
    req.params.userId,
    req.body.permiso_ids
  );
  res.json({
    success: true,
    message: 'Permisos actualizados correctamente',
    data: result,
  });
});
