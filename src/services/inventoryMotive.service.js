import { pool } from '../config/database.js';
import { AppError } from '../utils/AppError.js';

const mapMotive = (row) => ({
  id: row.id,
  nombre: row.nombre,
  tipo: row.tipo,
  orden: Number(row.orden ?? 0),
  estado: row.estado,
  fecha_creacion: row.fecha_creacion,
  fecha_actualizacion: row.fecha_actualizacion,
});

export const listInventoryMotives = async ({ activos, estado, tipo } = {}) => {
  const conditions = ['1=1'];
  const params = [];

  if (activos === true || activos === 'true' || estado === 'activo') {
    conditions.push("estado = 'activo'");
  } else if (estado && estado !== 'todos') {
    conditions.push('estado = ?');
    params.push(estado);
  }

  if (tipo && tipo !== 'todos') {
    conditions.push('(tipo = ? OR tipo = ?)');
    params.push(tipo, 'ambos');
  }

  const [rows] = await pool.execute(
    `SELECT * FROM inventario_motivos
     WHERE ${conditions.join(' AND ')}
     ORDER BY orden ASC, nombre ASC`,
    params
  );

  return rows.map(mapMotive);
};

export const getInventoryMotiveById = async (id) => {
  const [rows] = await pool.execute(
    'SELECT * FROM inventario_motivos WHERE id = ? LIMIT 1',
    [id]
  );
  if (!rows.length) throw new AppError('Motivo de inventario no encontrado', 404);
  return mapMotive(rows[0]);
};

export const createInventoryMotive = async (data) => {
  const nombre = data.nombre.trim();
  const [dup] = await pool.execute(
    'SELECT id FROM inventario_motivos WHERE nombre = ? LIMIT 1',
    [nombre]
  );
  if (dup.length) throw new AppError('Ya existe un motivo con ese nombre', 409);

  const [result] = await pool.execute(
    `INSERT INTO inventario_motivos (nombre, tipo, orden, estado)
     VALUES (?, ?, ?, ?)`,
    [nombre, data.tipo ?? 'ambos', data.orden ?? 0, data.estado ?? 'activo']
  );

  return getInventoryMotiveById(result.insertId);
};

export const updateInventoryMotive = async (id, data) => {
  await getInventoryMotiveById(id);

  const updates = [];
  const params = [];

  if (data.nombre !== undefined) {
    const nombre = data.nombre.trim();
    const [dup] = await pool.execute(
      'SELECT id FROM inventario_motivos WHERE nombre = ? AND id != ? LIMIT 1',
      [nombre, id]
    );
    if (dup.length) throw new AppError('Ya existe un motivo con ese nombre', 409);
    updates.push('nombre = ?');
    params.push(nombre);
  }
  if (data.tipo !== undefined) {
    updates.push('tipo = ?');
    params.push(data.tipo);
  }
  if (data.orden !== undefined) {
    updates.push('orden = ?');
    params.push(data.orden);
  }
  if (data.estado !== undefined) {
    updates.push('estado = ?');
    params.push(data.estado);
  }

  if (!updates.length) return getInventoryMotiveById(id);

  params.push(id);
  await pool.execute(
    `UPDATE inventario_motivos SET ${updates.join(', ')} WHERE id = ?`,
    params
  );

  return getInventoryMotiveById(id);
};

export const deactivateInventoryMotive = async (id) => {
  await getInventoryMotiveById(id);
  await pool.execute(
    "UPDATE inventario_motivos SET estado = 'inactivo' WHERE id = ?",
    [id]
  );
  return getInventoryMotiveById(id);
};
