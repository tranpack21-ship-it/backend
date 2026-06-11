import { z } from 'zod';
import { optionalDateFilter, withDateRangeRefine } from './common.validation.js';

export const reportDateRangeSchema = withDateRangeRefine(
  z.object({
    fecha_desde: optionalDateFilter,
    fecha_hasta: optionalDateFilter,
    limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  })
);
