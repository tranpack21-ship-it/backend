import { z } from 'zod';
import { optionalDateFilter, withDateRangeRefine } from './common.validation.js';

const emptyToNull = (val) => {
  if (val === '' || val === undefined) return null;
  return val;
};

const lineItemSchema = z.object({
  producto_id: z.coerce.number().int().positive(),
  cantidad: z.coerce.number().positive('Cantidad debe ser mayor a 0'),
  modo_venta: z.enum(['suelto', 'paquete']).optional().default('suelto'),
  precio_unitario: z.coerce.number().min(0).optional(),
  descuento: z.coerce.number().min(0).optional().default(0),
});

export const createQuoteSchema = z.object({
  cliente_id: z.preprocess(
    emptyToNull,
    z.union([z.null(), z.coerce.number().int().positive()]).optional()
  ),
  observaciones: z.preprocess(
    emptyToNull,
    z.string().max(500).nullable().optional()
  ),
  descuento: z.coerce.number().min(0).optional().default(0),
  validez_dias: z.coerce.number().int().min(1).max(365).optional().default(15),
  items: z.array(lineItemSchema).min(1, 'Debe incluir al menos un producto'),
});

export const listQuotesQuerySchema = withDateRangeRefine(
  z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
    search: z.string().max(100).optional().default(''),
    estado: z.enum(['vigente', 'anulado', 'convertido', 'todos']).optional().default('todos'),
    cliente_id: z.coerce.number().int().positive().optional(),
    fecha_desde: optionalDateFilter,
    fecha_hasta: optionalDateFilter,
  })
);
