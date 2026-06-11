import { z } from 'zod';
import { optionalDateFilter, withDateRangeRefine } from './common.validation.js';

export const listReceiptsSchema = withDateRangeRefine(
  z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
    search: z.string().max(100).optional().default(''),
    tipo: z.enum(['ticket', 'factura', 'boleta', 'todos']).optional().default('todos'),
    fecha_desde: optionalDateFilter,
    fecha_hasta: optionalDateFilter,
  })
);
