import mysql from 'mysql2/promise';
import { env, getDbSslConfig } from '../../src/config/env.js';

export const createDbConnection = async () => {
  const ssl = getDbSslConfig();
  return mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    multipleStatements: true,
    timezone: env.DB_TIMEZONE,
    ...(ssl ? { ssl } : {}),
  });
};
