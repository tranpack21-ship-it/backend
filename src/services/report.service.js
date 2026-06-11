import { pool } from '../config/database.js';

export const getDashboardReport = async ({ fecha_desde, fecha_hasta }) => {
  const params = [];
  let dateFilter = "v.estado = 'completada'";
  if (fecha_desde) {
    dateFilter += ' AND DATE(v.fecha_venta) >= ?';
    params.push(fecha_desde);
  }
  if (fecha_hasta) {
    dateFilter += ' AND DATE(v.fecha_venta) <= ?';
    params.push(fecha_hasta);
  }

  const [ventas] = await pool.execute(
    `SELECT
       COUNT(*) AS cantidad,
       COALESCE(SUM(v.total), 0) AS ingresos,
       COALESCE(AVG(v.total), 0) AS ticket_promedio
     FROM ventas v
     WHERE ${dateFilter}`,
    params
  );

  const [porMetodo] = await pool.execute(
    `SELECT v.metodo_pago,
            COALESCE(mp.nombre, v.metodo_pago) AS metodo_pago_nombre,
            COUNT(*) AS cantidad,
            COALESCE(SUM(v.total), 0) AS total
     FROM ventas v
     LEFT JOIN metodos_pago mp ON mp.codigo = v.metodo_pago
     WHERE ${dateFilter}
     GROUP BY v.metodo_pago, mp.nombre`,
    params
  );

  const anuladasConditions = ["v.estado = 'anulada'"];
  const anuladasParams = [];
  if (fecha_desde) {
    anuladasConditions.push('DATE(v.fecha_venta) >= ?');
    anuladasParams.push(fecha_desde);
  }
  if (fecha_hasta) {
    anuladasConditions.push('DATE(v.fecha_venta) <= ?');
    anuladasParams.push(fecha_hasta);
  }
  const [anuladas] = await pool.execute(
    `SELECT COUNT(*) AS cantidad FROM ventas v WHERE ${anuladasConditions.join(' AND ')}`,
    anuladasParams
  );

  const [stockBajo] = await pool.execute(
    `SELECT COUNT(*) AS cantidad
     FROM productos
     WHERE estado = 'activo' AND stock <= stock_minimo`
  );

  const [clientesActivos] = await pool.execute(
    "SELECT COUNT(*) AS cantidad FROM clientes WHERE estado = 'activo'"
  );

  return {
    ventas: {
      cantidad: Number(ventas[0].cantidad),
      ingresos: Number(ventas[0].ingresos),
      ticket_promedio: Number(ventas[0].ticket_promedio),
      anuladas: Number(anuladas[0]?.cantidad ?? 0),
    },
    por_metodo_pago: porMetodo.map((r) => ({
      metodo_pago: r.metodo_pago,
      metodo_pago_nombre: r.metodo_pago_nombre,
      cantidad: Number(r.cantidad),
      total: Number(r.total),
    })),
    inventario: {
      productos_stock_bajo: Number(stockBajo[0].cantidad),
    },
    clientes_activos: Number(clientesActivos[0].cantidad),
  };
};

export const getSalesByDayReport = async ({ fecha_desde, fecha_hasta }) => {
  const conditions = ["v.estado = 'completada'"];
  const params = [];

  if (fecha_desde) {
    conditions.push('DATE(v.fecha_venta) >= ?');
    params.push(fecha_desde);
  }
  if (fecha_hasta) {
    conditions.push('DATE(v.fecha_venta) <= ?');
    params.push(fecha_hasta);
  }

  const [rows] = await pool.execute(
    `SELECT DATE(v.fecha_venta) AS fecha,
            COUNT(*) AS cantidad,
            COALESCE(SUM(v.total), 0) AS total
     FROM ventas v
     WHERE ${conditions.join(' AND ')}
     GROUP BY DATE(v.fecha_venta)
     ORDER BY fecha ASC`,
    params
  );

  return rows.map((r) => ({
    fecha: r.fecha,
    cantidad: Number(r.cantidad),
    total: Number(r.total),
  }));
};

export const getTopProductsReport = async ({ fecha_desde, fecha_hasta, limit = 10 }) => {
  const conditions = ["v.estado = 'completada'"];
  const params = [];

  if (fecha_desde) {
    conditions.push('DATE(v.fecha_venta) >= ?');
    params.push(fecha_desde);
  }
  if (fecha_hasta) {
    conditions.push('DATE(v.fecha_venta) <= ?');
    params.push(fecha_hasta);
  }

  const [rows] = await pool.execute(
    `SELECT d.producto_id, d.producto_codigo, d.producto_nombre,
            SUM(d.cantidad) AS cantidad_vendida,
            SUM(d.subtotal) AS ingresos
     FROM venta_detalle d
     INNER JOIN ventas v ON v.id = d.venta_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY d.producto_id, d.producto_codigo, d.producto_nombre
     ORDER BY cantidad_vendida DESC
     LIMIT ?`,
    [...params, limit]
  );

  return rows.map((r) => ({
    producto_id: r.producto_id,
    producto_codigo: r.producto_codigo,
    producto_nombre: r.producto_nombre,
    cantidad_vendida: Number(r.cantidad_vendida),
    ingresos: Number(r.ingresos),
  }));
};

export const getLowStockReport = async () => {
  const [rows] = await pool.execute(
    `SELECT p.id, p.codigo, p.nombre, p.stock, p.stock_minimo, p.unidad_medida,
            c.nombre AS categoria_nombre
     FROM productos p
     INNER JOIN categorias c ON c.id = p.categoria_id
     WHERE p.estado = 'activo' AND (p.stock <= p.stock_minimo OR p.stock < 0)
     ORDER BY p.stock ASC
     LIMIT 50`
  );

  return rows.map((r) => ({
    id: r.id,
    codigo: r.codigo,
    nombre: r.nombre,
    stock: Number(r.stock),
    stock_minimo: Number(r.stock_minimo),
    unidad_medida: r.unidad_medida,
    categoria_nombre: r.categoria_nombre,
  }));
};

export const getSalesByUserReport = async ({ fecha_desde, fecha_hasta }) => {
  const conditions = ["v.estado = 'completada'"];
  const params = [];

  if (fecha_desde) {
    conditions.push('DATE(v.fecha_venta) >= ?');
    params.push(fecha_desde);
  }
  if (fecha_hasta) {
    conditions.push('DATE(v.fecha_venta) <= ?');
    params.push(fecha_hasta);
  }

  const [rows] = await pool.execute(
    `SELECT u.id AS usuario_id, u.nombre_usuario,
            COUNT(*) AS cantidad,
            COALESCE(SUM(v.total), 0) AS total
     FROM ventas v
     INNER JOIN usuarios u ON u.id = v.usuario_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY u.id, u.nombre_usuario
     ORDER BY total DESC`,
    params
  );

  return rows.map((r) => ({
    usuario_id: r.usuario_id,
    nombre_usuario: r.nombre_usuario,
    cantidad: Number(r.cantidad),
    total: Number(r.total),
  }));
};
