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

/** Parches idempotentes para bases ya existentes (deploy en Railway). */
export const applySchemaPatches = async (connection) => {
  await connection.query(`
    UPDATE productos SET codigo = NULL WHERE codigo = '';
    ALTER TABLE productos
      MODIFY COLUMN codigo VARCHAR(50) NULL;
  `);
  log('✓ productos.codigo — opcional (NULL permitido)');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS venta_pagos (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      venta_id INT UNSIGNED NOT NULL,
      metodo_pago VARCHAR(50) NOT NULL,
      monto DECIMAL(12, 2) NOT NULL,
      monto_recibido DECIMAL(12, 2) DEFAULT NULL,
      vuelto DECIMAL(12, 2) DEFAULT NULL,
      orden TINYINT UNSIGNED NOT NULL DEFAULT 1,
      fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_venta_pagos_venta (venta_id),
      KEY idx_venta_pagos_metodo (metodo_pago),
      CONSTRAINT fk_venta_pagos_venta FOREIGN KEY (venta_id) REFERENCES ventas (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await connection.query(`
    INSERT INTO venta_pagos (venta_id, metodo_pago, monto, monto_recibido, vuelto, orden)
    SELECT v.id, v.metodo_pago, v.total, v.monto_recibido, v.vuelto, 1
    FROM ventas v
    WHERE NOT EXISTS (
      SELECT 1 FROM venta_pagos vp WHERE vp.venta_id = v.id
    );
  `);
  log('✓ venta_pagos — pagos divididos y migración de ventas existentes');

  await connection.query(`
    INSERT INTO caja_movimientos (sesion_id, tipo, monto, metodo_pago, descripcion, referencia, venta_id, usuario_id, fecha)
    SELECT v.caja_sesion_id, 'venta', vp.monto, vp.metodo_pago,
           CONCAT('Venta ', v.numero), v.numero, v.id, v.usuario_id, v.fecha_venta
    FROM venta_pagos vp
    INNER JOIN ventas v ON v.id = vp.venta_id
    LEFT JOIN metodos_pago mp ON mp.codigo = vp.metodo_pago
    WHERE v.caja_sesion_id IS NOT NULL
      AND v.estado = 'completada'
      AND COALESCE(mp.genera_cargo_cc, 0) = 0
      AND NOT EXISTS (
        SELECT 1 FROM caja_movimientos m
        WHERE m.venta_id = v.id
          AND m.tipo = 'venta'
          AND m.metodo_pago = vp.metodo_pago
          AND ABS(m.monto - vp.monto) < 0.01
      );
  `);
  log('✓ caja_movimientos — ventas históricas sin movimiento registrado');
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
    await applySchemaPatches(connection);
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
