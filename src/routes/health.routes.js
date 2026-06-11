import { Router } from 'express';
import { getHealthPayload } from '../utils/health.js';

const router = Router();

router.get('/', async (_req, res) => {
  const payload = await getHealthPayload();
  const statusCode = payload.success ? 200 : 503;
  res.status(statusCode).json(payload);
});

export default router;
