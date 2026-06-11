import { env } from '../config/env.js';

/** Zona horaria de negocio (Argentina, sin horario de verano). */
export const DB_TIMEZONE = env.DB_TIMEZONE;

export const DATE_FILTER_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const isDateFilter = (value) =>
  typeof value === 'string' && DATE_FILTER_PATTERN.test(value);

/**
 * Alinea la sesión MySQL con la zona del negocio para que DATE(), CURDATE() y NOW()
 * coincidan con el calendario local del sistema (filtros «Hoy», reportes, etc.).
 */
export const configureConnectionTimezone = async (connection) => {
  const conn = typeof connection.promise === 'function' ? connection.promise() : connection;
  await conn.query('SET time_zone = ?', [DB_TIMEZONE]);
};
