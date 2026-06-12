import { AppError } from './AppError.js';
import {
  getActivePaymentMethodByCode,
  resolvePaymentMethodForSale,
} from '../services/paymentMethod.service.js';

export const MIXED_PAYMENT_CODE = 'mixto';

const roundMoney = (n) => Math.round(Number(n) * 100) / 100;

export const fetchSalePayments = async (ventaId, conn) => {
  const [rows] = await conn.execute(
    `SELECT vp.*, mp.nombre AS metodo_pago_nombre
     FROM venta_pagos vp
     LEFT JOIN metodos_pago mp ON mp.codigo = vp.metodo_pago
     WHERE vp.venta_id = ?
     ORDER BY vp.orden ASC, vp.id ASC`,
    [ventaId]
  );

  return rows.map((row) => ({
    id: row.id,
    venta_id: row.venta_id,
    metodo_pago: row.metodo_pago,
    metodo_pago_nombre: row.metodo_pago_nombre ?? row.metodo_pago,
    monto: Number(row.monto),
    monto_recibido: row.monto_recibido != null ? Number(row.monto_recibido) : null,
    vuelto: row.vuelto != null ? Number(row.vuelto) : null,
    orden: row.orden,
  }));
};

export const buildPaymentsSummaryLabel = (pagos) =>
  pagos.map((p) => `${p.metodo_pago_nombre} ${p.monto}`).join(' + ');

const validateCreditLimit = async (clienteId, ccAmount, conn) => {
  if (ccAmount <= 0) return;

  const [rows] = await conn.execute(
    `SELECT saldo_cuenta_corriente, limite_credito
     FROM clientes WHERE id = ? AND estado = 'activo' LIMIT 1`,
    [clienteId]
  );

  if (!rows.length) throw new AppError('Cliente no válido o inactivo', 400);

  const saldo = Number(rows[0].saldo_cuenta_corriente);
  const limite = rows[0].limite_credito != null ? Number(rows[0].limite_credito) : null;

  if (limite != null && saldo + ccAmount > limite) {
    throw new AppError(
      `El cliente superaría su límite de crédito (${limite}). Saldo actual: ${saldo}`,
      400
    );
  }
};

export const resolveAndValidatePayments = async (data, total, conn) => {
  let rawLines = [];

  if (data.pagos?.length) {
    rawLines = data.pagos.map((p, index) => ({
      metodo_pago: String(p.metodo_pago || '').trim(),
      monto: Number(p.monto),
      monto_recibido: p.monto_recibido != null ? Number(p.monto_recibido) : null,
      orden: index + 1,
    }));
  } else {
    const pm = await resolvePaymentMethodForSale(data.metodo_pago, conn);
    rawLines = [
      {
        metodo_pago: pm.codigo,
        monto: total,
        monto_recibido: data.monto_recibido != null ? Number(data.monto_recibido) : null,
        orden: 1,
      },
    ];
  }

  if (!rawLines.length) {
    throw new AppError('Debe indicar al menos un método de pago', 400);
  }

  if (rawLines.length > 10) {
    throw new AppError('Máximo 10 métodos de pago por venta', 400);
  }

  const resolved = [];
  let sum = 0;
  let ccTotal = 0;

  for (const line of rawLines) {
    if (!line.metodo_pago) {
      throw new AppError('Método de pago inválido', 400);
    }
    if (line.monto <= 0) {
      throw new AppError('Cada monto de pago debe ser mayor a 0', 400);
    }

    const pm = await getActivePaymentMethodByCode(line.metodo_pago, conn);
    sum = roundMoney(sum + line.monto);

    let montoRecibido = line.monto_recibido;
    let vuelto = null;

    if (pm.requiere_monto_recibido) {
      if (montoRecibido == null) montoRecibido = line.monto;
      if (montoRecibido < line.monto) {
        throw new AppError(
          `El monto recibido en "${pm.nombre}" debe ser mayor o igual a ${line.monto}`,
          400
        );
      }
      vuelto = roundMoney(montoRecibido - line.monto);
    } else {
      montoRecibido = null;
      vuelto = null;
    }

    if (pm.genera_cargo_cc) {
      ccTotal = roundMoney(ccTotal + line.monto);
    }

    resolved.push({
      metodo_pago: pm.codigo,
      metodo_pago_nombre: pm.nombre,
      monto: line.monto,
      monto_recibido: montoRecibido,
      vuelto,
      orden: line.orden,
      paymentMethod: pm,
    });
  }

  if (Math.abs(sum - total) > 0.01) {
    throw new AppError(
      `La suma de los pagos (${sum}) debe coincidir con el total (${total})`,
      400
    );
  }

  const needsClient = resolved.some(
    (r) => r.paymentMethod.requiere_cliente || r.paymentMethod.genera_cargo_cc
  );

  if (needsClient && !data.cliente_id) {
    throw new AppError('Debe seleccionar un cliente para este tipo de pago', 400);
  }

  if (ccTotal > 0 && data.cliente_id) {
    await validateCreditLimit(data.cliente_id, ccTotal, conn);
  }

  const uniqueMethods = [...new Set(resolved.map((r) => r.metodo_pago))];
  const summaryCode =
    uniqueMethods.length === 1 && resolved.length === 1 ? uniqueMethods[0] : MIXED_PAYMENT_CODE;

  const cashLines = resolved.filter((r) => r.paymentMethod.requiere_monto_recibido);
  const headerMontoRecibido =
    cashLines.length > 0
      ? roundMoney(cashLines.reduce((acc, r) => acc + (r.monto_recibido ?? r.monto), 0))
      : null;
  const headerVuelto =
    cashLines.length > 0
      ? roundMoney(cashLines.reduce((acc, r) => acc + (r.vuelto ?? 0), 0))
      : null;

  const needsCashSession = resolved.some((r) => !r.paymentMethod.genera_cargo_cc);

  return {
    lines: resolved,
    summaryCode,
    summaryLabel: resolved.map((r) => r.metodo_pago_nombre).join(' + '),
    headerMontoRecibido,
    headerVuelto,
    needsCashSession,
    hasCuentaCorriente: ccTotal > 0,
  };
};

export const insertSalePayments = async (ventaId, lines, conn) => {
  for (const line of lines) {
    await conn.execute(
      `INSERT INTO venta_pagos (venta_id, metodo_pago, monto, monto_recibido, vuelto, orden)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        ventaId,
        line.metodo_pago,
        line.monto,
        line.monto_recibido,
        line.vuelto,
        line.orden,
      ]
    );
  }
};
