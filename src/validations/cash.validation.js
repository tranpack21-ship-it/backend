import { z } from 'zod';
import { optionalDateFilter, withDateRangeRefine } from './common.validation.js';

export const openCashSchema = z.object({
  monto_apertura: z.coerce.number().min(0, 'Monto inválido'),
  observaciones: z.string().max(500).optional().nullable(),
});

export const closeCashSchema = z.object({
  monto_cierre: z.coerce.number().min(0, 'Monto de cierre inválido'),
  observaciones: z.string().max(500).optional().nullable(),
});

export const cashMovementSchema = z.object({
  tipo: z.enum(['ingreso', 'egreso']),
  monto: z.coerce.number().positive('El monto debe ser mayor a 0'),
  metodo_pago: z.string().min(1).max(50).trim().optional().default('efectivo'),
  descripcion: z.string().max(255).optional().nullable(),
});

export const listCashSessionsSchema = withDateRangeRefine(
  z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
    estado: z.enum(['abierta', 'cerrada', 'todos']).optional().default('todos'),
    usuario_id: z.coerce.number().int().positive().optional(),
    fecha_desde: optionalDateFilter,
    fecha_hasta: optionalDateFilter,
  })
);

export const listCashMovementsSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  tipo: z
    .enum(['todos', 'apertura', 'ingreso', 'egreso', 'venta', 'anulacion', 'cobro_cc'])
    .optional()
    .default('todos'),
});
