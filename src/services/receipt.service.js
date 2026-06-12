import { pool } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { fetchSalePayments, MIXED_PAYMENT_CODE } from '../utils/salePayments.js';
import { sqlLimitOffset } from '../utils/paginationSql.js';

const mapReceipt = (row) => ({
  id: row.id,
  venta_id: row.venta_id,
  numero: row.numero,
  tipo: row.tipo,
  fecha_emision: row.fecha_emision,
  venta_numero: row.venta_numero,
  venta_total: row.venta_total != null ? Number(row.venta_total) : null,
  venta_estado: row.venta_estado,
  cliente_id: row.cliente_id ?? null,
  cliente_nombre: row.cliente_nombre,
  cliente_telefono: row.cliente_telefono ?? null,
});

export const generateReceiptNumber = async (conn, tipo = 'ticket') => {
  const year = new Date().getFullYear();
  const prefix = tipo === 'factura' ? 'FAC' : tipo === 'boleta' ? 'BOL' : 'TKT';
  const [rows] = await conn.execute(
    'SELECT COUNT(*) AS total FROM comprobantes WHERE YEAR(fecha_emision) = ? AND tipo = ?',
    [year, tipo]
  );
  const seq = Number(rows[0].total) + 1;
  return `${prefix}-${year}-${String(seq).padStart(6, '0')}`;
};

export const createReceiptForSale = async (
  { ventaId, tipo = 'ticket' },
  conn
) => {
  const numero = await generateReceiptNumber(conn, tipo);
  const [result] = await conn.execute(
    'INSERT INTO comprobantes (venta_id, numero, tipo) VALUES (?, ?, ?)',
    [ventaId, numero, tipo]
  );
  return { id: result.insertId, numero, tipo };
};

export const getReceiptByVentaId = async (ventaId) => {
  const [rows] = await pool.execute(
    `SELECT c.*, v.numero AS venta_numero, v.total AS venta_total, v.estado AS venta_estado,
            v.cliente_id, cl.nombre AS cliente_nombre, cl.telefono AS cliente_telefono
     FROM comprobantes c
     INNER JOIN ventas v ON v.id = c.venta_id
     LEFT JOIN clientes cl ON cl.id = v.cliente_id
     WHERE c.venta_id = ? LIMIT 1`,
    [ventaId]
  );
  if (!rows.length) throw new AppError('Comprobante no encontrado', 404);
  return mapReceipt(rows[0]);
};

export const getReceiptWithSaleDetail = async (ventaId) => {
  const [receiptRows] = await pool.execute(
    `SELECT c.*, v.numero AS venta_numero, v.subtotal, v.descuento, v.total, v.estado AS venta_estado,
            v.metodo_pago, mp.nombre AS metodo_pago_nombre,
            v.monto_recibido, v.vuelto, v.fecha_venta, v.observaciones,
            v.cliente_id, cl.nombre AS cliente_nombre, cl.telefono AS cliente_telefono,
            cl.tipo_documento, cl.numero_documento,
            u.nombre_usuario AS vendedor
     FROM comprobantes c
     INNER JOIN ventas v ON v.id = c.venta_id
     LEFT JOIN metodos_pago mp ON mp.codigo = v.metodo_pago
     LEFT JOIN clientes cl ON cl.id = v.cliente_id
     INNER JOIN usuarios u ON u.id = v.usuario_id
     WHERE c.venta_id = ? LIMIT 1`,
    [ventaId]
  );

  if (!receiptRows.length) throw new AppError('Comprobante no encontrado', 404);

  const [details] = await pool.execute(
    'SELECT * FROM venta_detalle WHERE venta_id = ? ORDER BY id ASC',
    [ventaId]
  );

  const r = receiptRows[0];
  const pagos = await fetchSalePayments(ventaId, pool);
  const metodoPagoNombre =
    r.metodo_pago === MIXED_PAYMENT_CODE
      ? pagos.map((p) => `${p.metodo_pago_nombre} ${p.monto}`).join(' · ')
      : r.metodo_pago_nombre ?? r.metodo_pago;

  return {
    comprobante: {
      id: r.id,
      numero: r.numero,
      tipo: r.tipo,
      fecha_emision: r.fecha_emision,
    },
    venta: {
      numero: r.venta_numero,
      subtotal: Number(r.subtotal),
      descuento: Number(r.descuento),
      total: Number(r.total),
      estado: r.venta_estado,
      metodo_pago: r.metodo_pago,
      metodo_pago_nombre: metodoPagoNombre,
      monto_recibido: r.monto_recibido != null ? Number(r.monto_recibido) : null,
      vuelto: r.vuelto != null ? Number(r.vuelto) : null,
      pagos,
      fecha_venta: r.fecha_venta,
      observaciones: r.observaciones,
      cliente_id: r.cliente_id ?? null,
      cliente_nombre: r.cliente_nombre,
      cliente_telefono: r.cliente_telefono ?? null,
      tipo_documento: r.tipo_documento,
      numero_documento: r.numero_documento,
      vendedor: r.vendedor,
    },
    detalle: details.map((d) => ({
      producto_nombre: d.producto_nombre,
      producto_codigo: d.producto_codigo,
      cantidad: Number(d.cantidad),
      precio_unitario: Number(d.precio_unitario),
      descuento: Number(d.descuento),
      subtotal: Number(d.subtotal),
    })),
  };
};

export const listReceipts = async (query) => {
  const { page, limit, search, tipo, fecha_desde, fecha_hasta } = query;
  const offset = (page - 1) * limit;
  const conditions = ['1=1'];
  const params = [];

  if (search) {
    conditions.push('(c.numero LIKE ? OR v.numero LIKE ? OR cl.nombre LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (tipo && tipo !== 'todos') {
    conditions.push('c.tipo = ?');
    params.push(tipo);
  }
  if (fecha_desde) {
    conditions.push('DATE(c.fecha_emision) >= ?');
    params.push(fecha_desde);
  }
  if (fecha_hasta) {
    conditions.push('DATE(c.fecha_emision) <= ?');
    params.push(fecha_hasta);
  }

  const whereClause = conditions.join(' AND ');

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM comprobantes c
     INNER JOIN ventas v ON v.id = c.venta_id
     WHERE ${whereClause}`,
    params
  );
  const total = countRows[0].total;

  const [rows] = await pool.execute(
    `SELECT c.*, v.numero AS venta_numero, v.total AS venta_total, v.estado AS venta_estado,
            v.cliente_id, cl.nombre AS cliente_nombre, cl.telefono AS cliente_telefono
     FROM comprobantes c
     INNER JOIN ventas v ON v.id = c.venta_id
     LEFT JOIN clientes cl ON cl.id = v.cliente_id
     WHERE ${whereClause}
     ORDER BY c.fecha_emision DESC
     ${sqlLimitOffset(limit, offset)}`,
    params
  );

  return {
    data: rows.map(mapReceipt),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
};
