import * as cashService from '../services/cash.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const clientIp = (req) => req.ip || req.headers['x-forwarded-for'] || null;

export const summary = asyncHandler(async (req, res) => {
  const resumen = await cashService.getCashSummary();
  res.json({ success: true, data: { resumen } });
});

export const current = asyncHandler(async (req, res) => {
  const sesion = await cashService.getOpenSessionForUser(req.user.id);
  res.json({ success: true, data: { sesion } });
});

export const currentDetail = asyncHandler(async (req, res) => {
  const sesion = await cashService.getOpenSessionForUser(req.user.id);
  if (!sesion) {
    return res.json({ success: true, data: { sesion: null, resumen: null } });
  }
  const detail = await cashService.getSessionDetail(sesion.id);
  res.json({ success: true, data: detail });
});

export const getDetail = asyncHandler(async (req, res) => {
  const detail = await cashService.getSessionDetail(req.params.id);
  res.json({ success: true, data: detail });
});

export const list = asyncHandler(async (req, res) => {
  const result = await cashService.listSessions(req.query);
  res.json({ success: true, data: result.data, pagination: result.pagination });
});

export const getById = asyncHandler(async (req, res) => {
  const sesion = await cashService.getSessionById(req.params.id);
  res.json({ success: true, data: { sesion } });
});

export const listMovements = asyncHandler(async (req, res) => {
  const result = await cashService.listMovements(req.params.id, req.query);
  res.json({ success: true, data: result.data, pagination: result.pagination });
});

export const open = asyncHandler(async (req, res) => {
  const sesion = await cashService.openSession(req.user.id, req.body, clientIp(req));
  res.status(201).json({
    success: true,
    message: 'Caja abierta correctamente',
    data: { sesion },
  });
});

export const close = asyncHandler(async (req, res) => {
  const sesion = await cashService.closeSession(
    req.params.id,
    req.body,
    req.user.id,
    clientIp(req)
  );
  res.json({
    success: true,
    message: 'Caja cerrada correctamente',
    data: { sesion },
  });
});

export const addMovement = asyncHandler(async (req, res) => {
  const sesion = await cashService.addMovement(
    req.params.id,
    req.body,
    req.user.id,
    clientIp(req)
  );
  res.json({
    success: true,
    message: 'Movimiento registrado',
    data: { sesion },
  });
});
