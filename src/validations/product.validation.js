import { z } from 'zod';
import { UNIDADES_MEDIDA } from '../constants/permissions.js';

const emptyToNull = (val) => {
  if (val === '' || val === undefined) return null;
  return val;
};

const optionalUrlSchema = z.preprocess(
  emptyToNull,
  z
    .union([
      z.null(),
      z
        .string()
        .max(500, 'URL demasiado larga')
        .url('Debe ser una URL válida (http o https)'),
    ])
    .optional()
);

const optionalText = (max) =>
  z.preprocess(
    emptyToNull,
    z.union([z.null(), z.string().max(max).trim()]).optional()
  );

const precioSchema = z.coerce
  .number()
  .min(0, 'No puede ser negativo')
  .max(999999999.99, 'Precio demasiado alto');

const stockSchema = z.coerce
  .number()
  .min(0, 'No puede ser negativo')
  .max(999999999.999, 'Stock demasiado alto');

const codigoSchema = z.preprocess(
  emptyToNull,
  z
    .union([
      z.null(),
      z
        .string()
        .min(1, 'Mínimo 1 carácter')
        .max(50)
        .trim()
        .regex(/^[a-zA-Z0-9._-]+$/, 'Solo letras, números, . _ -'),
    ])
    .optional()
);

export const createProductSchema = z.object({
  codigo: codigoSchema,
  nombre: z.string().min(2).max(150).trim(),
  descripcion: z.string().max(2000).optional().nullable(),
  imagen_url: optionalUrlSchema,
  color: optionalText(50),
  talle: optionalText(30),
  categoria_id: z.coerce.number().int().positive('Seleccione una categoría'),
  precio_venta: precioSchema,
  precio_costo: precioSchema.optional().default(0),
  stock: stockSchema.optional().default(0),
  stock_minimo: stockSchema.optional().default(0),
  unidad_medida: z.enum(UNIDADES_MEDIDA, {
    errorMap: () => ({ message: 'Unidad de medida no válida' }),
  }),
  estado: z.enum(['activo', 'inactivo']).optional().default('activo'),
});

export const updateProductSchema = z
  .object({
    codigo: codigoSchema,
    nombre: z.string().min(2).max(150).trim().optional(),
    descripcion: z.string().max(2000).optional().nullable(),
    imagen_url: optionalUrlSchema,
    color: optionalText(50),
    talle: optionalText(30),
    categoria_id: z.coerce.number().int().positive().optional(),
    precio_venta: precioSchema.optional(),
    precio_costo: precioSchema.optional(),
    stock: stockSchema.optional(),
    stock_minimo: stockSchema.optional(),
    unidad_medida: z.enum(UNIDADES_MEDIDA).optional(),
    estado: z.enum(['activo', 'inactivo']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const quickSearchProductsSchema = z.object({
  q: z.string().min(1, 'Escriba al menos un carácter').max(100).trim(),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'Mínimo 1 resultado')
    .max(50, 'Máximo 50 resultados')
    .optional()
    .default(20),
});

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'Mínimo 1 por página')
    .max(500, 'Máximo 500 por página')
    .optional()
    .default(10),
  search: z.string().max(100).optional().default(''),
  estado: z.enum(['activo', 'inactivo', 'todos']).optional().default('todos'),
  categoria_id: z.coerce.number().int().positive().optional(),
});
