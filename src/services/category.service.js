import { pool } from '../config/database.js';
import { AppError } from '../utils/AppError.js';

const mapCategory = (row) => ({
  id: row.id,
  nombre: row.nombre,
  descripcion: row.descripcion,
  estado: row.estado,
  total_productos: Number(row.total_productos ?? 0),
  fecha_creacion: row.fecha_creacion,
  fecha_actualizacion: row.fecha_actualizacion,
});

export const listCategories = async ({ page, limit, search, estado }) => {
  const offset = (page - 1) * limit;
  const conditions = ['1=1'];
  const params = [];

  if (search) {
    conditions.push('(c.nombre LIKE ? OR c.descripcion LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  if (estado && estado !== 'todos') {
    conditions.push('c.estado = ?');
    params.push(estado);
  }

  const whereClause = conditions.join(' AND ');

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM categorias c WHERE ${whereClause}`,
    params
  );

  const total = countRows[0].total;

  const [rows] = await pool.execute(
    `SELECT c.id, c.nombre, c.descripcion, c.estado,
            c.fecha_creacion, c.fecha_actualizacion,
            (SELECT COUNT(*) FROM productos p WHERE p.categoria_id = c.id) AS total_productos
     FROM categorias c
     WHERE ${whereClause}
     ORDER BY c.nombre ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    data: rows.map(mapCategory),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export const listCategoriesActive = async () => {
  const [rows] = await pool.execute(
    `SELECT id, nombre FROM categorias WHERE estado = 'activo' ORDER BY nombre ASC`
  );
  return rows;
};

export const getCategoryById = async (id) => {
  const [rows] = await pool.execute(
    `SELECT c.id, c.nombre, c.descripcion, c.estado,
            c.fecha_creacion, c.fecha_actualizacion,
            (SELECT COUNT(*) FROM productos p WHERE p.categoria_id = c.id) AS total_productos
     FROM categorias c WHERE c.id = ? LIMIT 1`,
    [id]
  );

  if (!rows.length) {
    throw new AppError('Categoría no encontrada', 404);
  }

  return mapCategory(rows[0]);
};

export const createCategory = async (data) => {
  const [existing] = await pool.execute(
    'SELECT id FROM categorias WHERE nombre = ? LIMIT 1',
    [data.nombre]
  );

  if (existing.length) {
    throw new AppError('Ya existe una categoría con ese nombre', 409);
  }

  const [result] = await pool.execute(
    `INSERT INTO categorias (nombre, descripcion, estado) VALUES (?, ?, ?)`,
    [data.nombre, data.descripcion ?? null, data.estado]
  );

  return getCategoryById(result.insertId);
};

export const updateCategory = async (id, data) => {
  await getCategoryById(id);

  const updates = [];
  const params = [];

  if (data.nombre !== undefined) {
    const [dup] = await pool.execute(
      'SELECT id FROM categorias WHERE nombre = ? AND id != ? LIMIT 1',
      [data.nombre, id]
    );
    if (dup.length) {
      throw new AppError('Ya existe una categoría con ese nombre', 409);
    }
    updates.push('nombre = ?');
    params.push(data.nombre);
  }

  if (data.descripcion !== undefined) {
    updates.push('descripcion = ?');
    params.push(data.descripcion);
  }

  if (data.estado !== undefined) {
    updates.push('estado = ?');
    params.push(data.estado);
  }

  if (!updates.length) {
    return getCategoryById(id);
  }

  params.push(id);
  await pool.execute(
    `UPDATE categorias SET ${updates.join(', ')} WHERE id = ?`,
    params
  );

  return getCategoryById(id);
};

export const deactivateCategory = async (id) => {
  await getCategoryById(id);

  const [products] = await pool.execute(
    "SELECT COUNT(*) AS total FROM productos WHERE categoria_id = ? AND estado = 'activo'",
    [id]
  );

  if (products[0].total > 0) {
    throw new AppError(
      'No se puede desactivar: tiene productos activos asociados',
      400
    );
  }

  await pool.execute("UPDATE categorias SET estado = 'inactivo' WHERE id = ?", [id]);

  return getCategoryById(id);
};
