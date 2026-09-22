import { z } from 'zod';

export const createInventoryMotiveSchema = z.object({
  nombre: z
    .string()
    .min(2, 'Mínimo 2 caracteres')
    .max(100, 'Máximo 100 caracteres')
    .trim(),
  tipo: z.enum(['entrada', 'salida', 'ambos']).optional().default('ambos'),
  orden: z.coerce.number().int().min(0).max(9999).optional().default(0),
  estado: z.enum(['activo', 'inactivo']).optional().default('activo'),
});

export const updateInventoryMotiveSchema = z
  .object({
    nombre: z.string().min(2).max(100).trim().optional(),
    tipo: z.enum(['entrada', 'salida', 'ambos']).optional(),
    orden: z.coerce.number().int().min(0).max(9999).optional(),
    estado: z.enum(['activo', 'inactivo']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const listInventoryMotivesQuerySchema = z.object({
  activos: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
  estado: z.enum(['activo', 'inactivo', 'todos']).optional().default('todos'),
  tipo: z.enum(['entrada', 'salida', 'ambos', 'todos']).optional().default('todos'),
});
