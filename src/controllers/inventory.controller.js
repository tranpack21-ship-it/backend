import * as inventoryService from '../services/inventory.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const list = asyncHandler(async (req, res) => {
  const result = await inventoryService.listMovements(req.query);
  res.json({ success: true, data: result.data, pagination: result.pagination });
});

export const summary = asyncHandler(async (req, res) => {
  const resumen = await inventoryService.getInventorySummary();
  res.json({ success: true, data: { resumen } });
});

export const stockAlerts = asyncHandler(async (req, res) => {
  const [result, resumen] = await Promise.all([
    inventoryService.listStockAlerts(req.query),
    inventoryService.getStockAlertsSummary(),
  ]);
  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
    resumen,
  });
});

export const createMovement = asyncHandler(async (req, res) => {
  const movimiento = await inventoryService.registerMovement(req.body, req.user.id);
  res.status(201).json({
    success: true,
    message: 'Movimiento registrado correctamente',
    data: { movimiento },
  });
});
