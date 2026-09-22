import * as cashConceptService from '../services/cashConcept.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const list = asyncHandler(async (req, res) => {
  const data = await cashConceptService.listCashConcepts(req.query);
  res.json({ success: true, data });
});

export const getById = asyncHandler(async (req, res) => {
  const data = await cashConceptService.getCashConceptById(req.params.id);
  res.json({ success: true, data });
});

export const create = asyncHandler(async (req, res) => {
  const data = await cashConceptService.createCashConcept(req.body);
  res.status(201).json({ success: true, data, message: 'Concepto creado' });
});

export const update = asyncHandler(async (req, res) => {
  const data = await cashConceptService.updateCashConcept(req.params.id, req.body);
  res.json({ success: true, data, message: 'Concepto actualizado' });
});

export const deactivate = asyncHandler(async (req, res) => {
  const data = await cashConceptService.deactivateCashConcept(req.params.id);
  res.json({ success: true, data, message: 'Concepto desactivado' });
});
