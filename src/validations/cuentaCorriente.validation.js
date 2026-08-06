import { z } from 'zod';

const optionalSaldo = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce.number().min(0).optional()
);

export const listAccountsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
    search: z.string().max(100).optional().default(''),
    solo_deuda: z.preprocess(
      (v) => v === true || v === 'true' || v === '1' || v === 1,
      z.boolean().optional().default(false)
    ),
    saldo_min: optionalSaldo,
    saldo_max: optionalSaldo,
  })
  .refine(
    (data) => {
      if (data.saldo_min == null || data.saldo_max == null) return true;
      return data.saldo_min <= data.saldo_max;
    },
    { message: 'El saldo mínimo no puede ser mayor al saldo máximo', path: ['saldo_min'] }
  );

export const listMovementsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const cobroLineSchema = z.object({
  metodo_cobro: z.string().min(1).max(50).trim(),
  monto: z.coerce.number().positive('Cada monto debe ser mayor a 0'),
});

export const registerPaymentSchema = z
  .object({
    monto: z.coerce.number().positive('El monto debe ser mayor a 0').optional(),
    observaciones: z.string().max(500).optional().nullable(),
    metodo_cobro: z.string().min(1).max(50).trim().optional(),
    pagos: z.array(cobroLineSchema).min(1).max(2).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.pagos?.length) {
      const sum = data.pagos.reduce((acc, p) => acc + Number(p.monto), 0);
      if (sum <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'La suma de los pagos debe ser mayor a 0',
          path: ['pagos'],
        });
      }
      if (data.monto != null && Math.abs(Number(data.monto) - sum) > 0.01) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'El monto total no coincide con la suma de los métodos',
          path: ['monto'],
        });
      }
      return;
    }

    if (data.monto == null || Number(data.monto) <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El monto debe ser mayor a 0',
        path: ['monto'],
      });
    }
  });

export const registerAdjustmentSchema = z.object({
  monto: z.coerce.number().positive('El monto debe ser mayor a 0'),
  tipo_ajuste: z.enum(['aumentar', 'disminuir']),
  observaciones: z.string().max(500).optional().nullable(),
});
