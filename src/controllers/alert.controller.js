import * as alertService from '../services/alert.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const list = asyncHandler(async (req, res) => {
  const { umbral_horas: umbralHoras } = req.query;
  const alertas = await alertService.getSystemAlerts(req.user, { umbralHoras });
  res.json({ success: true, data: { alertas } });
});
