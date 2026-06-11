import { z } from 'zod';
import { optionalDateFilter, withDateRangeRefine } from './common.validation.js';

export const listAuditSchema = withDateRangeRefine(
  z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    modulo: z.string().max(50).optional().default('todos'),
    accion: z.string().max(100).optional().default(''),
    usuario_id: z.coerce.number().int().positive().optional(),
    fecha_desde: optionalDateFilter,
    fecha_hasta: optionalDateFilter,
  })
);
