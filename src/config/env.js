import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(backendRoot, '.env') });

const DEV_JWT_FALLBACK = 'dev_secret_change_in_production';

const isLocalDbHost = (host) =>
  !host || host === 'localhost' || host === '127.0.0.1' || host === '::1';

const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  return value === 'true' || value === '1';
};

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const dbHost = process.env.DB_HOST || process.env.MYSQLHOST || 'localhost';
const dbPort = Number(process.env.DB_PORT || process.env.MYSQLPORT) || 3306;
const dbUser = process.env.DB_USER || process.env.MYSQLUSER || 'root';
const dbPassword = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '';
const dbName = process.env.DB_NAME || process.env.MYSQLDATABASE || 'tran_pack';

/** SSL: explícito con DB_SSL o automático en producción con host remoto (Railway). */
const dbSslExplicit = process.env.DB_SSL;
const dbSsl =
  dbSslExplicit !== undefined
    ? parseBoolean(dbSslExplicit)
    : isProduction && !isLocalDbHost(dbHost);

const corsOriginRaw =
  process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || 'http://localhost:5173';

const corsOrigins = corsOriginRaw
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const jwtSecret = process.env.JWT_SECRET || (isProduction ? '' : DEV_JWT_FALLBACK);

export const env = {
  NODE_ENV: nodeEnv,
  isProduction,
  PORT: Number(process.env.PORT) || 3000,
  DB_HOST: dbHost,
  DB_PORT: dbPort,
  DB_USER: dbUser,
  DB_PASSWORD: dbPassword,
  DB_NAME: dbName,
  DB_TIMEZONE: process.env.DB_TIMEZONE || '-03:00',
  DB_SSL: dbSsl,
  DB_SSL_REJECT_UNAUTHORIZED: parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, false),
  DB_SSL_CA: process.env.DB_SSL_CA || null,
  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  CORS_ORIGIN: corsOriginRaw,
  corsOrigins,
  RATE_LIMIT_ENABLED:
    process.env.RATE_LIMIT_ENABLED === 'true'
      ? true
      : process.env.RATE_LIMIT_ENABLED === 'false'
        ? false
        : isProduction,
  RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX) || 500,
  AUTH_RATE_LIMIT_WINDOW_MS:
    Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 900000,
  AUTH_RATE_LIMIT_MAX: Number(process.env.AUTH_RATE_LIMIT_MAX) || 30,
  /** Directorio de backups (relativo a backend/ o ruta absoluta) */
  BACKUP_DIR: process.env.BACKUP_DIR || 'backups',
  /** Días de retención — 0 desactiva limpieza por antigüedad */
  BACKUP_RETENTION_DAYS: Number(process.env.BACKUP_RETENTION_DAYS) || 30,
  /** Máximo de backups a conservar — 0 desactiva límite por cantidad */
  BACKUP_MAX_COUNT: Number(process.env.BACKUP_MAX_COUNT) || 50,
  BACKUP_COMPRESS: parseBoolean(process.env.BACKUP_COMPRESS, true),
  /** Intenta mysqldump si está en PATH; si no, exporta con Node.js */
  BACKUP_USE_MYSQLDUMP: parseBoolean(process.env.BACKUP_USE_MYSQLDUMP, true),
};

const INSECURE_JWT_VALUES = new Set([
  DEV_JWT_FALLBACK,
  'cambia_este_secreto_por_uno_largo_y_aleatorio_min_32_chars',
  'dev_secret',
  'secret',
  'jwt_secret',
]);

/**
 * Falla al arrancar si la configuración de producción es insegura o incompleta.
 * En desarrollo solo advierte por variables recomendadas.
 */
export const validateEnv = () => {
  const errors = [];
  const warnings = [];

  if (isProduction) {
    if (!process.env.JWT_SECRET) {
      errors.push('JWT_SECRET es obligatorio en producción.');
    } else if (process.env.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET debe tener al menos 32 caracteres en producción.');
    } else if (INSECURE_JWT_VALUES.has(process.env.JWT_SECRET)) {
      errors.push('JWT_SECRET no puede ser un valor por defecto o predecible.');
    }

    if (!process.env.CORS_ORIGIN && !process.env.CORS_ORIGINS) {
      errors.push('CORS_ORIGIN es obligatorio en producción (URL del frontend en Vercel).');
    } else if (corsOrigins.some((o) => o.includes('localhost'))) {
      warnings.push(
        'CORS_ORIGIN incluye localhost en producción. Usá solo el dominio de Vercel.'
      );
    }

    if (!dbPassword) {
      errors.push('DB_PASSWORD es obligatorio en producción.');
    }

    if (!dbHost || dbHost === 'localhost') {
      warnings.push('DB_HOST parece local en producción. Verificá las variables de Railway MySQL.');
    }
  } else {
    const recommended = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_NAME'];
    for (const key of recommended) {
      if (!process.env[key]) {
        warnings.push(`Variable recomendada no definida: ${key}`);
      }
    }
  }

  for (const warning of warnings) {
    console.warn(`[env] ${warning}`);
  }

  if (errors.length > 0) {
    console.error('[env] Configuración inválida — el servidor no puede iniciar en producción:\n');
    for (const error of errors) {
      console.error(`  ✗ ${error}`);
    }
    console.error('\nRevisá backend/.env.example y backend/DEPLOY.md\n');
    process.exit(1);
  }
};

/** Opciones SSL para mysql2 (Railway y otros hosts remotos). */
export const getDbSslConfig = () => {
  if (!env.DB_SSL) return undefined;

  const ssl = {
    rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED,
  };

  if (env.DB_SSL_CA) {
    ssl.ca = env.DB_SSL_CA.replace(/\\n/g, '\n');
  }

  return ssl;
};
