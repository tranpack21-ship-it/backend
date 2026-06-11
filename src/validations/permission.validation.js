import { z } from 'zod';

export const assignPermissionsSchema = z.object({
  permiso_ids: z.array(z.coerce.number().int().positive()).default([]),
});
