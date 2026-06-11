import { z } from 'zod';

export const createCategorySchema = z.object({
  nombre: z
    .string()
    .min(2, 'Mínimo 2 caracteres')
    .max(100, 'Máximo 100 caracteres')
    .trim(),
  descripcion: z.string().max(500).optional().nullable(),
  estado: z.enum(['activo', 'inactivo']).optional().default('activo'),
});

export const updateCategorySchema = z
  .object({
    nombre: z.string().min(2).max(100).trim().optional(),
    descripcion: z.string().max(500).optional().nullable(),
    estado: z.enum(['activo', 'inactivo']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const listCategoriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  search: z.string().max(100).optional().default(''),
  estado: z.enum(['activo', 'inactivo', 'todos']).optional().default('todos'),
});
