import * as productService from '../services/product.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { UNIDADES_MEDIDA } from '../constants/permissions.js';

export const quickSearch = asyncHandler(async (req, res) => {
  const productos = await productService.quickSearchProducts(req.query);
  res.json({ success: true, data: { productos } });
});

export const list = asyncHandler(async (req, res) => {
  const result = await productService.listProducts(req.query);
  res.json({ success: true, data: result.data, pagination: result.pagination });
});

export const getUnits = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { unidades: UNIDADES_MEDIDA } });
});

export const getById = asyncHandler(async (req, res) => {
  const producto = await productService.getProductById(req.params.id);
  res.json({ success: true, data: { producto } });
});

export const create = asyncHandler(async (req, res) => {
  const producto = await productService.createProduct(req.body);
  res.status(201).json({
    success: true,
    message: 'Producto creado correctamente',
    data: { producto },
  });
});

export const update = asyncHandler(async (req, res) => {
  const producto = await productService.updateProduct(req.params.id, req.body);
  res.json({
    success: true,
    message: 'Producto actualizado correctamente',
    data: { producto },
  });
});

export const deactivate = asyncHandler(async (req, res) => {
  const producto = await productService.deactivateProduct(req.params.id);
  res.json({
    success: true,
    message: 'Producto desactivado correctamente',
    data: { producto },
  });
});
