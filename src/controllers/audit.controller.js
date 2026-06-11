import * as auditService from '../services/audit.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const list = asyncHandler(async (req, res) => {
  const result = await auditService.listAudit(req.query);
  res.json({ success: true, data: result.data, pagination: result.pagination });
});
