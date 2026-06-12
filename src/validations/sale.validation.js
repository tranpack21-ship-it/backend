import { z } from 'zod';
import { TIPOS_COMPROBANTE } from '../constants/permissions.js';
import { optionalDateFilter, withDateRangeRefine } from './common.validation.js';

const emptyToNull = (val) => {
  if (val === '' || val === undefined) return null;
  return val;
};

const lineItemSchema = z.object({
  producto_id: z.coerce.number().int().positive(),
  cantidad: z.coerce.number().positive('Cantidad debe ser mayor a 0'),
  precio_unitario: z.coerce.number().min(0).optional(),
  descuento: z.coerce.number().min(0).optional().default(0),
});

const salePaymentLineSchema = z.object({
  metodo_pago: z.string().min(1).max(50).trim(),
  monto: z.coerce.number().positive('El monto debe ser mayor a 0'),
  monto_recibido: z.preprocess(
    emptyToNull,
    z.union([z.null(), z.coerce.number().min(0)]).optional()
  ),
});

export const createSaleSchema = z.object({
  cliente_id: z.preprocess(
    emptyToNull,
    z.union([z.null(), z.coerce.number().int().positive()]).optional()
  ),
  observaciones: z.preprocess(
    emptyToNull,
    z.string().max(500).nullable().optional()
  ),
  descuento: z.coerce.number().min(0).optional().default(0),
  metodo_pago: z.string().min(1).max(50).trim().optional(),
  monto_recibido: z.preprocess(
    emptyToNull,
    z.union([z.null(), z.coerce.number().min(0)]).optional()
  ),
  tipo_comprobante: z.enum(TIPOS_COMPROBANTE).optional().default('ticket'),
  requiere_caja: z.coerce.boolean().optional().default(false),
  pagos: z.array(salePaymentLineSchema).min(1).max(10).optional(),
  items: z.array(lineItemSchema).min(1, 'Debe incluir al menos un producto'),
});

export const listSalesQuerySchema = withDateRangeRefine(
  z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
    search: z.string().max(100).optional().default(''),
    estado: z.enum(['completada', 'anulada', 'todos']).optional().default('todos'),
    metodo_pago: z.string().max(50).optional(),
    cliente_id: z.coerce.number().int().positive().optional(),
    fecha_desde: optionalDateFilter,
    fecha_hasta: optionalDateFilter,
    caja_sesion_id: z.coerce.number().int().positive().optional(),
  })
);

export const salesSummaryQuerySchema = withDateRangeRefine(
  z.object({
    fecha_desde: optionalDateFilter,
    fecha_hasta: optionalDateFilter,
    caja_sesion_id: z.coerce.number().int().positive().optional(),
  })
);
