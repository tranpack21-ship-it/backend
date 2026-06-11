import { AppError } from '../utils/AppError.js';
import { verifyToken } from '../utils/jwt.js';
import { pool } from '../config/database.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getPermissionCodesForUser } from '../services/permission.service.js';
import { ROLES } from '../constants/permissions.js';

export const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('No autorizado. Token requerido', 401);
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  const [rows] = await pool.execute(
    `SELECT u.id, u.nombre_usuario, u.estado, u.rol_id, r.nombre AS rol
     FROM usuarios u
     INNER JOIN roles r ON r.id = u.rol_id
     WHERE u.id = ? LIMIT 1`,
    [decoded.id]
  );

  if (!rows.length) {
    throw new AppError('Usuario no encontrado', 401);
  }

  const user = rows[0];

  if (user.estado !== 'activo') {
    throw new AppError('Usuario inactivo', 403);
  }

  const permisos = await getPermissionCodesForUser(user.id, user.rol);

  req.user = {
    id: user.id,
    nombre_usuario: user.nombre_usuario,
    rol: user.rol,
    rol_id: user.rol_id,
    permisos,
  };

  next();
});

export const authorize = (...roles) =>
  asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw new AppError('No autorizado', 401);
    }

    if (roles.length && !roles.includes(req.user.rol)) {
      throw new AppError('No tiene permisos para esta acción', 403);
    }

    next();
  });

export const authorizePermission = (...requiredPermissions) =>
  asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw new AppError('No autorizado', 401);
    }

    if (req.user.rol === ROLES.ADMIN) {
      return next();
    }

    if (!requiredPermissions.length) {
      return next();
    }

    const userPerms = req.user.permisos || [];
    const hasPermission = requiredPermissions.some((p) => userPerms.includes(p));

    if (!hasPermission) {
      throw new AppError('No tiene permisos para realizar esta acción', 403);
    }

    next();
  });
