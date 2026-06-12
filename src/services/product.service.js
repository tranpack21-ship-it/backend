import { pool } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { sqlLimit, sqlLimitOffset } from '../utils/paginationSql.js';
import { withTransaction } from '../utils/transaction.js';

const mapProduct = (row) => ({
  id: row.id,
  codigo: row.codigo,
  nombre: row.nombre,
  descripcion: row.descripcion,
  imagen_url: row.imagen_url ?? null,
  color: row.color ?? null,
  talle: row.talle ?? null,
  categoria_id: row.categoria_id,
  categoria_nombre: row.categoria_nombre,
  precio_venta: Number(row.precio_venta),
  precio_venta_paquete:
    row.precio_venta_paquete != null ? Number(row.precio_venta_paquete) : null,
  unidades_por_paquete: Number(row.unidades_por_paquete ?? 1),
  precio_costo: Number(row.precio_costo),
  stock: Number(row.stock),
  stock_minimo: Number(row.stock_minimo),
  unidad_medida: row.unidad_medida,
  estado: row.estado,
  stock_bajo: Number(row.stock) <= Number(row.stock_minimo),
  ventas_asociadas: Number(row.ventas_asociadas ?? 0),
  puede_eliminar: Number(row.ventas_asociadas ?? 0) === 0,
  fecha_creacion: row.fecha_creacion,
  fecha_actualizacion: row.fecha_actualizacion,
});

const baseSelect = `
  SELECT p.id, p.codigo, p.nombre, p.descripcion,
         p.imagen_url, p.color, p.talle,
         p.categoria_id, c.nombre AS categoria_nombre,
         p.precio_venta, p.precio_venta_paquete, p.unidades_por_paquete,
         p.precio_costo, p.stock, p.stock_minimo,
         p.unidad_medida, p.estado, p.fecha_creacion, p.fecha_actualizacion,
         (SELECT COUNT(*) FROM venta_detalle vd WHERE vd.producto_id = p.id) AS ventas_asociadas
  FROM productos p
  INNER JOIN categorias c ON c.id = p.categoria_id
`;

const searchCondition =
  '(p.codigo LIKE ? OR p.nombre LIKE ? OR p.descripcion LIKE ? OR p.color LIKE ? OR p.talle LIKE ?)';

/** Búsqueda rápida en mostrador (código, nombre, descripción) */
export const quickSearchProducts = async ({ q, limit = 12 }) => {
  const term = `%${q}%`;
  const exactCode = q.trim();

  const [rows] = await pool.execute(
    `${baseSelect}
     WHERE p.estado = 'activo'
       AND ${searchCondition}
     ORDER BY
       CASE
         WHEN p.codigo = ? THEN 0
         WHEN p.codigo LIKE ? THEN 1
         WHEN p.nombre LIKE ? THEN 2
         ELSE 3
       END,
       p.nombre ASC
     ${sqlLimit(limit, { maxLimit: 50 })}`,
    [term, term, term, term, term, exactCode, `${exactCode}%`, `${q}%`]
  );

  return rows.map(mapProduct);
};

export const listProducts = async ({ page, limit, search, estado, categoria_id }) => {
  const offset = (page - 1) * limit;
  const conditions = ['1=1'];
  const params = [];

  if (search) {
    conditions.push(searchCondition);
    const term = `%${search}%`;
    params.push(term, term, term, term, term);
  }

  if (estado && estado !== 'todos') {
    conditions.push('p.estado = ?');
    params.push(estado);
  }

  if (categoria_id) {
    conditions.push('p.categoria_id = ?');
    params.push(categoria_id);
  }

  const whereClause = conditions.join(' AND ');

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM productos p WHERE ${whereClause}`,
    params
  );

  const total = countRows[0].total;

  const [rows] = await pool.execute(
    `${baseSelect}
     WHERE ${whereClause}
     ORDER BY p.fecha_creacion DESC
     ${sqlLimitOffset(limit, offset)}`,
    params
  );

  return {
    data: rows.map(mapProduct),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export const getProductById = async (id) => {
  const [rows] = await pool.execute(`${baseSelect} WHERE p.id = ? LIMIT 1`, [id]);

  if (!rows.length) {
    throw new AppError('Producto no encontrado', 404);
  }

  return mapProduct(rows[0]);
};

const validateCategoryActive = async (categoriaId) => {
  const [cat] = await pool.execute(
    "SELECT id FROM categorias WHERE id = ? AND estado = 'activo' LIMIT 1",
    [categoriaId]
  );
  if (!cat.length) {
    throw new AppError('La categoría no existe o está inactiva', 400);
  }
};

export const createProduct = async (data) => {
  const codigo = data.codigo ?? null;

  if (codigo) {
    const [existing] = await pool.execute(
      'SELECT id FROM productos WHERE codigo = ? LIMIT 1',
      [codigo]
    );

    if (existing.length) {
      throw new AppError('Ya existe un producto con ese código', 409);
    }
  }

  await validateCategoryActive(data.categoria_id);

  const [result] = await pool.execute(
    `INSERT INTO productos (
      codigo, nombre, descripcion, imagen_url, color, talle, categoria_id,
      precio_venta, precio_venta_paquete, unidades_por_paquete,
      precio_costo, stock, stock_minimo,
      unidad_medida, estado
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      codigo,
      data.nombre,
      data.descripcion ?? null,
      data.imagen_url ?? null,
      data.color ?? null,
      data.talle ?? null,
      data.categoria_id,
      data.precio_venta,
      data.precio_venta_paquete ?? null,
      data.unidades_por_paquete ?? 1,
      data.precio_costo ?? 0,
      data.stock ?? 0,
      data.stock_minimo ?? 0,
      data.unidad_medida,
      data.estado,
    ]
  );

  return getProductById(result.insertId);
};

export const updateProduct = async (id, data) => {
  await getProductById(id);

  const updates = [];
  const params = [];

  if (data.codigo !== undefined) {
    const codigo = data.codigo ?? null;

    if (codigo) {
      const [dup] = await pool.execute(
        'SELECT id FROM productos WHERE codigo = ? AND id != ? LIMIT 1',
        [codigo, id]
      );
      if (dup.length) {
        throw new AppError('Ya existe un producto con ese código', 409);
      }
    }

    updates.push('codigo = ?');
    params.push(codigo);
  }

  if (data.nombre !== undefined) {
    updates.push('nombre = ?');
    params.push(data.nombre);
  }

  if (data.descripcion !== undefined) {
    updates.push('descripcion = ?');
    params.push(data.descripcion);
  }

  if (data.imagen_url !== undefined) {
    updates.push('imagen_url = ?');
    params.push(data.imagen_url);
  }

  if (data.color !== undefined) {
    updates.push('color = ?');
    params.push(data.color);
  }

  if (data.talle !== undefined) {
    updates.push('talle = ?');
    params.push(data.talle);
  }

  if (data.categoria_id !== undefined) {
    await validateCategoryActive(data.categoria_id);
    updates.push('categoria_id = ?');
    params.push(data.categoria_id);
  }

  if (data.precio_venta !== undefined) {
    updates.push('precio_venta = ?');
    params.push(data.precio_venta);
  }

  if (data.precio_venta_paquete !== undefined) {
    updates.push('precio_venta_paquete = ?');
    params.push(data.precio_venta_paquete);
  }

  if (data.unidades_por_paquete !== undefined) {
    updates.push('unidades_por_paquete = ?');
    params.push(data.unidades_por_paquete);
  }

  if (data.precio_costo !== undefined) {
    updates.push('precio_costo = ?');
    params.push(data.precio_costo);
  }

  if (data.stock_minimo !== undefined) {
    updates.push('stock_minimo = ?');
    params.push(data.stock_minimo);
  }

  if (data.unidad_medida !== undefined) {
    updates.push('unidad_medida = ?');
    params.push(data.unidad_medida);
  }

  if (data.estado !== undefined) {
    updates.push('estado = ?');
    params.push(data.estado);
  }

  if (!updates.length) {
    return getProductById(id);
  }

  params.push(id);
  await pool.execute(
    `UPDATE productos SET ${updates.join(', ')} WHERE id = ?`,
    params
  );

  return getProductById(id);
};

export const deactivateProduct = async (id) => {
  await getProductById(id);
  await pool.execute("UPDATE productos SET estado = 'inactivo' WHERE id = ?", [id]);
  return getProductById(id);
};

export const deleteProduct = async (id) => {
  return withTransaction(async (conn) => {
    const producto = await getProductById(id);

    const [sales] = await conn.execute(
      'SELECT COUNT(*) AS total FROM venta_detalle WHERE producto_id = ?',
      [id]
    );

    if (Number(sales[0].total) > 0) {
      throw new AppError(
        'No se puede eliminar: el producto está asociado a ventas registradas. Desactívelo en su lugar.',
        409
      );
    }

    await conn.execute('DELETE FROM movimientos_inventario WHERE producto_id = ?', [id]);
    await conn.execute('DELETE FROM productos WHERE id = ?', [id]);

    return {
      id: producto.id,
      nombre: producto.nombre,
      eliminado: true,
    };
  });
};
