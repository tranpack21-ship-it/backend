import * as categoryService from '../services/category.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const list = asyncHandler(async (req, res) => {
  const result = await categoryService.listCategories(req.query);
  res.json({ success: true, data: result.data, pagination: result.pagination });
});

export const listActive = asyncHandler(async (req, res) => {
  const categorias = await categoryService.listCategoriesActive();
  res.json({ success: true, data: { categorias } });
});

export const getById = asyncHandler(async (req, res) => {
  const categoria = await categoryService.getCategoryById(req.params.id);
  res.json({ success: true, data: { categoria } });
});

export const create = asyncHandler(async (req, res) => {
  const categoria = await categoryService.createCategory(req.body);
  res.status(201).json({
    success: true,
    message: 'Categoría creada correctamente',
    data: { categoria },
  });
});

export const update = asyncHandler(async (req, res) => {
  const categoria = await categoryService.updateCategory(req.params.id, req.body);
  res.json({
    success: true,
    message: 'Categoría actualizada correctamente',
    data: { categoria },
  });
});

export const deactivate = asyncHandler(async (req, res) => {
  const categoria = await categoryService.deactivateCategory(req.params.id);
  res.json({
    success: true,
    message: 'Categoría desactivada correctamente',
    data: { categoria },
  });
});
