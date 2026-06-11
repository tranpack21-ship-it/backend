import { pool } from '../config/database.js';
import { sqlLimitOffset } from '../utils/paginationSql.js';

const mapAudit = (row) => ({
  id: row.id,
  usuario_id: row.usuario_id,
  usuario_nombre: row.usuario_nombre,
  accion: row.accion,
  modulo: row.modulo,
  detalle: row.detalle ? (typeof row.detalle === 'string' ? JSON.parse(row.detalle) : row.detalle) : null,
  ip: row.ip,
  fecha: row.fecha,
});

export const listAudit = async (query) => {
  const { page, limit, modulo, accion, usuario_id, fecha_desde, fecha_hasta } = query;
  const offset = (page - 1) * limit;
  const conditions = ['1=1'];
  const params = [];

  if (modulo && modulo !== 'todos') {
    conditions.push('a.modulo = ?');
    params.push(modulo);
  }
  if (accion) {
    conditions.push('a.accion LIKE ?');
    params.push(`%${accion}%`);
  }
  if (usuario_id) {
    conditions.push('a.usuario_id = ?');
    params.push(usuario_id);
  }
  if (fecha_desde) {
    conditions.push('DATE(a.fecha) >= ?');
    params.push(fecha_desde);
  }
  if (fecha_hasta) {
    conditions.push('DATE(a.fecha) <= ?');
    params.push(fecha_hasta);
  }

  const whereClause = conditions.join(' AND ');

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM auditoria a WHERE ${whereClause}`,
    params
  );
  const total = countRows[0].total;

  const [rows] = await pool.execute(
    `SELECT a.*, u.nombre_usuario AS usuario_nombre
     FROM auditoria a
     LEFT JOIN usuarios u ON u.id = a.usuario_id
     WHERE ${whereClause}
     ORDER BY a.fecha DESC
     ${sqlLimitOffset(limit, offset)}`,
    params
  );

  return {
    data: rows.map(mapAudit),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
};
