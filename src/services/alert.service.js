import { pool } from '../config/database.js';
import { PERMISSION_CODES, ROLES } from '../constants/permissions.js';
import { getLowStockReport } from './report.service.js';

const DEFAULT_CASH_OPEN_THRESHOLD_HOURS = Number(process.env.ALERT_CASH_OPEN_HOURS) || 12;

const userCan = (user, ...codes) => {
  if (user.rol === ROLES.ADMIN) return true;
  const perms = user.permisos || [];
  return codes.some((code) => perms.includes(code));
};

export const getSystemAlerts = async (user, options = {}) => {
  const cashOpenThresholdHours =
    Number(options.umbralHoras) || DEFAULT_CASH_OPEN_THRESHOLD_HOURS;
  const alertas = [];

  if (
    userCan(
      user,
      PERMISSION_CODES.REPORTES_VER,
      PERMISSION_CODES.INVENTARIO_VER,
      PERMISSION_CODES.PRODUCTOS_VER
    )
  ) {
    const productos = await getLowStockReport();

    if (productos.length > 0) {
      alertas.push({
        tipo: 'stock_bajo',
        severidad: productos.length >= 5 ? 'alta' : 'media',
        titulo: 'Stock bajo',
        mensaje: `${productos.length} producto(s) en o por debajo del stock mínimo`,
        datos: {
          cantidad: productos.length,
          producto_ids: productos.map((p) => p.id),
          productos: productos.slice(0, 8).map((p) => ({
            id: p.id,
            nombre: p.nombre,
            stock: p.stock,
            stock_minimo: p.stock_minimo,
            unidad_medida: p.unidad_medida,
          })),
        },
      });
    }
  }

  if (userCan(user, PERMISSION_CODES.CAJA_VER, PERMISSION_CODES.CAJA_CERRAR)) {
    const [sesiones] = await pool.execute(
      `SELECT s.id,
              s.usuario_id,
              u.nombre_usuario AS usuario_nombre,
              s.fecha_apertura,
              TIMESTAMPDIFF(HOUR, s.fecha_apertura, NOW()) AS horas_abierta
       FROM caja_sesiones s
       INNER JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.estado = 'abierta'
         AND TIMESTAMPDIFF(HOUR, s.fecha_apertura, NOW()) >= ?
       ORDER BY s.fecha_apertura ASC`,
      [cashOpenThresholdHours]
    );

    if (sesiones.length > 0) {
      const lista = sesiones.map((s) => ({
        id: s.id,
        usuario_id: s.usuario_id,
        usuario_nombre: s.usuario_nombre,
        fecha_apertura: s.fecha_apertura,
        horas_abierta: Number(s.horas_abierta),
      }));

      alertas.push({
        tipo: 'caja_abierta_prolongada',
        severidad: lista.some((s) => s.horas_abierta >= 24) ? 'alta' : 'media',
        titulo: 'Caja abierta demasiado tiempo',
        mensaje: `${lista.length} turno(s) de caja llevan más de ${cashOpenThresholdHours} h abiertos`,
        datos: {
          umbral_horas: cashOpenThresholdHours,
          cantidad: lista.length,
          sesion_ids: lista.map((s) => s.id),
          sesiones: lista,
        },
      });
    }
  }

  return alertas;
};
