import * as userService from '../services/user.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const list = asyncHandler(async (req, res) => {
  const result = await userService.listUsers(req.query);
  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
});

export const getById = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id);
  res.json({
    success: true,
    data: { user },
  });
});

export const create = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.body);
  res.status(201).json({
    success: true,
    message: 'Usuario creado correctamente',
    data: { user },
  });
});

export const update = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(
    req.params.id,
    req.body,
    req.user.id
  );
  res.json({
    success: true,
    message: 'Usuario actualizado correctamente',
    data: { user },
  });
});

export const deactivate = asyncHandler(async (req, res) => {
  const user = await userService.deactivateUser(req.params.id, req.user.id);
  res.json({
    success: true,
    message: 'Usuario desactivado correctamente',
    data: { user },
  });
});

export const getRoles = asyncHandler(async (req, res) => {
  const roles = await userService.listRoles();
  res.json({
    success: true,
    data: { roles },
  });
});
