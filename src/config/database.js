import mysql from 'mysql2/promise';
import { env, getDbSslConfig } from './env.js';
import { configureConnectionTimezone } from '../utils/datetime.js';

const ssl = getDbSslConfig();

export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  timezone: env.DB_TIMEZONE,
  ...(ssl ? { ssl } : {}),
});

pool.on('connection', (connection) => {
  configureConnectionTimezone(connection).catch((err) => {
    console.error('[DB] No se pudo configurar time_zone:', err.message);
  });
});

export const testConnection = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
    await connection.execute('SELECT 1 AS ok');
    const sslLabel = env.DB_SSL ? ' (SSL activo)' : '';
    console.log(`[DB] Conexión MySQL establecida correctamente${sslLabel}`);
  } finally {
    connection.release();
  }
};
