import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { signToken } from '../utils/jwt.js';
import {
  getPermissionCodesForUser,
  assignDefaultEmployeePermissions,
} from './permission.service.js';
import { ROLES } from '../constants/permissions.js';

const SALT_ROUNDS = 12;

const mapUserResponse = async (row) => {
  const permisos = await getPermissionCodesForUser(row.id, row.rol);
  return {
    id: row.id,
    nombre_usuario: row.nombre_usuario,
    estado: row.estado,
    rol: row.rol,
    rol_id: row.rol_id,
    permisos,
    fecha_creacion: row.fecha_creacion,
    fecha_actualizacion: row.fecha_actualizacion,
  };
};

export const login = async ({ nombre_usuario, contrasena }) => {
  const [rows] = await pool.execute(
    `SELECT u.id, u.nombre_usuario, u.contrasena, u.estado, u.rol_id,
            u.fecha_creacion, u.fecha_actualizacion, r.nombre AS rol
     FROM usuarios u
     INNER JOIN roles r ON r.id = u.rol_id
     WHERE u.nombre_usuario = ?
     LIMIT 1`,
    [nombre_usuario]
  );

  if (!rows.length) {
    throw new AppError('Credenciales incorrectas', 401);
  }

  const user = rows[0];

  if (user.estado !== 'activo') {
    throw new AppError('Usuario inactivo. Contacte al administrador', 403);
  }

  const validPassword = await bcrypt.compare(contrasena, user.contrasena);

  if (!validPassword) {
    throw new AppError('Credenciales incorrectas', 401);
  }

  const token = signToken({
    id: user.id,
    nombre_usuario: user.nombre_usuario,
    rol: user.rol,
  });

  const userResponse = await mapUserResponse(user);

  return {
    token,
    user: userResponse,
  };
};

export const register = async ({ nombre_usuario, contrasena, rol_id, estado }) => {
  const [existing] = await pool.execute(
    'SELECT id FROM usuarios WHERE nombre_usuario = ? LIMIT 1',
    [nombre_usuario]
  );

  if (existing.length) {
    throw new AppError('El nombre de usuario ya está en uso', 409);
  }

  let finalRolId = rol_id;

  if (!finalRolId) {
    const [defaultRole] = await pool.execute(
      "SELECT id FROM roles WHERE nombre = ? LIMIT 1",
      [ROLES.EMPLEADO]
    );
    finalRolId = defaultRole[0]?.id;
  }

  const [roleCheck] = await pool.execute(
    'SELECT id, nombre FROM roles WHERE id = ? AND activo = 1 LIMIT 1',
    [finalRolId]
  );

  if (!roleCheck.length) {
    throw new AppError('Rol no válido', 400);
  }

  const hash = await bcrypt.hash(contrasena, SALT_ROUNDS);

  const [result] = await pool.execute(
    `INSERT INTO usuarios (nombre_usuario, contrasena, estado, rol_id)
     VALUES (?, ?, ?, ?)`,
    [nombre_usuario, hash, estado || 'activo', finalRolId]
  );

  const userId = result.insertId;

  if (roleCheck[0].nombre === ROLES.EMPLEADO) {
    await assignDefaultEmployeePermissions(userId);
  }

  const [created] = await pool.execute(
    `SELECT u.id, u.nombre_usuario, u.estado, u.rol_id,
            u.fecha_creacion, u.fecha_actualizacion, r.nombre AS rol
     FROM usuarios u
     INNER JOIN roles r ON r.id = u.rol_id
     WHERE u.id = ?`,
    [userId]
  );

  return mapUserResponse(created[0]);
};

export const getProfile = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT u.id, u.nombre_usuario, u.estado, u.rol_id,
            u.fecha_creacion, u.fecha_actualizacion, r.nombre AS rol
     FROM usuarios u
     INNER JOIN roles r ON r.id = u.rol_id
     WHERE u.id = ? LIMIT 1`,
    [userId]
  );

  if (!rows.length) {
    throw new AppError('Usuario no encontrado', 404);
  }

  return mapUserResponse(rows[0]);
};
