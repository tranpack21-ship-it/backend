import { z } from 'zod';
import { optionalDateFilter, withDateRangeRefine } from './common.validation.js';

const cantidadSchema = z.coerce.number().positive('La cantidad debe ser mayor a 0');

export const createMovementSchema = z.object({
  producto_id: z.coerce.number().int().positive(),
  tipo: z.enum(['entrada', 'salida', 'ajuste']),
  cantidad: cantidadSchema,
  motivo: z.string().min(3).max(255).trim(),
});

export const stockAlertsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  filtro: z
    .enum(['todos', 'bajo', 'sin_stock', 'negativo', 'critico'])
    .optional()
    .default('todos'),
  search: z.string().trim().max(100).optional(),
  categoria_id: z.coerce.number().int().positive().optional(),
  producto_id: z.coerce.number().int().positive().optional(),
});

export const listMovementsQuerySchema = withDateRangeRefine(
  z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
    producto_id: z.coerce.number().int().positive().optional(),
    tipo: z.enum(['entrada', 'salida', 'ajuste', 'todos']).optional().default('todos'),
    fecha_desde: optionalDateFilter,
    fecha_hasta: optionalDateFilter,
  })
);
