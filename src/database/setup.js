/**
 * Instalación completa de la base de datos Tran-Pack.
 *
 * Uso:
 *   npm run db:setup
 *
 * Qué hace:
 *   1. Crea la base de datos si no existe
 *   2. Aplica schema.sql (tablas + datos iniciales)
 *   3. Crea o actualiza el usuario administrador (ADMIN_PASSWORD)
 *
 * Seguro para ejecutar en cada deploy (idempotente).
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { env, getDbSslConfig } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..', '..');
const envFilePath = path.join(backendRoot, '.env');
const log = (msg) => console.log(`[db:setup] ${msg}`);

const connectionOptions = (withDatabase = true) => {
  const ssl = getDbSslConfig();
  const options = {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    multipleStatements: true,
    timezone: env.DB_TIMEZONE,
    ...(ssl ? { ssl } : {}),
  };

  if (withDatabase) {
    options.database = env.DB_NAME;
  }

  return options;
};

const ensureDatabase = async () => {
  const connection = await mysql.createConnection(connectionOptions(false));
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    log(`Base de datos "${env.DB_NAME}" verificada`);
  } finally {
    await connection.end();
  }
};

const applySchema = async (connection) => {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = await fs.readFile(schemaPath, 'utf8');
  await connection.query(sql);
  log('✓ schema.sql — tablas y datos iniciales');
};

const seedAdmin = async (connection) => {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    let envExists = false;
    try {
      await fs.access(envFilePath);
      envExists = true;
    } catch {
      envExists = false;
    }

    if (!envExists) {
      throw new Error(
        'No se encontró backend/.env. Copiá .env.example a .env y definí ADMIN_PASSWORD=tu_contraseña'
      );
    }

    throw new Error(
      'ADMIN_PASSWORD es obligatoria. Agregala en backend/.env (no en .env.example).'
    );
  }

  if (env.isProduction && password.length < 12) {
    throw new Error('ADMIN_PASSWORD debe tener al menos 12 caracteres en producción.');
  }

  const [roles] = await connection.execute(
    'SELECT id FROM roles WHERE nombre = ? LIMIT 1',
    ['admin']
  );

  if (!roles.length) {
    throw new Error('No se encontró el rol admin. Verificá que schema.sql se aplicó correctamente.');
  }

  const hash = await bcrypt.hash(password, 12);
  const [existing] = await connection.execute(
    'SELECT id FROM usuarios WHERE nombre_usuario = ?',
    [username]
  );

  if (existing.length) {
    await connection.execute(
      'UPDATE usuarios SET contrasena = ?, rol_id = ?, estado = ? WHERE nombre_usuario = ?',
      [hash, roles[0].id, 'activo', username]
    );
    log(`✓ Usuario admin "${username}" actualizado`);
  } else {
    await connection.execute(
      'INSERT INTO usuarios (nombre_usuario, contrasena, estado, rol_id) VALUES (?, ?, ?, ?)',
      [username, hash, 'activo', roles[0].id]
    );
    log(`✓ Usuario admin "${username}" creado`);
  }
};

export const setupDatabase = async () => {
  log('Iniciando configuración de base de datos...');
  await ensureDatabase();

  const connection = await mysql.createConnection(connectionOptions(true));
  try {
    await applySchema(connection);
    await seedAdmin(connection);
    log('Configuración completada — base de datos lista.');
  } finally {
    await connection.end();
  }
};

const isMain = process.argv[1]?.includes('setup.js');

if (isMain) {
  setupDatabase().catch((err) => {
    console.error('[db:setup] Error:', err.message);
    process.exit(1);
  });
}
