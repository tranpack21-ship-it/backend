import { pool } from '../config/database.js';

/**
 * Registra una acción en auditoría (no bloquea la operación principal).
 */
export const logAudit = async ({
  usuarioId,
  accion,
  modulo,
  detalle = null,
  ip = null,
}) => {
  try {
    await pool.execute(
      `INSERT INTO auditoria (usuario_id, accion, modulo, detalle, ip)
       VALUES (?, ?, ?, ?, ?)`,
      [
        usuarioId ?? null,
        accion,
        modulo,
        detalle ? JSON.stringify(detalle) : null,
        ip,
      ]
    );
  } catch {
    /* auditoría no debe romper el flujo principal */
  }
};
