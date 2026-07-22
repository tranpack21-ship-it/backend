import * as cuentaCorrienteService from '../services/cuentaCorriente.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const summary = asyncHandler(async (req, res) => {
  const data = await cuentaCorrienteService.getSummary();
  res.json({ success: true, data });
});

export const list = asyncHandler(async (req, res) => {
  const result = await cuentaCorrienteService.listAccounts(req.query);
  res.json({ success: true, ...result });
});

export const getByClient = asyncHandler(async (req, res) => {
  const data = await cuentaCorrienteService.getClientAccount(req.params.clienteId);
  res.json({ success: true, data });
});

export const movements = asyncHandler(async (req, res) => {
  const result = await cuentaCorrienteService.listMovements(req.params.clienteId, req.query);
  res.json({ success: true, ...result });
});

export const pay = asyncHandler(async (req, res) => {
  const data = await cuentaCorrienteService.registerPayment(
    req.params.clienteId,
    req.body,
    req.user.id,
    req.ip
  );
  res.status(201).json({ success: true, data, message: 'Cobro registrado correctamente' });
});

export const adjust = asyncHandler(async (req, res) => {
  const data = await cuentaCorrienteService.registerAdjustment(
    req.params.clienteId,
    req.body,
    req.user.id,
    req.ip
  );
  res.status(201).json({ success: true, data, message: 'Ajuste registrado correctamente' });
});
