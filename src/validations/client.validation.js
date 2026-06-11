import { z } from 'zod';
import { TIPOS_DOCUMENTO_CLIENTE } from '../constants/permissions.js';

export const createClientSchema = z.object({
  tipo_documento: z.enum(TIPOS_DOCUMENTO_CLIENTE),
  numero_documento: z.string().max(20).optional().nullable(),
  nombre: z.string().min(2).max(150).trim(),
  email: z.string().email('Email inválido').max(120).optional().nullable().or(z.literal('')),
  telefono: z.string().max(30).optional().nullable(),
  direccion: z.string().max(255).optional().nullable(),
  estado: z.enum(['activo', 'inactivo']).optional().default('activo'),
  limite_credito: z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z.union([z.null(), z.coerce.number().min(0)]).optional()
  ),
});

export const updateClientSchema = z
  .object({
    tipo_documento: z.enum(TIPOS_DOCUMENTO_CLIENTE).optional(),
    numero_documento: z.string().max(20).optional().nullable(),
    nombre: z.string().min(2).max(150).trim().optional(),
    email: z.string().email().max(120).optional().nullable().or(z.literal('')),
    telefono: z.string().max(30).optional().nullable(),
    direccion: z.string().max(255).optional().nullable(),
    estado: z.enum(['activo', 'inactivo']).optional(),
    limite_credito: z.preprocess(
      (v) => (v === '' || v === undefined ? null : v),
      z.union([z.null(), z.coerce.number().min(0)]).optional()
    ),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const listClientsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  search: z.string().max(100).optional().default(''),
  estado: z.enum(['activo', 'inactivo', 'todos']).optional().default('todos'),
});
