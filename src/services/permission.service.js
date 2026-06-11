import { pool } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import {
  ALL_PERMISSION_CODES,
  DEFAULT_EMPLOYEE_PERMISSIONS,
  ROLES,
} from '../constants/permissions.js';

export const getPermissionCodesForUser = async (userId, rol) => {
  if (rol === ROLES.ADMIN) {
    return [...ALL_PERMISSION_CODES];
  }

  const [rows] = await pool.execute(
    `SELECT p.codigo
     FROM usuario_permisos up
     INNER JOIN permisos p ON p.id = up.permiso_id
     WHERE up.usuario_id = ?`,
    [userId]
  );

  return rows.map((r) => r.codigo);
};

export const listAllPermissions = async () => {
  const [rows] = await pool.execute(
    `SELECT id, codigo, modulo, descripcion
     FROM permisos
     ORDER BY modulo, codigo`
  );
  return rows;
};

export const getUserPermissionsDetail = async (userId) => {
  const [userRows] = await pool.execute(
    `SELECT u.id, u.nombre_usuario, r.nombre AS rol
     FROM usuarios u
     INNER JOIN roles r ON r.id = u.rol_id
     WHERE u.id = ? LIMIT 1`,
    [userId]
  );

  if (!userRows.length) {
    throw new AppError('Usuario no encontrado', 404);
  }

  const user = userRows[0];

  if (user.rol === ROLES.ADMIN) {
    const all = await listAllPermissions();
    return {
      user,
      permisos: all.map((p) => ({ ...p, asignado: true })),
      es_admin: true,
    };
  }

  const [allPerms] = await pool.execute(
    'SELECT id, codigo, modulo, descripcion FROM permisos ORDER BY modulo, codigo'
  );

  const [assigned] = await pool.execute(
    `SELECT permiso_id FROM usuario_permisos WHERE usuario_id = ?`,
    [userId]
  );

  const assignedIds = new Set(assigned.map((a) => a.permiso_id));

  return {
    user,
    permisos: allPerms.map((p) => ({
      ...p,
      asignado: assignedIds.has(p.id),
    })),
    es_admin: false,
  };
};

export const assignDefaultEmployeePermissions = async (userId) => {
  const [perms] = await pool.execute(
    `SELECT id, codigo FROM permisos WHERE codigo IN (${DEFAULT_EMPLOYEE_PERMISSIONS.map(() => '?').join(',')})`,
    DEFAULT_EMPLOYEE_PERMISSIONS
  );

  for (const perm of perms) {
    await pool.execute(
      'INSERT IGNORE INTO usuario_permisos (usuario_id, permiso_id) VALUES (?, ?)',
      [userId, perm.id]
    );
  }
};

export const setUserPermissions = async (userId, permisoIds) => {
  const [userRows] = await pool.execute(
    `SELECT u.id, r.nombre AS rol FROM usuarios u
     INNER JOIN roles r ON r.id = u.rol_id
     WHERE u.id = ? LIMIT 1`,
    [userId]
  );

  if (!userRows.length) {
    throw new AppError('Usuario no encontrado', 404);
  }

  if (userRows[0].rol === ROLES.ADMIN) {
    throw new AppError('No se pueden modificar permisos de un administrador', 400);
  }

  const uniqueIds = [...new Set(permisoIds.map(Number).filter(Boolean))];

  if (uniqueIds.length) {
    const placeholders = uniqueIds.map(() => '?').join(',');
    const [valid] = await pool.execute(
      `SELECT id FROM permisos WHERE id IN (${placeholders})`,
      uniqueIds
    );
    if (valid.length !== uniqueIds.length) {
      throw new AppError('Uno o más permisos no son válidos', 400);
    }
  }

  const [dashboardRows] = await pool.execute(
    "SELECT id FROM permisos WHERE codigo = 'dashboard.ver' LIMIT 1"
  );
  const dashboardId = dashboardRows[0]?.id;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('DELETE FROM usuario_permisos WHERE usuario_id = ?', [userId]);

    const idsToInsert = [...uniqueIds];
    if (dashboardId && !idsToInsert.includes(dashboardId)) {
      idsToInsert.push(dashboardId);
    }

    for (const permId of idsToInsert) {
      await connection.execute(
        'INSERT INTO usuario_permisos (usuario_id, permiso_id) VALUES (?, ?)',
        [userId, permId]
      );
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  return getUserPermissionsDetail(userId);
};

export const listEmployeesForPermissions = async () => {
  const [rows] = await pool.execute(
    `SELECT u.id, u.nombre_usuario, u.estado, r.nombre AS rol
     FROM usuarios u
     INNER JOIN roles r ON r.id = u.rol_id
     WHERE r.nombre = ? AND u.estado = 'activo'
     ORDER BY u.nombre_usuario`,
    [ROLES.EMPLEADO]
  );
  return rows;
};
