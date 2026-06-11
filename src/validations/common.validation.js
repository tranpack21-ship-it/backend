import { z } from 'zod';

const emptyToUndefined = (val) =>
  val === '' || val === undefined || val === null ? undefined : val;

const dateFilterString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)');

export const optionalDateFilter = z.preprocess(
  emptyToUndefined,
  dateFilterString.optional()
);

export const withDateRangeRefine = (schema) =>
  schema.refine(
    (data) =>
      !data.fecha_desde ||
      !data.fecha_hasta ||
      data.fecha_desde <= data.fecha_hasta,
    { message: 'fecha_desde no puede ser posterior a fecha_hasta', path: ['fecha_hasta'] }
  );
