import { pool } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { sqlLimitOffset } from '../utils/paginationSql.js';
import { withTransaction } from '../utils/transaction.js';

const mapMovement = (row) => ({
  id: row.id,
  producto_id: row.producto_id,
  producto_nombre: row.producto_nombre,
  producto_codigo: row.producto_codigo,
  tipo: row.tipo,
  cantidad: Number(row.cantidad),
  stock_anterior: Number(row.stock_anterior),
  stock_posterior: Number(row.stock_posterior),
  motivo: row.motivo,
  referencia: row.referencia,
  usuario_id: row.usuario_id,
  usuario_nombre: row.usuario_nombre,
  fecha: row.fecha,
});

const baseSelect = `
  SELECT m.id, m.producto_id, m.tipo, m.cantidad, m.stock_anterior, m.stock_posterior,
         m.motivo, m.referencia, m.usuario_id, m.fecha,
         p.nombre AS producto_nombre, p.codigo AS producto_codigo,
         u.nombre_usuario AS usuario_nombre
  FROM movimientos_inventario m
  INNER JOIN productos p ON p.id = m.producto_id
  LEFT JOIN usuarios u ON u.id = m.usuario_id
`;

export const registerMovement = async (data, usuarioId, connection = null) => {
  const exec = async (conn) => {
    const [products] = await conn.execute(
      "SELECT id, stock, nombre FROM productos WHERE id = ? AND estado = 'activo' LIMIT 1",
      [data.producto_id]
    );

    if (!products.length) {
      throw new AppError('Producto no encontrado o inactivo', 400);
    }

    const product = products[0];
    const stockAnterior = Number(product.stock);
    let stockPosterior;
    let cantidadRegistro = Number(data.cantidad);

    if (data.tipo === 'entrada') {
      stockPosterior = stockAnterior + cantidadRegistro;
    } else if (data.tipo === 'salida') {
      stockPosterior = stockAnterior - cantidadRegistro;
    } else if (data.tipo === 'ajuste') {
      stockPosterior = cantidadRegistro;
      cantidadRegistro = Math.abs(stockPosterior - stockAnterior);
    }

    await conn.execute('UPDATE productos SET stock = ? WHERE id = ?', [
      stockPosterior,
      data.producto_id,
    ]);

    const [result] = await conn.execute(
      `INSERT INTO movimientos_inventario (
        producto_id, tipo, cantidad, stock_anterior, stock_posterior,
        motivo, referencia, usuario_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.producto_id,
        data.tipo,
        cantidadRegistro,
        stockAnterior,
        stockPosterior,
        data.motivo,
        data.referencia ?? null,
        usuarioId ?? null,
      ]
    );

    const [rows] = await conn.execute(`${baseSelect} WHERE m.id = ?`, [result.insertId]);
    return mapMovement(rows[0]);
  };

  if (connection) {
    return exec(connection);
  }
  return withTransaction(exec);
};

export const listMovements = async (query) => {
  const { page, limit, producto_id, tipo, fecha_desde, fecha_hasta } = query;
  const offset = (page - 1) * limit;
  const conditions = ['1=1'];
  const params = [];

  if (producto_id) {
    conditions.push('m.producto_id = ?');
    params.push(producto_id);
  }

  if (tipo && tipo !== 'todos') {
    conditions.push('m.tipo = ?');
    params.push(tipo);
  }

  if (fecha_desde) {
    conditions.push('DATE(m.fecha) >= ?');
    params.push(fecha_desde);
  }

  if (fecha_hasta) {
    conditions.push('DATE(m.fecha) <= ?');
    params.push(fecha_hasta);
  }

  const whereClause = conditions.join(' AND ');

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM movimientos_inventario m WHERE ${whereClause}`,
    params
  );

  const total = countRows[0].total;

  const [rows] = await pool.execute(
    `${baseSelect}
     WHERE ${whereClause}
     ORDER BY m.fecha DESC
     ${sqlLimitOffset(limit, offset)}`,
    params
  );

  return {
    data: rows.map(mapMovement),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

const mapStockAlertProduct = (row) => {
  const stock = Number(row.stock);
  const stockMinimo = Number(row.stock_minimo);
  let tipo_alerta = 'bajo';

  if (stock < 0) tipo_alerta = 'negativo';
  else if (stock === 0) tipo_alerta = 'sin_stock';
  else if (stock < stockMinimo) tipo_alerta = 'critico';
  else if (stock <= stockMinimo) tipo_alerta = 'bajo';

  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    imagen_url: row.imagen_url ?? null,
    color: row.color ?? null,
    talle: row.talle ?? null,
    categoria_id: row.categoria_id,
    categoria_nombre: row.categoria_nombre,
    precio_venta: Number(row.precio_venta),
    stock,
    stock_minimo: stockMinimo,
    unidad_medida: row.unidad_medida,
    diferencia: stock - stockMinimo,
    tipo_alerta,
    fecha_actualizacion: row.fecha_actualizacion,
  };
};

const stockAlertFilterSql = (filtro) => {
  switch (filtro) {
    case 'negativo':
      return 'p.stock < 0';
    case 'sin_stock':
      return 'p.stock = 0';
    case 'bajo':
      return 'p.stock > 0 AND p.stock <= p.stock_minimo';
    case 'critico':
      return 'p.stock < p.stock_minimo';
    case 'todos':
    default:
      return '(p.stock <= p.stock_minimo OR p.stock < 0)';
  }
};

export const listStockAlerts = async (query) => {
  const { page, limit, filtro, search, categoria_id, producto_id } = query;
  const offset = (page - 1) * limit;
  const conditions = ["p.estado = 'activo'", stockAlertFilterSql(filtro)];
  const params = [];

  if (search) {
    conditions.push(
      '(p.codigo LIKE ? OR p.nombre LIKE ? OR p.descripcion LIKE ? OR p.color LIKE ? OR p.talle LIKE ?)'
    );
    const term = `%${search}%`;
    params.push(term, term, term, term, term);
  }

  if (categoria_id) {
    conditions.push('p.categoria_id = ?');
    params.push(categoria_id);
  }

  if (producto_id) {
    conditions.push('p.id = ?');
    params.push(producto_id);
  }

  const whereClause = conditions.join(' AND ');

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM productos p
     INNER JOIN categorias c ON c.id = p.categoria_id
     WHERE ${whereClause}`,
    params
  );

  const total = countRows[0].total;

  const [rows] = await pool.execute(
    `SELECT p.id, p.codigo, p.nombre, p.imagen_url, p.color, p.talle,
            p.categoria_id, c.nombre AS categoria_nombre,
            p.precio_venta, p.stock, p.stock_minimo, p.unidad_medida,
            p.fecha_actualizacion
     FROM productos p
     INNER JOIN categorias c ON c.id = p.categoria_id
     WHERE ${whereClause}
     ORDER BY
       CASE WHEN p.id = ? THEN 0 ELSE 1 END,
       p.stock ASC,
       p.nombre ASC
     ${sqlLimitOffset(limit, offset)}`,
    [...params, producto_id || 0]
  );

  return {
    data: rows.map(mapStockAlertProduct),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export const getStockAlertsSummary = async () => {
  const [rows] = await pool.execute(
    `SELECT
       SUM(CASE WHEN stock <= stock_minimo OR stock < 0 THEN 1 ELSE 0 END) AS todos,
       SUM(CASE WHEN stock > 0 AND stock <= stock_minimo THEN 1 ELSE 0 END) AS bajo,
       SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) AS sin_stock,
       SUM(CASE WHEN stock < 0 THEN 1 ELSE 0 END) AS negativo,
       SUM(CASE WHEN stock < stock_minimo THEN 1 ELSE 0 END) AS critico
     FROM productos
     WHERE estado = 'activo'`
  );

  const row = rows[0];
  return {
    todos: Number(row.todos),
    bajo: Number(row.bajo),
    sin_stock: Number(row.sin_stock),
    negativo: Number(row.negativo),
    critico: Number(row.critico),
  };
};

export const getInventorySummary = async () => {
  const [rows] = await pool.execute(
    `SELECT
       COUNT(*) AS total_productos,
       SUM(CASE WHEN stock <= stock_minimo AND estado = 'activo' THEN 1 ELSE 0 END) AS stock_bajo,
       COALESCE(SUM(stock * precio_venta), 0) AS valor_inventario
     FROM productos WHERE estado = 'activo'`
  );
  return {
    total_productos: Number(rows[0].total_productos),
    stock_bajo: Number(rows[0].stock_bajo),
    valor_inventario: Number(rows[0].valor_inventario),
  };
};
