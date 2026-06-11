import { z } from 'zod';

const DEFAULT_UMBRAL = Number(process.env.ALERT_CASH_OPEN_HOURS) || 12;

export const alertQuerySchema = z.object({
  umbral_horas: z.coerce
    .number()
    .int()
    .min(4)
    .max(72)
    .optional()
    .default(DEFAULT_UMBRAL),
});
