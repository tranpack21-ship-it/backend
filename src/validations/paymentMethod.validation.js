import { z } from 'zod';

const codigoSchema = z
  .string()
  .min(2, 'Mínimo 2 caracteres')
  .max(50)
  .trim()
  .regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y guión bajo');

const flagsSchema = {
  requiere_cliente: z.coerce.boolean().optional().default(false),
  requiere_monto_recibido: z.coerce.boolean().optional().default(false),
  registra_en_caja: z.coerce.boolean().optional().default(false),
  genera_cargo_cc: z.coerce.boolean().optional().default(false),
  es_predeterminado: z.coerce.boolean().optional().default(false),
  orden: z.coerce.number().int().min(0).max(9999).optional().default(0),
  estado: z.enum(['activo', 'inactivo']).optional().default('activo'),
};

export const createPaymentMethodSchema = z.object({
  codigo: codigoSchema,
  nombre: z.string().min(2).max(100).trim(),
  descripcion: z.string().max(255).optional().nullable(),
  ...flagsSchema,
});

export const updatePaymentMethodSchema = z
  .object({
    nombre: z.string().min(2).max(100).trim().optional(),
    descripcion: z.string().max(255).optional().nullable(),
    requiere_cliente: z.coerce.boolean().optional(),
    requiere_monto_recibido: z.coerce.boolean().optional(),
    registra_en_caja: z.coerce.boolean().optional(),
    genera_cargo_cc: z.coerce.boolean().optional(),
    es_predeterminado: z.coerce.boolean().optional(),
    orden: z.coerce.number().int().min(0).max(9999).optional(),
    estado: z.enum(['activo', 'inactivo']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo',
  });

export const listPaymentMethodsQuerySchema = z.object({
  activos: z.preprocess(
    (v) => {
      if (v === undefined || v === null || v === '') return undefined;
      return v === 'true' || v === '1';
    },
    z.boolean().optional()
  ),
  estado: z.enum(['activo', 'inactivo', 'todos']).optional().default('todos'),
});
