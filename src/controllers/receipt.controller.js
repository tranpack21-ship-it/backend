import * as receiptService from '../services/receipt.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const list = asyncHandler(async (req, res) => {
  const result = await receiptService.listReceipts(req.query);
  res.json({ success: true, data: result.data, pagination: result.pagination });
});

export const getByVenta = asyncHandler(async (req, res) => {
  const comprobante = await receiptService.getReceiptWithSaleDetail(req.params.ventaId);
  res.json({ success: true, data: comprobante });
});
