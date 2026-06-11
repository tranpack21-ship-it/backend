import { pool } from '../config/database.js';
import { env } from '../config/env.js';

export const checkDatabaseHealth = async () => {
  const started = Date.now();

  try {
    const connection = await pool.getConnection();
    try {
      await connection.ping();
      await connection.execute('SELECT 1 AS ok');
    } finally {
      connection.release();
    }

    return {
      connected: true,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      connected: false,
      latencyMs: Date.now() - started,
      error: error.message,
    };
  }
};

export const getHealthPayload = async () => {
  const database = await checkDatabaseHealth();
  const healthy = database.connected;

  return {
    success: healthy,
    status: healthy ? 'healthy' : 'unhealthy',
    service: 'tran-pack-api',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    checks: {
      database,
    },
  };
};
