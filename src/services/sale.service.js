import { pool } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { sqlLimitOffset } from '../utils/paginationSql.js';
import { withTransaction } from '../utils/transaction.js';
import { registerMovement } from './inventory.service.js';
import {
  getOpenSessionForUser,
  registerSaleInCash,
  reverseSaleInCash,
} from './cash.service.js';
import { createReceiptForSale } from './receipt.service.js';
import { logAudit } from '../utils/audit.js';
import {
  registerSaleCharge,
  reverseSaleCharge,
} from './cuentaCorriente.service.js';
import {
  fetchSalePayments,
  insertSalePayments,
  MIXED_PAYMENT_CODE,
  resolveAndValidatePayments,
} from '../utils/salePayments.js';
import {
  inventoryQtyFromLine,
  resolveSaleLinePricing,
} from '../utils/productPricing.js';
import { linkQuoteToSale, lockQuoteForConversion } from './quote.service.js';

const computePuedeAnular = (venta, openSessionId) => {
  if (venta.estado !== 'completada') return false;
  if (!venta.caja_sesion_id) return true;
  if (!openSessionId) return false;
  return (
    venta.caja_sesion_id === openSessionId && venta.caja_sesion_estado === 'abierta'
  );
};

const mapSaleList = (row, openSessionId = null) => ({
  id: row.id,
  numero: row.numero,
  cliente_id: row.cliente_id,
  cliente_nombre: row.cliente_nombre,
  usuario_id: row.usuario_id,
  usuario_nombre: row.usuario_nombre,
  subtotal: Number(row.subtotal),
  descuento: Number(row.descuento),
  total: Number(row.total),
  metodo_pago: row.metodo_pago,
  metodo_pago_nombre:
    row.metodo_pago === MIXED_PAYMENT_CODE
      ? 'Pago combinado'
      : row.metodo_pago_nombre ?? row.metodo_pago,
  monto_recibido: row.monto_recibido != null ? Number(row.monto_recibido) : null,
  vuelto: row.vuelto != null ? Number(row.vuelto) : null,
  caja_sesion_id: row.caja_sesion_id,
  caja_sesion_estado: row.caja_sesion_estado ?? null,
  estado: row.estado,
  observaciones: row.observaciones,
  fecha_venta: row.fecha_venta,
  total_items: Number(row.total_items ?? 0),
  comprobante_numero: row.comprobante_numero,
  puede_anular: computePuedeAnular(
    {
      estado: row.estado,
      caja_sesion_id: row.caja_sesion_id,
      caja_sesion_estado: row.caja_sesion_estado,
    },
    openSessionId
  ),
});

const mapSaleDetail = (row) => {
  const cantidad = Number(row.cantidad);
  const modo = row.modo_venta ?? 'suelto';
  const cantidadInventario = Number(row.cantidad_inventario ?? row.cantidad);
  const unidadesPorPaquete =
    modo === 'paquete' && cantidad > 0
      ? cantidadInventario / cantidad
      : row.unidades_por_paquete != null
        ? Number(row.unidades_por_paquete)
        : null;

  return {
    id: row.id,
    producto_id: row.producto_id,
    producto_nombre: row.producto_nombre,
    producto_codigo: row.producto_codigo,
    cantidad,
    modo_venta: modo,
    cantidad_inventario: cantidadInventario,
    unidades_por_paquete: unidadesPorPaquete,
    unidad_medida: row.unidad_medida || 'uds',
    precio_unitario: Number(row.precio_unitario),
    descuento: Number(row.descuento),
    subtotal: Number(row.subtotal),
  };
};

const generateSaleNumber = async (conn) => {
  const year = new Date().getFullYear();
  const [rows] = await conn.execute(
    'SELECT COUNT(*) AS total FROM ventas WHERE YEAR(fecha_venta) = ?',
    [year]
  );
  const seq = Number(rows[0].total) + 1;
  return `VTA-${year}-${String(seq).padStart(6, '0')}`;
};

export const createSale = async (data, usuarioId, ip = null) => {
  const presupuestoId = data.presupuesto_id ? Number(data.presupuesto_id) : null;

  return withTransaction(async (conn) => {
    let saleData = { ...data };

    if (presupuestoId) {
      const quote = await lockQuoteForConversion(presupuestoId, conn);
      saleData = {
        ...saleData,
        cliente_id: quote.cliente_id,
        descuento: Number(quote.descuento),
        observaciones: quote.observaciones,
        items: quote.detalle.map((line) => ({
          producto_id: line.producto_id,
          cantidad: Number(line.cantidad),
          modo_venta: line.modo_venta ?? 'suelto',
          precio_unitario: Number(line.precio_unitario),
          descuento: Number(line.descuento ?? 0),
        })),
      };
    }

    if (saleData.cliente_id) {
      const [client] = await conn.execute(
        "SELECT id FROM clientes WHERE id = ? AND estado = 'activo' LIMIT 1",
        [saleData.cliente_id]
      );
      if (!client.length) throw new AppError('Cliente no válido o inactivo', 400);
    }

    const openSession = await getOpenSessionForUser(usuarioId, conn);

    const lineItems = [];
    let subtotal = 0;

    for (const item of saleData.items) {
      const [products] = await conn.execute(
        `SELECT id, codigo, nombre, precio_venta, precio_venta_paquete, unidades_por_paquete,
                stock, estado
         FROM productos WHERE id = ? LIMIT 1`,
        [item.producto_id]
      );

      if (!products.length || products[0].estado !== 'activo') {
        throw new AppError(`Producto #${item.producto_id} no disponible`, 400);
      }

      const product = products[0];
      const pricing = resolveSaleLinePricing(product, item);
      const descuentoLinea = Number(item.descuento ?? 0);
      const subtotalLinea =
        pricing.precio_unitario * pricing.cantidad - descuentoLinea;

      if (subtotalLinea < 0) {
        throw new AppError('El descuento de línea no puede superar el subtotal', 400);
      }

      lineItems.push({
        producto_id: product.id,
        producto_codigo: product.codigo ?? '',
        producto_nombre: product.nombre,
        cantidad: pricing.cantidad,
        modo_venta: pricing.modo_venta,
        cantidad_inventario: pricing.cantidad_inventario,
        precio_unitario: pricing.precio_unitario,
        descuento: descuentoLinea,
        subtotal: subtotalLinea,
      });

      subtotal += subtotalLinea;
    }

    const descuentoGlobal = Number(saleData.descuento ?? 0);
    if (descuentoGlobal > subtotal) {
      throw new AppError('El descuento global no puede superar el subtotal', 400);
    }

    const total = subtotal - descuentoGlobal;

    const payments = await resolveAndValidatePayments(saleData, total, conn);

    if (saleData.requiere_caja && payments.needsCashSession && !openSession) {
      throw new AppError('Debe abrir la caja antes de registrar ventas', 400);
    }

    const numero = await generateSaleNumber(conn);
    const cajaSesionId = openSession?.id ?? null;

    const [saleResult] = await conn.execute(
      `INSERT INTO ventas (
        numero, cliente_id, usuario_id, subtotal, descuento, total,
        metodo_pago, monto_recibido, vuelto, caja_sesion_id, observaciones
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        numero,
        saleData.cliente_id ?? null,
        usuarioId,
        subtotal,
        descuentoGlobal,
        total,
        payments.summaryCode,
        payments.headerMontoRecibido,
        payments.headerVuelto,
        cajaSesionId,
        saleData.observaciones ?? null,
      ]
    );

    const ventaId = saleResult.insertId;

    for (const line of lineItems) {
      await conn.execute(
        `INSERT INTO venta_detalle (
          venta_id, producto_id, producto_nombre, producto_codigo,
          cantidad, modo_venta, cantidad_inventario,
          precio_unitario, descuento, subtotal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ventaId,
          line.producto_id,
          line.producto_nombre,
          line.producto_codigo,
          line.cantidad,
          line.modo_venta,
          line.cantidad_inventario,
          line.precio_unitario,
          line.descuento,
          line.subtotal,
        ]
      );

      await registerMovement(
        {
          producto_id: line.producto_id,
          tipo: 'salida',
          cantidad: line.cantidad_inventario,
          motivo: `Venta ${numero}`,
          referencia: numero,
        },
        usuarioId,
        conn
      );
    }

    await insertSalePayments(ventaId, payments.lines, conn);

    for (const pago of payments.lines) {
      if (!pago.paymentMethod.genera_cargo_cc && cajaSesionId) {
        await registerSaleInCash(
          {
            sesionId: cajaSesionId,
            ventaId,
            numero,
            monto: pago.monto,
            metodoPago: pago.metodo_pago,
          },
          usuarioId,
          conn
        );
      }

      if (pago.paymentMethod.genera_cargo_cc) {
        await registerSaleCharge(
          { clienteId: saleData.cliente_id, ventaId, numero, total: pago.monto },
          usuarioId,
          conn
        );
      }
    }

    await createReceiptForSale(
      { ventaId, tipo: saleData.tipo_comprobante ?? 'ticket' },
      conn
    );

    if (presupuestoId) {
      await linkQuoteToSale(presupuestoId, ventaId, usuarioId, conn, ip);
    }

    await logAudit({
      usuarioId,
      accion: presupuestoId ? 'presupuesto.convertir_venta' : 'venta.crear',
      modulo: presupuestoId ? 'presupuestos' : 'ventas',
      detalle: {
        venta_id: ventaId,
        numero,
        total,
        metodo_pago: payments.summaryCode,
        presupuesto_id: presupuestoId ?? undefined,
        pagos: payments.lines.map((p) => ({
          metodo_pago: p.metodo_pago,
          monto: p.monto,
        })),
      },
      ip,
    });

    return getSaleById(ventaId, conn);
  });
};

export const getSaleById = async (id, connection = null, usuarioId = null) => {
  const conn = connection || pool;

  const [sales] = await conn.execute(
    `SELECT v.*, c.nombre AS cliente_nombre, u.nombre_usuario AS usuario_nombre,
            cmp.numero AS comprobante_numero, cmp.tipo AS comprobante_tipo,
            mp.nombre AS metodo_pago_nombre,
            cs.estado AS caja_sesion_estado, cs.fecha_apertura AS caja_fecha_apertura
     FROM ventas v
     LEFT JOIN clientes c ON c.id = v.cliente_id
     INNER JOIN usuarios u ON u.id = v.usuario_id
     LEFT JOIN comprobantes cmp ON cmp.venta_id = v.id
     LEFT JOIN metodos_pago mp ON mp.codigo = v.metodo_pago
     LEFT JOIN caja_sesiones cs ON cs.id = v.caja_sesion_id
     WHERE v.id = ? LIMIT 1`,
    [id]
  );

  if (!sales.length) throw new AppError('Venta no encontrada', 404);

  const [details] = await conn.execute(
    `SELECT d.*, p.unidad_medida, p.unidades_por_paquete
     FROM venta_detalle d
     LEFT JOIN productos p ON p.id = d.producto_id
     WHERE d.venta_id = ?
     ORDER BY d.id ASC`,
    [id]
  );

  let openSessionId = null;
  if (usuarioId) {
    const openSession = await getOpenSessionForUser(usuarioId, conn);
    openSessionId = openSession?.id ?? null;
  }

  const pagos = await fetchSalePayments(id, conn);
  const sale = mapSaleList(sales[0], openSessionId);

  const metodoPagoNombre =
    sale.metodo_pago === MIXED_PAYMENT_CODE
      ? pagos.map((p) => p.metodo_pago_nombre).join(' + ')
      : sale.metodo_pago_nombre;

  return {
    ...sale,
    metodo_pago_nombre: metodoPagoNombre,
    pagos,
    comprobante_tipo: sales[0].comprobante_tipo,
    caja_fecha_apertura: sales[0].caja_fecha_apertura,
    detalle: details.map(mapSaleDetail),
  };
};

export const listSales = async (query, usuarioId = null) => {
  const {
    page,
    limit,
    search,
    estado,
    cliente_id,
    fecha_desde,
    fecha_hasta,
    metodo_pago,
    caja_sesion_id,
  } = query;
  const offset = (page - 1) * limit;
  const conditions = ['1=1'];
  const params = [];

  if (search) {
    conditions.push('(v.numero LIKE ? OR c.nombre LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  if (estado && estado !== 'todos') {
    conditions.push('v.estado = ?');
    params.push(estado);
  }

  if (cliente_id) {
    conditions.push('v.cliente_id = ?');
    params.push(cliente_id);
  }

  if (metodo_pago && metodo_pago !== 'todos') {
    conditions.push('v.metodo_pago = ?');
    params.push(metodo_pago);
  }

  if (fecha_desde) {
    conditions.push('DATE(v.fecha_venta) >= ?');
    params.push(fecha_desde);
  }

  if (fecha_hasta) {
    conditions.push('DATE(v.fecha_venta) <= ?');
    params.push(fecha_hasta);
  }

  if (caja_sesion_id) {
    conditions.push('v.caja_sesion_id = ?');
    params.push(caja_sesion_id);
  }

  const whereClause = conditions.join(' AND ');

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM ventas v
     LEFT JOIN clientes c ON c.id = v.cliente_id
     WHERE ${whereClause}`,
    params
  );

  const total = countRows[0].total;

  const [rows] = await pool.execute(
    `SELECT v.*, c.nombre AS cliente_nombre, u.nombre_usuario AS usuario_nombre,
            cmp.numero AS comprobante_numero,
            mp.nombre AS metodo_pago_nombre,
            cs.estado AS caja_sesion_estado,
            (SELECT COUNT(*) FROM venta_detalle d WHERE d.venta_id = v.id) AS total_items
     FROM ventas v
     LEFT JOIN clientes c ON c.id = v.cliente_id
     INNER JOIN usuarios u ON u.id = v.usuario_id
     LEFT JOIN comprobantes cmp ON cmp.venta_id = v.id
     LEFT JOIN metodos_pago mp ON mp.codigo = v.metodo_pago
     LEFT JOIN caja_sesiones cs ON cs.id = v.caja_sesion_id
     WHERE ${whereClause}
     ORDER BY v.fecha_venta DESC
     ${sqlLimitOffset(limit, offset)}`,
    params
  );

  let openSessionId = null;
  if (usuarioId) {
    const openSession = await getOpenSessionForUser(usuarioId);
    openSessionId = openSession?.id ?? null;
  }

  return {
    data: rows.map((row) => mapSaleList(row, openSessionId)),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
};

const assertSaleCancellable = async (venta, usuarioId, conn) => {
  if (venta.estado === 'anulada') {
    throw new AppError('La venta ya está anulada', 400);
  }

  if (!venta.caja_sesion_id) return;

  const [sessionRows] = await conn.execute(
    'SELECT id, estado FROM caja_sesiones WHERE id = ? LIMIT 1',
    [venta.caja_sesion_id]
  );

  if (!sessionRows.length || sessionRows[0].estado !== 'abierta') {
    throw new AppError(
      'No puede anular ventas de un turno de caja cerrado. Solo se permiten anulaciones del turno actual.',
      400
    );
  }

  const openSession = await getOpenSessionForUser(usuarioId, conn);
  if (!openSession || openSession.id !== venta.caja_sesion_id) {
    throw new AppError(
      'Solo puede anular ventas registradas en su turno de caja abierto actualmente.',
      400
    );
  }
};

export const cancelSale = async (id, usuarioId, ip = null) => {
  return withTransaction(async (conn) => {
    const venta = await getSaleById(id, conn, usuarioId);

    await assertSaleCancellable(venta, usuarioId, conn);

    for (const line of venta.detalle) {
      await registerMovement(
        {
          producto_id: line.producto_id,
          tipo: 'entrada',
          cantidad: inventoryQtyFromLine(line),
          motivo: `Anulación venta ${venta.numero}`,
          referencia: venta.numero,
        },
        usuarioId,
        conn
      );
    }

    const pagos = venta.pagos?.length ? venta.pagos : await fetchSalePayments(id, conn);

    for (const pago of pagos) {
      const [pmRows] = await conn.execute(
        'SELECT * FROM metodos_pago WHERE codigo = ? LIMIT 1',
        [pago.metodo_pago]
      );
      const pm = pmRows[0];
      const generaCc = pm ? Boolean(pm.genera_cargo_cc) : pago.metodo_pago === 'cuenta_corriente';

      if (venta.caja_sesion_id && !generaCc) {
        await reverseSaleInCash(
          {
            sesionId: venta.caja_sesion_id,
            ventaId: id,
            numero: venta.numero,
            monto: pago.monto,
            metodoPago: pago.metodo_pago,
          },
          usuarioId,
          conn
        );
      }

      if (generaCc && venta.cliente_id) {
        await reverseSaleCharge(
          {
            clienteId: venta.cliente_id,
            ventaId: id,
            numero: venta.numero,
            total: pago.monto,
          },
          usuarioId,
          conn
        );
      }
    }

    await conn.execute("UPDATE ventas SET estado = 'anulada' WHERE id = ?", [id]);

    await logAudit({
      usuarioId,
      accion: 'venta.anular',
      modulo: 'ventas',
      detalle: { venta_id: id, numero: venta.numero },
      ip,
    });

    return getSaleById(id, conn);
  });
};

export const getSalesSummary = async (query = {}) => {
  const { fecha_desde, fecha_hasta, caja_sesion_id } = query;
  const conditions = ['1=1'];
  const params = [];

  if (fecha_desde) {
    conditions.push('DATE(fecha_venta) >= ?');
    params.push(fecha_desde);
  }

  if (fecha_hasta) {
    conditions.push('DATE(fecha_venta) <= ?');
    params.push(fecha_hasta);
  }

  if (caja_sesion_id) {
    conditions.push('caja_sesion_id = ?');
    params.push(caja_sesion_id);
  }

  const whereClause = conditions.join(' AND ');

  const [rows] = await pool.execute(
    `SELECT
       COUNT(*) AS total_ventas,
       COALESCE(SUM(CASE WHEN estado = 'completada' THEN total ELSE 0 END), 0) AS ingresos,
       COALESCE(SUM(CASE WHEN estado = 'completada' THEN 1 ELSE 0 END), 0) AS ventas_completadas,
       COALESCE(SUM(CASE WHEN estado = 'anulada' THEN 1 ELSE 0 END), 0) AS ventas_anuladas
     FROM ventas
     WHERE ${whereClause}`,
    params
  );
  return {
    total_ventas: Number(rows[0].total_ventas),
    ingresos: Number(rows[0].ingresos),
    ventas_completadas: Number(rows[0].ventas_completadas),
    ventas_anuladas: Number(rows[0].ventas_anuladas),
  };
};
