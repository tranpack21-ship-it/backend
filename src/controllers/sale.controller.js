import * as saleService from '../services/sale.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { ROLES, PERMISSION_CODES } from '../constants/permissions.js';

const assertCanConvertQuote = (req) => {
  if (!req.body.presupuesto_id) return;
  if (req.user.rol === ROLES.ADMIN) return;

  const perms = req.user.permisos || [];
  const canConvert = perms.includes(PERMISSION_CODES.PRESUPUESTOS_CONVERTIR);
  const canCreateSale = perms.includes(PERMISSION_CODES.VENTAS_CREAR);

  if (!canConvert || !canCreateSale) {
    throw new AppError('No tiene permiso para convertir presupuestos en venta', 403);
  }
};

export const list = asyncHandler(async (req, res) => {
  const result = await saleService.listSales(req.query, req.user.id);
  res.json({ success: true, data: result.data, pagination: result.pagination });
});

export const summary = asyncHandler(async (req, res) => {
  const resumen = await saleService.getSalesSummary(req.query);
  res.json({ success: true, data: { resumen } });
});

export const getById = asyncHandler(async (req, res) => {
  const venta = await saleService.getSaleById(req.params.id, null, req.user.id);
  res.json({ success: true, data: { venta } });
});

const clientIp = (req) => req.ip || req.headers['x-forwarded-for'] || null;

export const create = asyncHandler(async (req, res) => {
  assertCanConvertQuote(req);
  const venta = await saleService.createSale(req.body, req.user.id, clientIp(req));
  const message = req.body.presupuesto_id
    ? 'Presupuesto convertido a venta correctamente'
    : 'Venta registrada correctamente';
  res.status(201).json({
    success: true,
    message,
    data: { venta },
  });
});

export const cancel = asyncHandler(async (req, res) => {
  const venta = await saleService.cancelSale(req.params.id, req.user.id, clientIp(req));
  res.json({
    success: true,
    message: 'Venta anulada correctamente. Stock restaurado.',
    data: { venta },
  });
});
