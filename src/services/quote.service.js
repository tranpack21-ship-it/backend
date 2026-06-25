import { pool } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { sqlLimitOffset } from '../utils/paginationSql.js';
import { withTransaction } from '../utils/transaction.js';
import { logAudit } from '../utils/audit.js';
import { resolveSaleLinePricing } from '../utils/productPricing.js';

const mapQuoteList = (row) => ({
  id: row.id,
  numero: row.numero,
  cliente_id: row.cliente_id,
  cliente_nombre: row.cliente_nombre,
  cliente_telefono: row.cliente_telefono,
  usuario_id: row.usuario_id,
  usuario_nombre: row.usuario_nombre,
  subtotal: Number(row.subtotal),
  descuento: Number(row.descuento),
  total: Number(row.total),
  estado: row.estado,
  validez_dias: Number(row.validez_dias),
  validez_hasta: row.validez_hasta,
  observaciones: row.observaciones,
  venta_id: row.venta_id,
  venta_numero: row.venta_numero ?? null,
  fecha_presupuesto: row.fecha_presupuesto,
  total_items: Number(row.total_items ?? 0),
  puede_anular: row.estado === 'vigente',
  puede_convertir: row.estado === 'vigente' && !row.venta_id,
});

const mapQuoteDetail = (row) => ({
  id: row.id,
  producto_id: row.producto_id,
  producto_nombre: row.producto_nombre,
  producto_codigo: row.producto_codigo,
  cantidad: Number(row.cantidad),
  modo_venta: row.modo_venta ?? 'suelto',
  precio_unitario: Number(row.precio_unitario),
  descuento: Number(row.descuento),
  subtotal: Number(row.subtotal),
});

const generateQuoteNumber = async (conn) => {
  const year = new Date().getFullYear();
  const [rows] = await conn.execute(
    'SELECT COUNT(*) AS total FROM presupuestos WHERE YEAR(fecha_presupuesto) = ?',
    [year]
  );
  const seq = Number(rows[0].total) + 1;
  return `PRE-${year}-${String(seq).padStart(6, '0')}`;
};

const computeValidezHasta = (validezDias) => {
  const date = new Date();
  date.setDate(date.getDate() + validezDias);
  return date.toISOString().slice(0, 10);
};

export const createQuote = async (data, usuarioId, ip = null) => {
  return withTransaction(async (conn) => {
    if (data.cliente_id) {
      const [client] = await conn.execute(
        "SELECT id FROM clientes WHERE id = ? AND estado = 'activo' LIMIT 1",
        [data.cliente_id]
      );
      if (!client.length) throw new AppError('Cliente no válido o inactivo', 400);
    }

    const lineItems = [];
    let subtotal = 0;

    for (const item of data.items) {
      const [products] = await conn.execute(
        `SELECT id, codigo, nombre, precio_venta, precio_venta_paquete, unidades_por_paquete, estado
         FROM productos WHERE id = ? LIMIT 1`,
        [item.producto_id]
      );

      if (!products.length || products[0].estado !== 'activo') {
        throw new AppError(`Producto #${item.producto_id} no disponible`, 400);
      }

      const product = products[0];
      const pricing = resolveSaleLinePricing(product, item);
      const descuentoLinea = Number(item.descuento ?? 0);
      const subtotalLinea = pricing.precio_unitario * pricing.cantidad - descuentoLinea;

      if (subtotalLinea < 0) {
        throw new AppError('El descuento de línea no puede superar el subtotal', 400);
      }

      lineItems.push({
        producto_id: product.id,
        producto_codigo: product.codigo ?? '',
        producto_nombre: product.nombre,
        cantidad: pricing.cantidad,
        modo_venta: pricing.modo_venta,
        precio_unitario: pricing.precio_unitario,
        descuento: descuentoLinea,
        subtotal: subtotalLinea,
      });

      subtotal += subtotalLinea;
    }

    const descuentoGlobal = Number(data.descuento ?? 0);
    if (descuentoGlobal > subtotal) {
      throw new AppError('El descuento global no puede superar el subtotal', 400);
    }

    const total = subtotal - descuentoGlobal;
    const validezDias = Number(data.validez_dias ?? 15);
    if (validezDias < 1 || validezDias > 365) {
      throw new AppError('La validez debe estar entre 1 y 365 días', 400);
    }

    const validezHasta = computeValidezHasta(validezDias);
    const numero = await generateQuoteNumber(conn);

    const [result] = await conn.execute(
      `INSERT INTO presupuestos (
        numero, cliente_id, usuario_id, subtotal, descuento, total,
        validez_dias, validez_hasta, observaciones
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        numero,
        data.cliente_id ?? null,
        usuarioId,
        subtotal,
        descuentoGlobal,
        total,
        validezDias,
        validezHasta,
        data.observaciones ?? null,
      ]
    );

    const presupuestoId = result.insertId;

    for (const line of lineItems) {
      await conn.execute(
        `INSERT INTO presupuesto_detalle (
          presupuesto_id, producto_id, producto_nombre, producto_codigo,
          cantidad, modo_venta, precio_unitario, descuento, subtotal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          presupuestoId,
          line.producto_id,
          line.producto_nombre,
          line.producto_codigo,
          line.cantidad,
          line.modo_venta,
          line.precio_unitario,
          line.descuento,
          line.subtotal,
        ]
      );
    }

    await logAudit({
      usuarioId,
      accion: 'presupuesto.crear',
      modulo: 'presupuestos',
      detalle: { presupuesto_id: presupuestoId, numero, total },
      ip,
    });

    return getQuoteById(presupuestoId, conn);
  });
};

export const getQuoteById = async (id, connection = null) => {
  const conn = connection || pool;

  const [rows] = await conn.execute(
    `SELECT p.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono,
            c.tipo_documento AS cliente_tipo_documento, c.numero_documento AS cliente_numero_documento,
            u.nombre_usuario AS usuario_nombre, v.numero AS venta_numero
     FROM presupuestos p
     LEFT JOIN clientes c ON c.id = p.cliente_id
     INNER JOIN usuarios u ON u.id = p.usuario_id
     LEFT JOIN ventas v ON v.id = p.venta_id
     WHERE p.id = ? LIMIT 1`,
    [id]
  );

  if (!rows.length) throw new AppError('Presupuesto no encontrado', 404);

  const [details] = await conn.execute(
    'SELECT * FROM presupuesto_detalle WHERE presupuesto_id = ? ORDER BY id ASC',
    [id]
  );

  const quote = mapQuoteList(rows[0]);

  return {
    ...quote,
    cliente_tipo_documento: rows[0].cliente_tipo_documento,
    cliente_numero_documento: rows[0].cliente_numero_documento,
    detalle: details.map(mapQuoteDetail),
  };
};

export const listQuotes = async (query) => {
  const { page, limit, search, estado, cliente_id, fecha_desde, fecha_hasta } = query;
  const offset = (page - 1) * limit;
  const conditions = ['1=1'];
  const params = [];

  if (search) {
    conditions.push('(p.numero LIKE ? OR c.nombre LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  if (estado && estado !== 'todos') {
    conditions.push('p.estado = ?');
    params.push(estado);
  }

  if (cliente_id) {
    conditions.push('p.cliente_id = ?');
    params.push(cliente_id);
  }

  if (fecha_desde) {
    conditions.push('DATE(p.fecha_presupuesto) >= ?');
    params.push(fecha_desde);
  }

  if (fecha_hasta) {
    conditions.push('DATE(p.fecha_presupuesto) <= ?');
    params.push(fecha_hasta);
  }

  const whereClause = conditions.join(' AND ');

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM presupuestos p
     LEFT JOIN clientes c ON c.id = p.cliente_id
     WHERE ${whereClause}`,
    params
  );

  const total = countRows[0].total;

  const [rows] = await pool.execute(
    `SELECT p.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono,
            u.nombre_usuario AS usuario_nombre, v.numero AS venta_numero,
            (SELECT COUNT(*) FROM presupuesto_detalle d WHERE d.presupuesto_id = p.id) AS total_items
     FROM presupuestos p
     LEFT JOIN clientes c ON c.id = p.cliente_id
     INNER JOIN usuarios u ON u.id = p.usuario_id
     LEFT JOIN ventas v ON v.id = p.venta_id
     WHERE ${whereClause}
     ORDER BY p.fecha_presupuesto DESC
     ${sqlLimitOffset(limit, offset)}`,
    params
  );

  return {
    data: rows.map(mapQuoteList),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
};

export const cancelQuote = async (id, usuarioId, ip = null) => {
  return withTransaction(async (conn) => {
    const [rows] = await conn.execute(
      'SELECT id, numero, estado FROM presupuestos WHERE id = ? LIMIT 1',
      [id]
    );

    if (!rows.length) throw new AppError('Presupuesto no encontrado', 404);
    if (rows[0].estado === 'anulado') {
      throw new AppError('El presupuesto ya está anulado', 400);
    }

    await conn.execute("UPDATE presupuestos SET estado = 'anulado' WHERE id = ?", [id]);

    await logAudit({
      usuarioId,
      accion: 'presupuesto.anular',
      modulo: 'presupuestos',
      detalle: { presupuesto_id: id, numero: rows[0].numero },
      ip,
    });

    return getQuoteById(id, conn);
  });
};

/** Datos completos para PDF / impresión / WhatsApp */
export const getQuotePrintData = async (id) => {
  const quote = await getQuoteById(id);

  return {
    presupuesto: {
      id: quote.id,
      numero: quote.numero,
      fecha_presupuesto: quote.fecha_presupuesto,
      estado: quote.estado,
      validez_dias: quote.validez_dias,
      validez_hasta: quote.validez_hasta,
      subtotal: quote.subtotal,
      descuento: quote.descuento,
      total: quote.total,
      observaciones: quote.observaciones,
    },
    cliente: {
      nombre: quote.cliente_nombre,
      telefono: quote.cliente_telefono,
      tipo_documento: quote.cliente_tipo_documento,
      numero_documento: quote.cliente_numero_documento,
    },
    vendedor: quote.usuario_nombre,
    detalle: quote.detalle,
  };
};

/** Bloquea el presupuesto para conversión (debe estar vigente). */
export const lockQuoteForConversion = async (presupuestoId, conn) => {
  const [rows] = await conn.execute(
    `SELECT id, numero, estado, venta_id, cliente_id, descuento, observaciones
     FROM presupuestos WHERE id = ? LIMIT 1 FOR UPDATE`,
    [presupuestoId]
  );

  if (!rows.length) {
    throw new AppError('Presupuesto no encontrado', 404);
  }

  const quote = rows[0];

  if (quote.estado === 'anulado') {
    throw new AppError('El presupuesto está anulado y no puede convertirse', 400);
  }

  if (quote.estado === 'convertido' || quote.venta_id) {
    throw new AppError('El presupuesto ya fue convertido a venta', 400);
  }

  const [details] = await conn.execute(
    'SELECT * FROM presupuesto_detalle WHERE presupuesto_id = ? ORDER BY id ASC',
    [presupuestoId]
  );

  if (!details.length) {
    throw new AppError('El presupuesto no tiene productos', 400);
  }

  return { ...quote, detalle: details };
};

export const linkQuoteToSale = async (presupuestoId, ventaId, usuarioId, conn, ip = null) => {
  const [result] = await conn.execute(
    `UPDATE presupuestos
     SET estado = 'convertido', venta_id = ?
     WHERE id = ? AND estado = 'vigente' AND venta_id IS NULL`,
    [ventaId, presupuestoId]
  );

  if (result.affectedRows === 0) {
    throw new AppError('No se pudo vincular el presupuesto con la venta', 409);
  }

  await logAudit({
    usuarioId,
    accion: 'presupuesto.convertir',
    modulo: 'presupuestos',
    detalle: { presupuesto_id: presupuestoId, venta_id: ventaId },
    ip,
  });
};
