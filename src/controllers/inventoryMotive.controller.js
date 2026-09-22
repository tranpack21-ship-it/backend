import * as inventoryMotiveService from '../services/inventoryMotive.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const list = asyncHandler(async (req, res) => {
  const data = await inventoryMotiveService.listInventoryMotives(req.query);
  res.json({ success: true, data });
});

export const getById = asyncHandler(async (req, res) => {
  const data = await inventoryMotiveService.getInventoryMotiveById(req.params.id);
  res.json({ success: true, data });
});

export const create = asyncHandler(async (req, res) => {
  const data = await inventoryMotiveService.createInventoryMotive(req.body);
  res.status(201).json({ success: true, data, message: 'Motivo creado' });
});

export const update = asyncHandler(async (req, res) => {
  const data = await inventoryMotiveService.updateInventoryMotive(req.params.id, req.body);
  res.json({ success: true, data, message: 'Motivo actualizado' });
});

export const deactivate = asyncHandler(async (req, res) => {
  const data = await inventoryMotiveService.deactivateInventoryMotive(req.params.id);
  res.json({ success: true, data, message: 'Motivo desactivado' });
});
