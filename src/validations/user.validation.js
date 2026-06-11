import { z } from 'zod';

const usernameField = z
  .string()
  .min(3, 'Mínimo 3 caracteres')
  .max(60, 'Máximo 60 caracteres')
  .regex(/^[a-zA-Z0-9_.-]+$/, 'Caracteres permitidos: letras, números, . _ -');

const passwordField = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .max(128)
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
    'Debe incluir mayúscula, minúscula y número'
  );

export const createUserSchema = z.object({
  nombre_usuario: usernameField,
  contrasena: passwordField,
  rol_id: z.coerce.number().int().positive('Rol inválido'),
  estado: z.enum(['activo', 'inactivo']).optional().default('activo'),
});

export const updateUserSchema = z
  .object({
    nombre_usuario: usernameField.optional(),
    contrasena: passwordField.optional(),
    rol_id: z.coerce.number().int().positive().optional(),
    estado: z.enum(['activo', 'inactivo']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  search: z.string().max(100).optional().default(''),
  estado: z.enum(['activo', 'inactivo', 'todos']).optional().default('todos'),
  rol_id: z.coerce.number().int().positive().optional(),
});
