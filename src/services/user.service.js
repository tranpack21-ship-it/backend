import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';
import { sqlLimitOffset } from '../utils/paginationSql.js';
import { AppError } from '../utils/AppError.js';
import { assignDefaultEmployeePermissions } from './permission.service.js';
import { ROLES } from '../constants/permissions.js';

const SALT_ROUNDS = 12;

const mapUser = (row) => ({
  id: row.id,
  nombre_usuario: row.nombre_usuario,
  estado: row.estado,
  rol: row.rol,
  rol_id: row.rol_id,
  fecha_creacion: row.fecha_creacion,
  fecha_actualizacion: row.fecha_actualizacion,
});

export const listUsers = async ({ page, limit, search, estado, rol_id }) => {
  const offset = (page - 1) * limit;
  const conditions = ['1=1'];
  const params = [];

  if (search) {
    conditions.push('u.nombre_usuario LIKE ?');
    params.push(`%${search}%`);
  }

  if (estado && estado !== 'todos') {
    conditions.push('u.estado = ?');
    params.push(estado);
  }

  if (rol_id) {
    conditions.push('u.rol_id = ?');
    params.push(rol_id);
  }

  const whereClause = conditions.join(' AND ');

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM usuarios u
     WHERE ${whereClause}`,
    params
  );

  const total = countRows[0].total;

  const [rows] = await pool.execute(
    `SELECT u.id, u.nombre_usuario, u.estado, u.rol_id,
            u.fecha_creacion, u.fecha_actualizacion, r.nombre AS rol
     FROM usuarios u
     INNER JOIN roles r ON r.id = u.rol_id
     WHERE ${whereClause}
     ORDER BY u.fecha_creacion DESC
     ${sqlLimitOffset(limit, offset)}`,
    params
  );

  return {
    data: rows.map(mapUser),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export const getUserById = async (id) => {
  const [rows] = await pool.execute(
    `SELECT u.id, u.nombre_usuario, u.estado, u.rol_id,
            u.fecha_creacion, u.fecha_actualizacion, r.nombre AS rol
     FROM usuarios u
     INNER JOIN roles r ON r.id = u.rol_id
     WHERE u.id = ? LIMIT 1`,
    [id]
  );

  if (!rows.length) {
    throw new AppError('Usuario no encontrado', 404);
  }

  return mapUser(rows[0]);
};

export const createUser = async (data) => {
  const [existing] = await pool.execute(
    'SELECT id FROM usuarios WHERE nombre_usuario = ? LIMIT 1',
    [data.nombre_usuario]
  );

  if (existing.length) {
    throw new AppError('El nombre de usuario ya está en uso', 409);
  }

  const [roleCheck] = await pool.execute(
    'SELECT id, nombre FROM roles WHERE id = ? AND activo = 1 LIMIT 1',
    [data.rol_id]
  );

  if (!roleCheck.length) {
    throw new AppError('Rol no válido', 400);
  }

  const hash = await bcrypt.hash(data.contrasena, SALT_ROUNDS);

  const [result] = await pool.execute(
    `INSERT INTO usuarios (nombre_usuario, contrasena, estado, rol_id)
     VALUES (?, ?, ?, ?)`,
    [data.nombre_usuario, hash, data.estado, data.rol_id]
  );

  const userId = result.insertId;

  if (roleCheck[0].nombre === ROLES.EMPLEADO) {
    await assignDefaultEmployeePermissions(userId);
  }

  return getUserById(userId);
};

export const updateUser = async (id, data, currentUserId) => {
  const user = await getUserById(id);

  if (Number(id) === Number(currentUserId) && data.estado === 'inactivo') {
    throw new AppError('No puede desactivar su propia cuenta', 400);
  }

  const updates = [];
  const params = [];

  if (data.nombre_usuario) {
    const [dup] = await pool.execute(
      'SELECT id FROM usuarios WHERE nombre_usuario = ? AND id != ? LIMIT 1',
      [data.nombre_usuario, id]
    );
    if (dup.length) {
      throw new AppError('El nombre de usuario ya está en uso', 409);
    }
    updates.push('nombre_usuario = ?');
    params.push(data.nombre_usuario);
  }

  if (data.contrasena) {
    const hash = await bcrypt.hash(data.contrasena, SALT_ROUNDS);
    updates.push('contrasena = ?');
    params.push(hash);
  }

  if (data.rol_id) {
    const [roleCheck] = await pool.execute(
      'SELECT id FROM roles WHERE id = ? AND activo = 1 LIMIT 1',
      [data.rol_id]
    );
    if (!roleCheck.length) {
      throw new AppError('Rol no válido', 400);
    }
    updates.push('rol_id = ?');
    params.push(data.rol_id);
  }

  if (data.estado) {
    updates.push('estado = ?');
    params.push(data.estado);
  }

  if (!updates.length) {
    return user;
  }

  params.push(id);
  await pool.execute(
    `UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`,
    params
  );

  return getUserById(id);
};

export const deactivateUser = async (id, currentUserId) => {
  if (Number(id) === Number(currentUserId)) {
    throw new AppError('No puede desactivar su propia cuenta', 400);
  }

  await getUserById(id);

  await pool.execute(
    "UPDATE usuarios SET estado = 'inactivo' WHERE id = ?",
    [id]
  );

  return getUserById(id);
};

export const listRoles = async () => {
  const [rows] = await pool.execute(
    `SELECT id, nombre, descripcion FROM roles
     WHERE activo = 1 AND nombre IN (?, ?)
     ORDER BY FIELD(nombre, ?, ?)`,
    [ROLES.ADMIN, ROLES.EMPLEADO, ROLES.ADMIN, ROLES.EMPLEADO]
  );
  return rows;
};
