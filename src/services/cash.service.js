import { pool } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { sqlLimitOffset } from '../utils/paginationSql.js';
import { withTransaction } from '../utils/transaction.js';
import { logAudit } from '../utils/audit.js';
import { getActivePaymentMethodByCode } from './paymentMethod.service.js';

const mapSession = (row) => ({
  id: row.id,
  usuario_id: row.usuario_id,
  usuario_nombre: row.usuario_nombre,
  estado: row.estado,
  monto_apertura: Number(row.monto_apertura),
  total_ventas_efectivo: Number(row.total_ventas_efectivo),
  total_ingresos: Number(row.total_ingresos),
  total_egresos: Number(row.total_egresos),
  monto_esperado: row.monto_esperado != null ? Number(row.monto_esperado) : null,
  monto_cierre: row.monto_cierre != null ? Number(row.monto_cierre) : null,
  diferencia: row.diferencia != null ? Number(row.diferencia) : null,
  observaciones_apertura: row.observaciones_apertura,
  observaciones_cierre: row.observaciones_cierre,
  fecha_apertura: row.fecha_apertura,
  fecha_cierre: row.fecha_cierre,
});

const mapMovement = (row) => ({
  id: row.id,
  sesion_id: row.sesion_id,
  tipo: row.tipo,
  monto: Number(row.monto),
  metodo_pago: row.metodo_pago,
  metodo_pago_nombre: row.metodo_pago_nombre ?? row.metodo_pago,
  descripcion: row.descripcion,
  referencia: row.referencia,
  venta_id: row.venta_id,
  cuenta_corriente_movimiento_id: row.cuenta_corriente_movimiento_id,
  usuario_nombre: row.usuario_nombre,
  fecha: row.fecha,
});

/**
 * Efectivo físico esperado en el cajón.
 *
 * `total_ventas_efectivo` ya es el neto de TODO el efectivo del turno:
 * ventas + ingresos manuales + cobros CC en efectivo (suman) y egresos
 * en efectivo (restan). Por eso solo hay que sumarle la apertura.
 *
 * NO se suma `total_ingresos` ni se resta `total_egresos` porque son
 * contadores generales (incluyen métodos no-efectivo) y su parte en
 * efectivo ya está reflejada en `total_ventas_efectivo`. Sumarlos
 * duplicaba los cobros CC e ingresos en efectivo.
 */
const computeEfectivoFisico = (sesion) =>
  sesion.monto_apertura + sesion.total_ventas_efectivo;

/** Solo métodos que suman al efectivo físico del cajón */
const affectsPhysicalCash = async (metodoPago, conn) => {
  try {
    const pm = await getActivePaymentMethodByCode(metodoPago, conn);
    return Boolean(pm.requiere_monto_recibido);
  } catch {
    return metodoPago === 'efectivo';
  }
};

export const getOpenSessionForUser = async (usuarioId, connection = null) => {
  const conn = connection || pool;
  const [rows] = await conn.execute(
    `SELECT s.*, u.nombre_usuario AS usuario_nombre
     FROM caja_sesiones s
     INNER JOIN usuarios u ON u.id = s.usuario_id
     WHERE s.usuario_id = ? AND s.estado = 'abierta'
     ORDER BY s.fecha_apertura DESC
     LIMIT 1`,
    [usuarioId]
  );
  return rows.length ? mapSession(rows[0]) : null;
};

export const getSessionBreakdown = async (sesionId, connection = null) => {
  const conn = connection || pool;

  const [ventasRows] = await conn.execute(
    `SELECT vp.metodo_pago,
            COALESCE(mp.nombre, vp.metodo_pago) AS nombre,
            COALESCE(mp.genera_cargo_cc, 0) AS genera_cargo_cc,
            COALESCE(mp.requiere_monto_recibido, 0) AS requiere_monto_recibido,
            COUNT(*) AS cantidad,
            COALESCE(SUM(vp.monto), 0) AS total
     FROM venta_pagos vp
     INNER JOIN ventas v ON v.id = vp.venta_id
     LEFT JOIN metodos_pago mp ON mp.codigo = vp.metodo_pago
     WHERE v.caja_sesion_id = ? AND v.estado = 'completada'
     GROUP BY vp.metodo_pago, mp.nombre, mp.genera_cargo_cc, mp.requiere_monto_recibido
     ORDER BY total DESC`,
    [sesionId]
  );

  const [movRows] = await conn.execute(
    `SELECT m.tipo,
            COALESCE(m.metodo_pago, 'efectivo') AS metodo_pago,
            COALESCE(mp.nombre, m.metodo_pago, 'Efectivo') AS nombre,
            COALESCE(mp.requiere_monto_recibido, 0) AS requiere_monto_recibido,
            COALESCE(SUM(m.monto), 0) AS total,
            COUNT(*) AS cantidad
     FROM caja_movimientos m
     LEFT JOIN metodos_pago mp ON mp.codigo = m.metodo_pago
     WHERE m.sesion_id = ?
       AND m.tipo IN ('venta', 'cobro_cc', 'ingreso', 'egreso', 'anulacion')
     GROUP BY m.tipo, m.metodo_pago, mp.nombre, mp.requiere_monto_recibido`,
    [sesionId]
  );

  const ventasPorMetodo = ventasRows.map((r) => ({
    metodo_pago: r.metodo_pago,
    nombre: r.nombre,
    cantidad: Number(r.cantidad),
    total: Number(r.total),
    es_cuenta_corriente: Boolean(r.genera_cargo_cc),
  }));

  const totalVentasCc = ventasPorMetodo
    .filter((v) => v.es_cuenta_corriente)
    .reduce((acc, v) => acc + v.total, 0);

  const totalVentas = ventasPorMetodo.reduce((acc, v) => acc + v.total, 0);
  const totalVentasEnCaja = ventasPorMetodo
    .filter((v) => !v.es_cuenta_corriente)
    .reduce((acc, v) => acc + v.total, 0);

  const ingresosMap = new Map();
  const egresosMap = new Map();

  for (const row of movRows) {
    const key = row.metodo_pago;
    const entry = {
      metodo_pago: key,
      nombre: row.nombre,
      total: Number(row.total),
      cantidad: Number(row.cantidad),
    };
    if (row.tipo === 'egreso') {
      const prev = egresosMap.get(key) || { ...entry, total: 0, cantidad: 0 };
      prev.total += entry.total;
      prev.cantidad += entry.cantidad;
      egresosMap.set(key, prev);
    } else if (['venta', 'cobro_cc', 'ingreso'].includes(row.tipo)) {
      const prev = ingresosMap.get(key) || { ...entry, total: 0, cantidad: 0 };
      prev.total += entry.total;
      prev.cantidad += entry.cantidad;
      ingresosMap.set(key, prev);
    }
  }

  const ingresosPorMetodo = [...ingresosMap.values()].sort((a, b) => b.total - a.total);
  const egresosPorMetodo = [...egresosMap.values()].sort((a, b) => b.total - a.total);

  const cobrosCcPorMetodo = movRows
    .filter((r) => r.tipo === 'cobro_cc')
    .map((r) => ({
      metodo_pago: r.metodo_pago,
      nombre: r.nombre,
      total: Number(r.total),
      cantidad: Number(r.cantidad),
    }));

  const totalCobrosCc = cobrosCcPorMetodo.reduce((acc, r) => acc + r.total, 0);

  const totalIngresosManuales = movRows
    .filter((r) => r.tipo === 'ingreso')
    .reduce((acc, r) => acc + Number(r.total), 0);

  const totalIngresos = totalVentasEnCaja + totalCobrosCc + totalIngresosManuales;

  const totalEgresos = movRows
    .filter((r) => r.tipo === 'egreso')
    .reduce((acc, r) => acc + Number(r.total), 0);

  // --- Desglose del efectivo físico del cajón (solo métodos que lo afectan) ---
  const afectaEfectivo = (metodo, requiere) =>
    Boolean(Number(requiere)) || metodo === 'efectivo';

  const toEfectivoItem = (r) => ({
    metodo_pago: r.metodo_pago,
    nombre: r.nombre,
    total: Number(r.total),
    cantidad: Number(r.cantidad),
  });

  const ventasEfectivoPorMetodo = ventasRows
    .filter((r) => afectaEfectivo(r.metodo_pago, r.requiere_monto_recibido))
    .map(toEfectivoItem);

  const cobrosEfectivoPorMetodo = movRows
    .filter((r) => r.tipo === 'cobro_cc' && afectaEfectivo(r.metodo_pago, r.requiere_monto_recibido))
    .map(toEfectivoItem);

  const ingresosManualesEfectivoPorMetodo = movRows
    .filter((r) => r.tipo === 'ingreso' && afectaEfectivo(r.metodo_pago, r.requiere_monto_recibido))
    .map(toEfectivoItem);

  const egresosEfectivoPorMetodo = movRows
    .filter((r) => r.tipo === 'egreso' && afectaEfectivo(r.metodo_pago, r.requiere_monto_recibido))
    .map(toEfectivoItem);

  const sumTotal = (arr) => arr.reduce((acc, r) => acc + r.total, 0);

  const efectivoDesglose = {
    ventas_por_metodo: ventasEfectivoPorMetodo,
    total_ventas: sumTotal(ventasEfectivoPorMetodo),
    cobros_por_metodo: cobrosEfectivoPorMetodo,
    total_cobros: sumTotal(cobrosEfectivoPorMetodo),
    ingresos_manuales_por_metodo: ingresosManualesEfectivoPorMetodo,
    total_ingresos_manuales: sumTotal(ingresosManualesEfectivoPorMetodo),
    egresos_por_metodo: egresosEfectivoPorMetodo,
    total_egresos: sumTotal(egresosEfectivoPorMetodo),
  };

  return {
    ventas_por_metodo: ventasPorMetodo,
    ingresos_por_metodo: ingresosPorMetodo,
    egresos_por_metodo: egresosPorMetodo,
    total_ventas: totalVentas,
    total_ventas_en_caja: totalVentasEnCaja,
    total_ventas_cuenta_corriente: totalVentasCc,
    cobros_cc_por_metodo: cobrosCcPorMetodo,
    total_cobros_cuenta_corriente: totalCobrosCc,
    total_ingresos: totalIngresos,
    total_ingresos_manuales: totalIngresosManuales,
    total_egresos: totalEgresos,
    efectivo_desglose: efectivoDesglose,
  };
};

export const getSessionDetail = async (sesionId) => {
  const sesion = await getSessionById(sesionId);
  const breakdown = await getSessionBreakdown(sesionId);
  const efectivo_fisico_esperado = computeEfectivoFisico(sesion);

  return {
    sesion: {
      ...sesion,
      efectivo_fisico_esperado,
    },
    resumen: {
      ...breakdown,
      efectivo_fisico_esperado,
      monto_apertura: sesion.monto_apertura,
    },
  };
};

export const openSession = async (usuarioId, data, ip = null) => {
  return withTransaction(async (conn) => {
    const existing = await getOpenSessionForUser(usuarioId, conn);
    if (existing) {
      throw new AppError('Ya tiene una caja abierta. Ciérrela antes de abrir otra.', 400);
    }

    const montoApertura = Number(data.monto_apertura ?? 0);
    if (montoApertura < 0) {
      throw new AppError('El monto de apertura no puede ser negativo', 400);
    }

    const [result] = await conn.execute(
      `INSERT INTO caja_sesiones (usuario_id, monto_apertura, observaciones_apertura)
       VALUES (?, ?, ?)`,
      [usuarioId, montoApertura, data.observaciones ?? null]
    );

    const sesionId = result.insertId;

    await conn.execute(
      `INSERT INTO caja_movimientos (sesion_id, tipo, monto, metodo_pago, descripcion, usuario_id)
       VALUES (?, 'apertura', ?, 'efectivo', 'Apertura de caja', ?)`,
      [sesionId, montoApertura, usuarioId]
    );

    await logAudit({
      usuarioId,
      accion: 'caja.abrir',
      modulo: 'caja',
      detalle: { sesion_id: sesionId, monto_apertura: montoApertura },
      ip,
    });

    return getSessionById(sesionId, conn);
  });
};

export const getSessionById = async (id, connection = null) => {
  const conn = connection || pool;
  const [rows] = await conn.execute(
    `SELECT s.*, u.nombre_usuario AS usuario_nombre
     FROM caja_sesiones s
     INNER JOIN usuarios u ON u.id = s.usuario_id
     WHERE s.id = ? LIMIT 1`,
    [id]
  );
  if (!rows.length) throw new AppError('Sesión de caja no encontrada', 404);
  return mapSession(rows[0]);
};

export const listSessions = async (query) => {
  const { page, limit, estado, usuario_id, fecha_desde, fecha_hasta } = query;
  const offset = (page - 1) * limit;
  const conditions = ['1=1'];
  const params = [];

  if (estado && estado !== 'todos') {
    conditions.push('s.estado = ?');
    params.push(estado);
  }
  if (usuario_id) {
    conditions.push('s.usuario_id = ?');
    params.push(usuario_id);
  }
  if (fecha_desde) {
    conditions.push('DATE(s.fecha_apertura) >= ?');
    params.push(fecha_desde);
  }
  if (fecha_hasta) {
    conditions.push('DATE(s.fecha_apertura) <= ?');
    params.push(fecha_hasta);
  }

  const whereClause = conditions.join(' AND ');

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM caja_sesiones s WHERE ${whereClause}`,
    params
  );
  const total = countRows[0].total;

  const [rows] = await pool.execute(
    `SELECT s.*, u.nombre_usuario AS usuario_nombre
     FROM caja_sesiones s
     INNER JOIN usuarios u ON u.id = s.usuario_id
     WHERE ${whereClause}
     ORDER BY s.fecha_apertura DESC
     ${sqlLimitOffset(limit, offset)}`,
    params
  );

  return {
    data: rows.map(mapSession),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
};

export const listMovements = async (sesionId, query) => {
  const { page, limit, tipo } = query;
  const offset = (page - 1) * limit;

  await getSessionById(sesionId);

  const conditions = ['m.sesion_id = ?'];
  const params = [sesionId];

  if (tipo && tipo !== 'todos') {
    conditions.push('m.tipo = ?');
    params.push(tipo);
  }

  const whereClause = conditions.join(' AND ');

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM caja_movimientos m WHERE ${whereClause}`,
    params
  );
  const total = countRows[0].total;

  const [rows] = await pool.execute(
    `SELECT m.*, u.nombre_usuario AS usuario_nombre,
            mp.nombre AS metodo_pago_nombre
     FROM caja_movimientos m
     INNER JOIN usuarios u ON u.id = m.usuario_id
     LEFT JOIN metodos_pago mp ON mp.codigo = m.metodo_pago
     WHERE ${whereClause}
     ORDER BY m.fecha DESC, m.id DESC
     ${sqlLimitOffset(limit, offset)}`,
    params
  );

  return {
    data: rows.map(mapMovement),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
};

export const addMovement = async (sesionId, data, usuarioId, ip = null) => {
  return withTransaction(async (conn) => {
    const sesion = await getSessionById(sesionId, conn);
    if (sesion.estado !== 'abierta') {
      throw new AppError('La sesión de caja está cerrada', 400);
    }

    const monto = Number(data.monto);
    if (monto <= 0) throw new AppError('El monto debe ser mayor a 0', 400);

    const tipo = data.tipo;
    if (!['ingreso', 'egreso'].includes(tipo)) {
      throw new AppError('Tipo de movimiento no válido', 400);
    }

    const metodoPago = data.metodo_pago?.trim() || 'efectivo';
    await getActivePaymentMethodByCode(metodoPago, conn);

    await conn.execute(
      `INSERT INTO caja_movimientos (sesion_id, tipo, monto, metodo_pago, descripcion, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sesionId, tipo, monto, metodoPago, data.descripcion ?? null, usuarioId]
    );

    const field = tipo === 'ingreso' ? 'total_ingresos' : 'total_egresos';
    await conn.execute(
      `UPDATE caja_sesiones SET ${field} = ${field} + ? WHERE id = ?`,
      [monto, sesionId]
    );

    if (await affectsPhysicalCash(metodoPago, conn)) {
      const operador = tipo === 'ingreso' ? '+' : '-';
      await conn.execute(
        `UPDATE caja_sesiones SET total_ventas_efectivo = total_ventas_efectivo ${operador} ? WHERE id = ?`,
        [monto, sesionId]
      );
    }

    await logAudit({
      usuarioId,
      accion: `caja.${tipo}`,
      modulo: 'caja',
      detalle: { sesion_id: sesionId, monto, metodo_pago: metodoPago, descripcion: data.descripcion },
      ip,
    });

    return getSessionById(sesionId, conn);
  });
};

export const registerSaleInCash = async (
  { sesionId, ventaId, numero, monto, metodoPago },
  usuarioId,
  conn
) => {
  if (!sesionId) return;

  const codigo = metodoPago || 'efectivo';
  const amount = Number(monto);

  await conn.execute(
    `INSERT INTO caja_movimientos (sesion_id, tipo, monto, metodo_pago, descripcion, referencia, venta_id, usuario_id)
     VALUES (?, 'venta', ?, ?, ?, ?, ?, ?)`,
    [sesionId, amount, codigo, `Venta ${numero}`, numero, ventaId, usuarioId]
  );

  if (await affectsPhysicalCash(codigo, conn)) {
    await conn.execute(
      'UPDATE caja_sesiones SET total_ventas_efectivo = total_ventas_efectivo + ? WHERE id = ?',
      [amount, sesionId]
    );
  }
};

export const reverseSaleInCash = async (
  { sesionId, ventaId, numero, monto, metodoPago },
  usuarioId,
  conn
) => {
  if (!sesionId) return;

  const codigo = metodoPago || 'efectivo';
  const amount = Number(monto);

  await conn.execute(
    `INSERT INTO caja_movimientos (sesion_id, tipo, monto, metodo_pago, descripcion, referencia, venta_id, usuario_id)
     VALUES (?, 'anulacion', ?, ?, ?, ?, ?, ?)`,
    [sesionId, amount, codigo, `Anulación ${numero}`, numero, ventaId, usuarioId]
  );

  if (await affectsPhysicalCash(codigo, conn)) {
    await conn.execute(
      'UPDATE caja_sesiones SET total_ventas_efectivo = total_ventas_efectivo - ? WHERE id = ?',
      [amount, sesionId]
    );
  }
};

/** Cobro de cuenta corriente que ingresa a caja según método de pago */
export const registerCcPaymentInCash = async (
  {
    sesionId,
    monto,
    metodoPago,
    ccMovimientoId,
    clienteNombre,
    referencia,
  },
  usuarioId,
  conn
) => {
  if (!sesionId) return null;

  const codigo = metodoPago || 'efectivo';
  const paymentMethod = await getActivePaymentMethodByCode(codigo, conn);
  const amount = Number(monto);

  await conn.execute(
    `INSERT INTO caja_movimientos (
      sesion_id, tipo, monto, metodo_pago, descripcion, referencia,
      cuenta_corriente_movimiento_id, usuario_id
    ) VALUES (?, 'cobro_cc', ?, ?, ?, ?, ?, ?)`,
    [
      sesionId,
      amount,
      codigo,
      `Cobro CC — ${clienteNombre}`,
      referencia ?? null,
      ccMovimientoId,
      usuarioId,
    ]
  );

  await conn.execute(
    'UPDATE caja_sesiones SET total_ingresos = total_ingresos + ? WHERE id = ?',
    [amount, sesionId]
  );

  if (paymentMethod.requiere_monto_recibido) {
    await conn.execute(
      'UPDATE caja_sesiones SET total_ventas_efectivo = total_ventas_efectivo + ? WHERE id = ?',
      [amount, sesionId]
    );
  }

  return paymentMethod;
};

export const closeSession = async (sesionId, data, usuarioId, ip = null) => {
  return withTransaction(async (conn) => {
    const sesion = await getSessionById(sesionId, conn);

    if (sesion.estado !== 'abierta') {
      throw new AppError('La sesión ya está cerrada', 400);
    }

    if (sesion.usuario_id !== usuarioId) {
      throw new AppError('Solo el usuario que abrió la caja puede cerrarla', 403);
    }

    const montoCierre = Number(data.monto_cierre);
    if (montoCierre < 0) throw new AppError('Monto de cierre inválido', 400);

    const montoEsperado = computeEfectivoFisico(sesion);
    const diferencia = montoCierre - montoEsperado;

    await conn.execute(
      `UPDATE caja_sesiones
       SET estado = 'cerrada',
           monto_esperado = ?,
           monto_cierre = ?,
           diferencia = ?,
           observaciones_cierre = ?,
           fecha_cierre = NOW()
       WHERE id = ?`,
      [montoEsperado, montoCierre, diferencia, data.observaciones ?? null, sesionId]
    );

    await logAudit({
      usuarioId,
      accion: 'caja.cerrar',
      modulo: 'caja',
      detalle: {
        sesion_id: sesionId,
        monto_esperado: montoEsperado,
        monto_cierre: montoCierre,
        diferencia,
      },
      ip,
    });

    return getSessionById(sesionId, conn);
  });
};

export const getCashSummary = async () => {
  const [abiertas] = await pool.execute(
    "SELECT COUNT(*) AS total FROM caja_sesiones WHERE estado = 'abierta'"
  );
  const [hoy] = await pool.execute(
    `SELECT COALESCE(SUM(monto_cierre), 0) AS cierres_hoy
     FROM caja_sesiones
     WHERE estado = 'cerrada' AND DATE(fecha_cierre) = CURDATE()`
  );
  return {
    sesiones_abiertas: Number(abiertas[0].total),
    cierres_hoy: Number(hoy[0].cierres_hoy),
  };
};
