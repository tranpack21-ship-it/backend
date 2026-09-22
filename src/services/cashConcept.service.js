import { pool } from '../config/database.js';
import { AppError } from '../utils/AppError.js';

const mapConcept = (row) => ({
  id: row.id,
  nombre: row.nombre,
  tipo: row.tipo,
  orden: Number(row.orden ?? 0),
  estado: row.estado,
  fecha_creacion: row.fecha_creacion,
  fecha_actualizacion: row.fecha_actualizacion,
});

export const listCashConcepts = async ({ activos, estado, tipo } = {}) => {
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
    `SELECT * FROM caja_conceptos
     WHERE ${conditions.join(' AND ')}
     ORDER BY orden ASC, nombre ASC`,
    params
  );

  return rows.map(mapConcept);
};

export const getCashConceptById = async (id) => {
  const [rows] = await pool.execute('SELECT * FROM caja_conceptos WHERE id = ? LIMIT 1', [id]);
  if (!rows.length) throw new AppError('Concepto de caja no encontrado', 404);
  return mapConcept(rows[0]);
};

export const createCashConcept = async (data) => {
  const nombre = data.nombre.trim();
  const [dup] = await pool.execute(
    'SELECT id FROM caja_conceptos WHERE nombre = ? LIMIT 1',
    [nombre]
  );
  if (dup.length) throw new AppError('Ya existe un concepto con ese nombre', 409);

  const [result] = await pool.execute(
    `INSERT INTO caja_conceptos (nombre, tipo, orden, estado)
     VALUES (?, ?, ?, ?)`,
    [nombre, data.tipo ?? 'egreso', data.orden ?? 0, data.estado ?? 'activo']
  );

  return getCashConceptById(result.insertId);
};

export const updateCashConcept = async (id, data) => {
  await getCashConceptById(id);

  const updates = [];
  const params = [];

  if (data.nombre !== undefined) {
    const nombre = data.nombre.trim();
    const [dup] = await pool.execute(
      'SELECT id FROM caja_conceptos WHERE nombre = ? AND id != ? LIMIT 1',
      [nombre, id]
    );
    if (dup.length) throw new AppError('Ya existe un concepto con ese nombre', 409);
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

  if (!updates.length) return getCashConceptById(id);

  params.push(id);
  await pool.execute(
    `UPDATE caja_conceptos SET ${updates.join(', ')} WHERE id = ?`,
    params
  );

  return getCashConceptById(id);
};

export const deactivateCashConcept = async (id) => {
  await getCashConceptById(id);
  await pool.execute("UPDATE caja_conceptos SET estado = 'inactivo' WHERE id = ?", [id]);
  return getCashConceptById(id);
};
