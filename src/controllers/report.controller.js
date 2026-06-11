import * as reportService from '../services/report.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const dashboard = asyncHandler(async (req, res) => {
  const reporte = await reportService.getDashboardReport(req.query);
  res.json({ success: true, data: { reporte } });
});

export const salesByDay = asyncHandler(async (req, res) => {
  const datos = await reportService.getSalesByDayReport(req.query);
  res.json({ success: true, data: { datos } });
});

export const topProducts = asyncHandler(async (req, res) => {
  const datos = await reportService.getTopProductsReport(req.query);
  res.json({ success: true, data: { datos } });
});

export const lowStock = asyncHandler(async (req, res) => {
  const datos = await reportService.getLowStockReport();
  res.json({ success: true, data: { datos } });
});

export const salesByUser = asyncHandler(async (req, res) => {
  const datos = await reportService.getSalesByUserReport(req.query);
  res.json({ success: true, data: { datos } });
});
