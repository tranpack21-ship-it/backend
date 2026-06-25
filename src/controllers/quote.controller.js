import * as quoteService from '../services/quote.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const list = asyncHandler(async (req, res) => {
  const result = await quoteService.listQuotes(req.query);
  res.json({ success: true, data: result.data, pagination: result.pagination });
});

export const getById = asyncHandler(async (req, res) => {
  const presupuesto = await quoteService.getQuoteById(req.params.id);
  res.json({ success: true, data: { presupuesto } });
});

export const getPrintData = asyncHandler(async (req, res) => {
  const printData = await quoteService.getQuotePrintData(req.params.id);
  res.json({ success: true, data: printData });
});

const clientIp = (req) => req.ip || req.headers['x-forwarded-for'] || null;

export const create = asyncHandler(async (req, res) => {
  const presupuesto = await quoteService.createQuote(req.body, req.user.id, clientIp(req));
  res.status(201).json({
    success: true,
    message: 'Presupuesto registrado correctamente',
    data: { presupuesto },
  });
});

export const cancel = asyncHandler(async (req, res) => {
  const presupuesto = await quoteService.cancelQuote(req.params.id, req.user.id, clientIp(req));
  res.json({
    success: true,
    message: 'Presupuesto anulado correctamente',
    data: { presupuesto },
  });
});
