import { pool } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { sqlLimitOffset } from '../utils/paginationSql.js';
import { logAudit } from '../utils/audit.js';
import { getActivePaymentMethodByCode } from './paymentMethod.service.js';
import {
  getOpenSessionForUser,
  registerCcPaymentInCash,
} from './cash.service.js';

const mapMovement = (row) => ({
  id: row.id,
  cliente_id: row.cliente_id,
  tipo: row.tipo,
  monto: Number(row.monto),
  saldo_anterior: Number(row.saldo_anterior),
  saldo_posterior: Number(row.saldo_posterior),
  venta_id: row.venta_id,
  venta_numero: row.venta_numero,
  referencia: row.referencia,
  observaciones: row.observaciones,
  metodo_cobro: row.metodo_cobro,
  metodo_cobro_nombre: row.metodo_cobro_nombre ?? row.metodo_cobro,
  caja_sesion_id: row.caja_sesion_id,
  usuario_id: row.usuario_id,
  usuario_nombre: row.usuario_nombre,
  fecha: row.fecha,
});

const getClientForUpdate = async (clienteId, conn) => {
  const [rows] = await conn.execute(
    `SELECT id, nombre, estado, saldo_cuenta_corriente, limite_credito
     FROM clientes WHERE id = ? LIMIT 1 FOR UPDATE`,
    [clienteId]
  );
  if (!rows.length) throw new AppError('Cliente no encontrado', 404);
  if (rows[0].estado !== 'activo') {
    throw new AppError('El cliente está inactivo', 400);
  }
  return rows[0];
};

const insertMovement = async (
  conn,
  {
    clienteId,
    tipo,
    monto,
    saldoAnterior,
    saldoPosterior,
    ventaId,
    referencia,
    observaciones,
    metodoCobro,
    cajaSesionId,
    usuarioId,
  }
) => {
  const [result] = await conn.execute(
    `INSERT INTO cuenta_corriente_movimientos (
      cliente_id, tipo, monto, saldo_anterior, saldo_posterior,
      venta_id, referencia, observaciones, metodo_cobro, caja_sesion_id, usuario_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      clienteId,
      tipo,
      monto,
      saldoAnterior,
      saldoPosterior,
      ventaId ?? null,
      referencia ?? null,
      observaciones ?? null,
      metodoCobro ?? null,
      cajaSesionId ?? null,
      usuarioId,
    ]
  );
  return result.insertId;
};

/**
 * Registra cargo por venta en cuenta corriente (dentro de transacción).
 */
export const registerSaleCharge = async (
  { clienteId, ventaId, numero, total },
  usuarioId,
  conn
) => {
  const client = await getClientForUpdate(clienteId, conn);
  const saldoAnterior = Number(client.saldo_cuenta_corriente);
  const monto = Number(total);

  if (client.limite_credito != null) {
    const limite = Number(client.limite_credito);
    if (saldoAnterior + monto > limite) {
      throw new AppError(
        `El cliente superaría su límite de crédito (${limite}). Saldo actual: ${saldoAnterior}`,
        400
      );
    }
  }

  const saldoPosterior = saldoAnterior + monto;

  await conn.execute(
    'UPDATE clientes SET saldo_cuenta_corriente = ? WHERE id = ?',
    [saldoPosterior, clienteId]
  );

  await insertMovement(conn, {
    clienteId,
    tipo: 'cargo',
    monto,
    saldoAnterior,
    saldoPosterior,
    ventaId,
    referencia: numero,
    observaciones: `Venta ${numero}`,
    usuarioId,
  });
};

/**
 * Revierte cargo al anular venta en cuenta corriente.
 */
export const reverseSaleCharge = async (
  { clienteId, ventaId, numero, total },
  usuarioId,
  conn
) => {
  const client = await getClientForUpdate(clienteId, conn);
  const saldoAnterior = Number(client.saldo_cuenta_corriente);
  const monto = Number(total);
  const saldoPosterior = Math.max(0, saldoAnterior - monto);

  await conn.execute(
    'UPDATE clientes SET saldo_cuenta_corriente = ? WHERE id = ?',
    [saldoPosterior, clienteId]
  );

  await insertMovement(conn, {
    clienteId,
    tipo: 'anulacion',
    monto,
    saldoAnterior,
    saldoPosterior,
    ventaId,
    referencia: numero,
    observaciones: `Anulación venta ${numero}`,
    usuarioId,
  });
};

export const getSummary = async () => {
  const [rows] = await pool.execute(
    `SELECT
       COUNT(CASE WHEN saldo_cuenta_corriente > 0 AND estado = 'activo' THEN 1 END) AS clientes_con_deuda,
       COALESCE(SUM(CASE WHEN estado = 'activo' THEN saldo_cuenta_corriente ELSE 0 END), 0) AS total_por_cobrar,
       (SELECT COUNT(*) FROM cuenta_corriente_movimientos WHERE DATE(fecha) = CURDATE()) AS movimientos_hoy,
       COALESCE(MIN(CASE WHEN estado = 'activo' THEN saldo_cuenta_corriente END), 0) AS saldo_min,
       COALESCE(MAX(CASE WHEN estado = 'activo' THEN saldo_cuenta_corriente END), 0) AS saldo_max
     FROM clientes`
  );
  return {
    clientes_con_deuda: Number(rows[0].clientes_con_deuda),
    total_por_cobrar: Number(rows[0].total_por_cobrar),
    movimientos_hoy: Number(rows[0].movimientos_hoy),
    saldo_min: Number(rows[0].saldo_min),
    saldo_max: Number(rows[0].saldo_max),
  };
};

export const listAccounts = async ({ page, limit, search, solo_deuda, saldo_min, saldo_max }) => {
  const offset = (page - 1) * limit;
  const conditions = ["c.estado = 'activo'"];
  const params = [];

  if (search) {
    conditions.push('(c.nombre LIKE ? OR c.numero_documento LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term);
  }

  if (solo_deuda) {
    conditions.push('c.saldo_cuenta_corriente > 0');
  }

  if (saldo_min != null && saldo_min !== '') {
    conditions.push('c.saldo_cuenta_corriente >= ?');
    params.push(Number(saldo_min));
  }

  if (saldo_max != null && saldo_max !== '') {
    conditions.push('c.saldo_cuenta_corriente <= ?');
    params.push(Number(saldo_max));
  }

  const whereClause = conditions.join(' AND ');

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM clientes c WHERE ${whereClause}`,
    params
  );
  const total = countRows[0].total;

  const [rows] = await pool.execute(
    `SELECT c.id, c.nombre, c.tipo_documento, c.numero_documento, c.telefono,
            c.saldo_cuenta_corriente, c.limite_credito,
            (SELECT MAX(fecha) FROM cuenta_corriente_movimientos m WHERE m.cliente_id = c.id) AS ultimo_movimiento
     FROM clientes c
     WHERE ${whereClause}
     ORDER BY c.saldo_cuenta_corriente DESC, c.nombre ASC
     ${sqlLimitOffset(limit, offset)}`,
    params
  );

  return {
    data: rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      tipo_documento: r.tipo_documento,
      numero_documento: r.numero_documento,
      telefono: r.telefono,
      saldo_cuenta_corriente: Number(r.saldo_cuenta_corriente),
      limite_credito: r.limite_credito != null ? Number(r.limite_credito) : null,
      ultimo_movimiento: r.ultimo_movimiento,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
};

export const getClientAccount = async (clienteId) => {
  const [clients] = await pool.execute(
    `SELECT id, nombre, tipo_documento, numero_documento, email, telefono, direccion,
            estado, saldo_cuenta_corriente, limite_credito, fecha_creacion
     FROM clientes WHERE id = ? LIMIT 1`,
    [clienteId]
  );
  if (!clients.length) throw new AppError('Cliente no encontrado', 404);

  const c = clients[0];
  return {
    id: c.id,
    nombre: c.nombre,
    tipo_documento: c.tipo_documento,
    numero_documento: c.numero_documento,
    email: c.email,
    telefono: c.telefono,
    direccion: c.direccion,
    estado: c.estado,
    saldo_cuenta_corriente: Number(c.saldo_cuenta_corriente),
    limite_credito: c.limite_credito != null ? Number(c.limite_credito) : null,
    fecha_creacion: c.fecha_creacion,
  };
};

export const listMovements = async (clienteId, { page, limit }) => {
  const offset = (page - 1) * limit;

  const [countRows] = await pool.execute(
    'SELECT COUNT(*) AS total FROM cuenta_corriente_movimientos WHERE cliente_id = ?',
    [clienteId]
  );
  const total = countRows[0].total;

  const [rows] = await pool.execute(
    `SELECT m.*, u.nombre_usuario AS usuario_nombre, v.numero AS venta_numero,
            mp.nombre AS metodo_cobro_nombre
     FROM cuenta_corriente_movimientos m
     INNER JOIN usuarios u ON u.id = m.usuario_id
     LEFT JOIN ventas v ON v.id = m.venta_id
     LEFT JOIN metodos_pago mp ON mp.codigo = m.metodo_cobro
     WHERE m.cliente_id = ?
     ORDER BY m.fecha DESC, m.id DESC
     ${sqlLimitOffset(limit, offset)}`,
    [clienteId]
  );

  return {
    data: rows.map(mapMovement),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
};

const normalizePaymentLines = (data) => {
  if (Array.isArray(data.pagos) && data.pagos.length > 0) {
    return data.pagos.map((p) => ({
      metodo_cobro: String(p.metodo_cobro || 'efectivo').trim().toLowerCase(),
      monto: Number(p.monto),
    }));
  }

  return [
    {
      metodo_cobro: String(data.metodo_cobro || 'efectivo').trim().toLowerCase(),
      monto: Number(data.monto),
    },
  ];
};

export const registerPayment = async (clienteId, data, usuarioId, ip = null) => {
  const lines = normalizePaymentLines(data);

  if (lines.length < 1 || lines.length > 2) {
    throw new AppError('Puede usar 1 o 2 métodos de cobro', 400);
  }

  for (const line of lines) {
    if (!Number.isFinite(line.monto) || line.monto <= 0) {
      throw new AppError('Cada monto de cobro debe ser mayor a 0', 400);
    }
  }

  const amount = Math.round(lines.reduce((acc, l) => acc + l.monto, 0) * 100) / 100;
  if (amount <= 0) throw new AppError('El monto del cobro debe ser mayor a 0', 400);

  const codes = lines.map((l) => l.metodo_cobro);
  if (new Set(codes).size !== codes.length) {
    throw new AppError('Los métodos de cobro deben ser distintos', 400);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const resolvedMethods = [];
    for (const line of lines) {
      const paymentMethod = await getActivePaymentMethodByCode(line.metodo_cobro, conn);
      if (paymentMethod.genera_cargo_cc) {
        throw new AppError(
          'No se puede cobrar cuenta corriente con un método que genera cargo a CC',
          400
        );
      }
      resolvedMethods.push(paymentMethod);
    }

    const openSession = await getOpenSessionForUser(usuarioId, conn);
    const needsCash = resolvedMethods.some((m) => m.registra_en_caja);
    if (needsCash && !openSession) {
      throw new AppError(
        'Debe abrir la caja antes de registrar cobros que ingresan al arqueo',
        400
      );
    }

    const client = await getClientForUpdate(clienteId, conn);
    const saldoAnterior = Number(client.saldo_cuenta_corriente);

    if (saldoAnterior <= 0) {
      throw new AppError('El cliente no tiene saldo pendiente en cuenta corriente', 400);
    }

    if (amount > saldoAnterior + 0.009) {
      throw new AppError(
        `El cobro no puede superar el saldo pendiente (${saldoAnterior})`,
        400
      );
    }

    const saldoPosterior = Math.round((saldoAnterior - amount) * 100) / 100;

    await conn.execute(
      'UPDATE clientes SET saldo_cuenta_corriente = ? WHERE id = ?',
      [saldoPosterior, clienteId]
    );

    const refBase = `COBRO-${clienteId}-${Date.now()}`;
    const mediosLabel = resolvedMethods.map((m) => m.nombre).join(' + ');
    const userObs = data.observaciones?.trim() || '';
    const createdIds = [];
    let runningAnterior = saldoAnterior;

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const method = resolvedMethods[i];
      const runningPosterior = Math.round((runningAnterior - line.monto) * 100) / 100;
      const referencia = lines.length > 1 ? `${refBase}-${i + 1}` : refBase;
      const obsParts = [
        userObs || null,
        lines.length > 1
          ? `Cobro mixto (${i + 1}/${lines.length}): ${method.nombre}`
          : `Medio: ${method.nombre}`,
      ].filter(Boolean);

      const ccMovId = await insertMovement(conn, {
        clienteId,
        tipo: 'pago',
        monto: line.monto,
        saldoAnterior: runningAnterior,
        saldoPosterior: runningPosterior,
        ventaId: null,
        referencia,
        observaciones: obsParts.join(' — ') || 'Cobro registrado',
        metodoCobro: line.metodo_cobro,
        cajaSesionId: openSession?.id ?? null,
        usuarioId,
      });

      createdIds.push(ccMovId);

      if (openSession) {
        await registerCcPaymentInCash(
          {
            sesionId: openSession.id,
            monto: line.monto,
            metodoPago: line.metodo_cobro,
            ccMovimientoId: ccMovId,
            clienteNombre: client.nombre,
            referencia: refBase,
          },
          usuarioId,
          conn
        );
      }

      runningAnterior = runningPosterior;
    }

    await conn.commit();

    await logAudit({
      usuarioId,
      accion: 'cuenta_corriente.cobro',
      modulo: 'cuenta_corriente',
      detalle: {
        cliente_id: clienteId,
        monto: amount,
        metodos: lines.map((l) => ({ metodo_cobro: l.metodo_cobro, monto: l.monto })),
        medios: mediosLabel,
        referencia: refBase,
        movimientos_ids: createdIds,
        caja_sesion_id: openSession?.id,
        saldo_posterior: saldoPosterior,
      },
      ip,
    });

    return getClientAccount(clienteId);
  } catch (err) {
    try {
      await conn.rollback();
    } catch (rollbackErr) {
      console.error('[cuentaCorriente.registerPayment] rollback falló:', rollbackErr?.message);
    }
    throw err;
  } finally {
    conn.release();
  }
};

export const registerAdjustment = async (
  clienteId,
  { monto, tipo_ajuste, observaciones },
  usuarioId,
  ip = null
) => {
  const amount = Number(monto);
  if (amount <= 0) throw new AppError('El monto del ajuste debe ser mayor a 0', 400);
  if (!['aumentar', 'disminuir'].includes(tipo_ajuste)) {
    throw new AppError('Tipo de ajuste no válido', 400);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const client = await getClientForUpdate(clienteId, conn);
    const saldoAnterior = Number(client.saldo_cuenta_corriente);
    let saldoPosterior;

    if (tipo_ajuste === 'aumentar') {
      saldoPosterior = saldoAnterior + amount;
      if (client.limite_credito != null && saldoPosterior > Number(client.limite_credito)) {
        throw new AppError('El ajuste superaría el límite de crédito del cliente', 400);
      }
    } else {
      if (amount > saldoAnterior) {
        throw new AppError('No puede disminuir más que el saldo actual', 400);
      }
      saldoPosterior = saldoAnterior - amount;
    }

    await conn.execute(
      'UPDATE clientes SET saldo_cuenta_corriente = ? WHERE id = ?',
      [saldoPosterior, clienteId]
    );

    await insertMovement(conn, {
      clienteId,
      tipo: 'ajuste',
      monto: amount,
      saldoAnterior,
      saldoPosterior,
      ventaId: null,
      referencia: null,
      observaciones: observaciones?.trim() || `Ajuste: ${tipo_ajuste}`,
      usuarioId,
    });

    await conn.commit();

    await logAudit({
      usuarioId,
      accion: 'cuenta_corriente.ajuste',
      modulo: 'cuenta_corriente',
      detalle: { cliente_id: clienteId, tipo_ajuste, monto: amount },
      ip,
    });

    return getClientAccount(clienteId);
  } catch (err) {
    try {
      await conn.rollback();
    } catch (rollbackErr) {
      console.error('[cuentaCorriente.registerAdjustment] rollback falló:', rollbackErr?.message);
    }
    throw err;
  } finally {
    conn.release();
  }
};
