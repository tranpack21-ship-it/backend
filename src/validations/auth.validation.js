import { z } from 'zod';

export const loginSchema = z.object({
  nombre_usuario: z
    .string()
    .min(3, 'El usuario debe tener al menos 3 caracteres')
    .max(60, 'El usuario no puede exceder 60 caracteres')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Usuario solo puede contener letras, números, . _ -'),
  contrasena: z
    .string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres')
    .max(128, 'La contraseña es demasiado larga'),
});

export const registerSchema = z.object({
  nombre_usuario: z
    .string()
    .min(3)
    .max(60)
    .regex(/^[a-zA-Z0-9_.-]+$/),
  contrasena: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(128)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
      'Debe incluir mayúscula, minúscula y número'
    ),
  rol_id: z.coerce.number().int().positive().optional(),
  estado: z.enum(['activo', 'inactivo']).optional().default('activo'),
});
