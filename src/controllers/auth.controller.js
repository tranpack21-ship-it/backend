import * as authService from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.json({
    success: true,
    message: 'Inicio de sesión exitoso',
    data: result,
  });
});

export const register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.body);
  res.status(201).json({
    success: true,
    message: 'Usuario registrado correctamente',
    data: { user },
  });
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user.id);
  res.json({
    success: true,
    data: { user },
  });
});
