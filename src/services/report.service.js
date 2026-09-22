import { pool } from '../config/database.js';
import { sqlLimit } from '../utils/paginationSql.js';

export const getDashboardReport = async ({ fecha_desde, fecha_hasta }) => {
  const params = [];
  let dateFilter = "v.estado = 'completada'";
  if (fecha_desde) {
    dateFilter += ' AND DATE(v.fecha_venta) >= ?';
    params.push(fecha_desde);
  }
  if (fecha_hasta) {
    dateFilter += ' AND DATE(v.fecha_venta) <= ?';
    params.push(fecha_hasta);
  }

  const [ventas] = await pool.execute(
    `SELECT
       COUNT(*) AS cantidad,
       COALESCE(SUM(v.total), 0) AS ingresos,
       COALESCE(AVG(v.total), 0) AS ticket_promedio
     FROM ventas v
     WHERE ${dateFilter}`,
    params
  );

  const [porMetodo] = await pool.execute(
    `SELECT v.metodo_pago,
            COALESCE(mp.nombre, v.metodo_pago) AS metodo_pago_nombre,
            COUNT(*) AS cantidad,
            COALESCE(SUM(v.total), 0) AS total
     FROM ventas v
     LEFT JOIN metodos_pago mp ON mp.codigo = v.metodo_pago
     WHERE ${dateFilter}
     GROUP BY v.metodo_pago, mp.nombre`,
    params
  );

  const anuladasConditions = ["v.estado = 'anulada'"];
  const anuladasParams = [];
  if (fecha_desde) {
    anuladasConditions.push('DATE(v.fecha_venta) >= ?');
    anuladasParams.push(fecha_desde);
  }
  if (fecha_hasta) {
    anuladasConditions.push('DATE(v.fecha_venta) <= ?');
    anuladasParams.push(fecha_hasta);
  }
  const [anuladas] = await pool.execute(
    `SELECT COUNT(*) AS cantidad FROM ventas v WHERE ${anuladasConditions.join(' AND ')}`,
    anuladasParams
  );

  const [stockBajo] = await pool.execute(
    `SELECT COUNT(*) AS cantidad
     FROM productos
     WHERE estado = 'activo' AND stock <= stock_minimo`
  );

  const [clientesActivos] = await pool.execute(
    "SELECT COUNT(*) AS cantidad FROM clientes WHERE estado = 'activo'"
  );

  return {
    ventas: {
      cantidad: Number(ventas[0].cantidad),
      ingresos: Number(ventas[0].ingresos),
      ticket_promedio: Number(ventas[0].ticket_promedio),
      anuladas: Number(anuladas[0]?.cantidad ?? 0),
    },
    por_metodo_pago: porMetodo.map((r) => ({
      metodo_pago: r.metodo_pago,
      metodo_pago_nombre: r.metodo_pago_nombre,
      cantidad: Number(r.cantidad),
      total: Number(r.total),
    })),
    inventario: {
      productos_stock_bajo: Number(stockBajo[0].cantidad),
    },
    clientes_activos: Number(clientesActivos[0].cantidad),
  };
};

export const getSalesByDayReport = async ({ fecha_desde, fecha_hasta }) => {
  const conditions = ["v.estado = 'completada'"];
  const params = [];

  if (fecha_desde) {
    conditions.push('DATE(v.fecha_venta) >= ?');
    params.push(fecha_desde);
  }
  if (fecha_hasta) {
    conditions.push('DATE(v.fecha_venta) <= ?');
    params.push(fecha_hasta);
  }

  const [rows] = await pool.execute(
    `SELECT DATE(v.fecha_venta) AS fecha,
            COUNT(*) AS cantidad,
            COALESCE(SUM(v.total), 0) AS total
     FROM ventas v
     WHERE ${conditions.join(' AND ')}
     GROUP BY DATE(v.fecha_venta)
     ORDER BY fecha ASC`,
    params
  );

  return rows.map((r) => ({
    fecha: r.fecha,
    cantidad: Number(r.cantidad),
    total: Number(r.total),
  }));
};

export const getTopProductsReport = async ({ fecha_desde, fecha_hasta, limit = 10 }) => {
  const conditions = ["v.estado = 'completada'"];
  const params = [];

  if (fecha_desde) {
    conditions.push('DATE(v.fecha_venta) >= ?');
    params.push(fecha_desde);
  }
  if (fecha_hasta) {
    conditions.push('DATE(v.fecha_venta) <= ?');
    params.push(fecha_hasta);
  }

  const [rows] = await pool.execute(
    `SELECT d.producto_id, d.producto_codigo, d.producto_nombre,
            SUM(d.cantidad) AS cantidad_vendida,
            SUM(d.subtotal) AS ingresos
     FROM venta_detalle d
     INNER JOIN ventas v ON v.id = d.venta_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY d.producto_id, d.producto_codigo, d.producto_nombre
     ORDER BY cantidad_vendida DESC
     ${sqlLimit(limit)}`,
    params
  );

  return rows.map((r) => ({
    producto_id: r.producto_id,
    producto_codigo: r.producto_codigo,
    producto_nombre: r.producto_nombre,
    cantidad_vendida: Number(r.cantidad_vendida),
    ingresos: Number(r.ingresos),
  }));
};

export const getLowStockReport = async () => {
  const [rows] = await pool.execute(
    `SELECT p.id, p.codigo, p.nombre, p.stock, p.stock_minimo, p.unidad_medida,
            c.nombre AS categoria_nombre
     FROM productos p
     INNER JOIN categorias c ON c.id = p.categoria_id
     WHERE p.estado = 'activo' AND (p.stock <= p.stock_minimo OR p.stock < 0)
     ORDER BY p.stock ASC
     LIMIT 50`
  );

  return rows.map((r) => ({
    id: r.id,
    codigo: r.codigo,
    nombre: r.nombre,
    stock: Number(r.stock),
    stock_minimo: Number(r.stock_minimo),
    unidad_medida: r.unidad_medida,
    categoria_nombre: r.categoria_nombre,
  }));
};

export const getSalesByUserReport = async ({ fecha_desde, fecha_hasta }) => {
  const conditions = ["v.estado = 'completada'"];
  const params = [];

  if (fecha_desde) {
    conditions.push('DATE(v.fecha_venta) >= ?');
    params.push(fecha_desde);
  }
  if (fecha_hasta) {
    conditions.push('DATE(v.fecha_venta) <= ?');
    params.push(fecha_hasta);
  }

  const [rows] = await pool.execute(
    `SELECT u.id AS usuario_id, u.nombre_usuario,
            COUNT(*) AS cantidad,
            COALESCE(SUM(v.total), 0) AS total
     FROM ventas v
     INNER JOIN usuarios u ON u.id = v.usuario_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY u.id, u.nombre_usuario
     ORDER BY total DESC`,
    params
  );

  return rows.map((r) => ({
    usuario_id: r.usuario_id,
    nombre_usuario: r.nombre_usuario,
    cantidad: Number(r.cantidad),
    total: Number(r.total),
  }));
};

const buildCashDateFilter = (fecha_desde, fecha_hasta, alias = 'm') => {
  const conditions = [];
  const params = [];
  if (fecha_desde) {
    conditions.push(`DATE(${alias}.fecha) >= ?`);
    params.push(fecha_desde);
  }
  if (fecha_hasta) {
    conditions.push(`DATE(${alias}.fecha) <= ?`);
    params.push(fecha_hasta);
  }
  return { conditions, params };
};

/** Egresos de caja del período (gastos operativos registrados) */
export const getExpensesReport = async ({ fecha_desde, fecha_hasta, descripcion }) => {
  const { conditions, params } = buildCashDateFilter(fecha_desde, fecha_hasta);
  const whereParts = ["m.tipo = 'egreso'", ...conditions];

  const descFilter = typeof descripcion === 'string' ? descripcion.trim() : '';
  if (descFilter) {
    // Coincide exacto o con detalle opcional: "Sueldos — nota"
    whereParts.push('(m.descripcion = ? OR m.descripcion LIKE ?)');
    params.push(descFilter, `${descFilter} — %`);
  }

  const whereClause = whereParts.join(' AND ');

  const [summaryRows] = await pool.execute(
    `SELECT COUNT(*) AS cantidad, COALESCE(SUM(m.monto), 0) AS total
     FROM caja_movimientos m
     WHERE ${whereClause}`,
    params
  );

  const [byDay] = await pool.execute(
    `SELECT DATE(m.fecha) AS fecha,
            COUNT(*) AS cantidad,
            COALESCE(SUM(m.monto), 0) AS total
     FROM caja_movimientos m
     WHERE ${whereClause}
     GROUP BY DATE(m.fecha)
     ORDER BY fecha ASC`,
    params
  );

  const [byMethod] = await pool.execute(
    `SELECT COALESCE(m.metodo_pago, 'efectivo') AS metodo_pago,
            COALESCE(mp.nombre, m.metodo_pago, 'Efectivo') AS metodo_pago_nombre,
            COUNT(*) AS cantidad,
            COALESCE(SUM(m.monto), 0) AS total
     FROM caja_movimientos m
     LEFT JOIN metodos_pago mp ON mp.codigo = m.metodo_pago
     WHERE ${whereClause}
     GROUP BY m.metodo_pago, mp.nombre
     ORDER BY total DESC`,
    params
  );

  const [byDesc] = await pool.execute(
    `SELECT COALESCE(
              NULLIF(TRIM(SUBSTRING_INDEX(COALESCE(m.descripcion, ''), ' — ', 1)), ''),
              'Sin descripción'
            ) AS descripcion,
            COUNT(*) AS cantidad,
            COALESCE(SUM(m.monto), 0) AS total
     FROM caja_movimientos m
     WHERE ${whereClause}
     GROUP BY COALESCE(
              NULLIF(TRIM(SUBSTRING_INDEX(COALESCE(m.descripcion, ''), ' — ', 1)), ''),
              'Sin descripción'
            )
     ORDER BY total DESC`,
    params
  );

  const [detail] = await pool.execute(
    `SELECT m.id, m.fecha, m.monto, m.descripcion,
            COALESCE(m.metodo_pago, 'efectivo') AS metodo_pago,
            COALESCE(mp.nombre, m.metodo_pago, 'Efectivo') AS metodo_pago_nombre,
            u.nombre_usuario AS usuario_nombre,
            s.id AS sesion_id
     FROM caja_movimientos m
     LEFT JOIN metodos_pago mp ON mp.codigo = m.metodo_pago
     INNER JOIN usuarios u ON u.id = m.usuario_id
     LEFT JOIN caja_sesiones s ON s.id = m.sesion_id
     WHERE ${whereClause}
     ORDER BY m.fecha DESC, m.id DESC
     LIMIT 100`,
    params
  );

  const total = Number(summaryRows[0].total);
  const cantidad = Number(summaryRows[0].cantidad);

  return {
    resumen: {
      cantidad,
      total,
      promedio: cantidad > 0 ? total / cantidad : 0,
      filtro_descripcion: descFilter || null,
    },
    por_dia: byDay.map((r) => ({
      fecha: r.fecha,
      cantidad: Number(r.cantidad),
      total: Number(r.total),
    })),
    por_metodo: byMethod.map((r) => ({
      metodo_pago: r.metodo_pago,
      metodo_pago_nombre: r.metodo_pago_nombre,
      cantidad: Number(r.cantidad),
      total: Number(r.total),
    })),
    por_descripcion: byDesc.map((r) => ({
      descripcion: r.descripcion,
      cantidad: Number(r.cantidad),
      total: Number(r.total),
    })),
    detalle: detail.map((r) => ({
      id: r.id,
      fecha: r.fecha,
      monto: Number(r.monto),
      descripcion: r.descripcion || 'Egreso de caja',
      metodo_pago: r.metodo_pago,
      metodo_pago_nombre: r.metodo_pago_nombre,
      usuario_nombre: r.usuario_nombre,
      sesion_id: r.sesion_id,
    })),
  };
};

/**
 * Resultado estimado del período:
 * Ingresos por ventas − costo de mercadería (aprox.) − egresos de caja
 */
export const getResultadoReport = async ({ fecha_desde, fecha_hasta }) => {
  const saleConditions = ["v.estado = 'completada'"];
  const saleParams = [];
  if (fecha_desde) {
    saleConditions.push('DATE(v.fecha_venta) >= ?');
    saleParams.push(fecha_desde);
  }
  if (fecha_hasta) {
    saleConditions.push('DATE(v.fecha_venta) <= ?');
    saleParams.push(fecha_hasta);
  }
  const saleWhere = saleConditions.join(' AND ');

  const [ventasRows] = await pool.execute(
    `SELECT COUNT(*) AS cantidad_ventas,
            COALESCE(SUM(v.total), 0) AS ingresos
     FROM ventas v
     WHERE ${saleWhere}`,
    saleParams
  );

  const [cogsRows] = await pool.execute(
    `SELECT COALESCE(SUM(d.cantidad_inventario * p.precio_costo), 0) AS costo_mercaderia,
            COALESCE(SUM(CASE WHEN p.precio_costo > 0 THEN d.subtotal ELSE 0 END), 0) AS ingresos_con_costo,
            COUNT(DISTINCT CASE WHEN p.precio_costo IS NULL OR p.precio_costo <= 0 THEN d.producto_id END) AS productos_sin_costo
     FROM venta_detalle d
     INNER JOIN ventas v ON v.id = d.venta_id
     INNER JOIN productos p ON p.id = d.producto_id
     WHERE ${saleWhere}`,
    saleParams
  );

  const { conditions: egresoConds, params: egresoParams } = buildCashDateFilter(
    fecha_desde,
    fecha_hasta
  );
  const egresoWhere = ["m.tipo = 'egreso'", ...egresoConds].join(' AND ');

  const [egresoRows] = await pool.execute(
    `SELECT COUNT(*) AS cantidad, COALESCE(SUM(m.monto), 0) AS total
     FROM caja_movimientos m
     WHERE ${egresoWhere}`,
    egresoParams
  );

  const { conditions: ingresoConds, params: ingresoParams } = buildCashDateFilter(
    fecha_desde,
    fecha_hasta
  );
  const ingresoWhere = ["m.tipo = 'ingreso'", ...ingresoConds].join(' AND ');

  const [ingresoCajaRows] = await pool.execute(
    `SELECT COUNT(*) AS cantidad, COALESCE(SUM(m.monto), 0) AS total
     FROM caja_movimientos m
     WHERE ${ingresoWhere}`,
    ingresoParams
  );

  const ingresos_ventas = Number(ventasRows[0].ingresos);
  const cantidad_ventas = Number(ventasRows[0].cantidad_ventas);
  const costo_mercaderia = Number(cogsRows[0].costo_mercaderia);
  const egresos_caja = Number(egresoRows[0].total);
  const ingresos_caja_manuales = Number(ingresoCajaRows[0].total);
  const cantidad_egresos = Number(egresoRows[0].cantidad);
  const productos_sin_costo = Number(cogsRows[0].productos_sin_costo);

  const margen_bruto = ingresos_ventas - costo_mercaderia;
  const resultado_neto = margen_bruto - egresos_caja + ingresos_caja_manuales;
  const margen_bruto_pct =
    ingresos_ventas > 0 ? Math.round((margen_bruto / ingresos_ventas) * 1000) / 10 : 0;
  const resultado_pct =
    ingresos_ventas > 0 ? Math.round((resultado_neto / ingresos_ventas) * 1000) / 10 : 0;

  return {
    ingresos_ventas,
    cantidad_ventas,
    costo_mercaderia,
    margen_bruto,
    margen_bruto_pct,
    egresos_caja,
    cantidad_egresos,
    ingresos_caja_manuales,
    resultado_neto,
    resultado_pct,
    productos_sin_costo,
    costo_aproximado: true,
    desglose: [
      { concepto: 'Ingresos por ventas', monto: ingresos_ventas, tipo: 'ingreso' },
      { concepto: 'Costo de mercadería (estimado)', monto: -costo_mercaderia, tipo: 'costo' },
      { concepto: 'Margen bruto', monto: margen_bruto, tipo: 'subtotal' },
      { concepto: 'Egresos de caja', monto: -egresos_caja, tipo: 'egreso' },
      {
        concepto: 'Ingresos manuales de caja',
        monto: ingresos_caja_manuales,
        tipo: 'ingreso_caja',
      },
      { concepto: 'Resultado neto estimado', monto: resultado_neto, tipo: 'resultado' },
    ],
  };
};

/** Nombre canónico alineado entre caja_conceptos e inventario_motivos */
export const CONCEPTO_COMPRA_MERCADERIA = 'Compra de mercadería';

/**
 * Conciliación: egresos de caja por compra de mercadería vs
 * valor de entradas de inventario con el mismo motivo (cantidad × precio_costo).
 */
export const getComprasMercaderiaReport = async ({
  fecha_desde,
  fecha_hasta,
  concepto = CONCEPTO_COMPRA_MERCADERIA,
}) => {
  const conceptoNombre =
    typeof concepto === 'string' && concepto.trim()
      ? concepto.trim()
      : CONCEPTO_COMPRA_MERCADERIA;

  const { conditions: cashConds, params: cashParams } = buildCashDateFilter(
    fecha_desde,
    fecha_hasta
  );
  const cashWhere = [
    "m.tipo = 'egreso'",
    '(m.descripcion = ? OR m.descripcion LIKE ?)',
    ...cashConds,
  ].join(' AND ');
  const cashQueryParams = [conceptoNombre, `${conceptoNombre} — %`, ...cashParams];

  const [egresoSummary] = await pool.execute(
    `SELECT COUNT(*) AS cantidad, COALESCE(SUM(m.monto), 0) AS total
     FROM caja_movimientos m
     WHERE ${cashWhere}`,
    cashQueryParams
  );

  const [egresoDetalle] = await pool.execute(
    `SELECT m.id, m.fecha, m.monto, m.descripcion,
            COALESCE(mp.nombre, m.metodo_pago, 'Efectivo') AS metodo_pago_nombre,
            u.nombre_usuario AS usuario_nombre
     FROM caja_movimientos m
     LEFT JOIN metodos_pago mp ON mp.codigo = m.metodo_pago
     INNER JOIN usuarios u ON u.id = m.usuario_id
     WHERE ${cashWhere}
     ORDER BY m.fecha DESC, m.id DESC
     LIMIT 100`,
    cashQueryParams
  );

  // Entradas directas + ajustes que aumentaron stock (mismo motivo canónico)
  const invConds = [
    `(
       m.tipo = 'entrada'
       OR (m.tipo = 'ajuste' AND m.stock_posterior > m.stock_anterior)
     )`,
    '(m.motivo = ? OR m.motivo LIKE ?)',
  ];
  const invParams = [conceptoNombre, `${conceptoNombre} — %`];
  if (fecha_desde) {
    invConds.push('DATE(m.fecha) >= ?');
    invParams.push(fecha_desde);
  }
  if (fecha_hasta) {
    invConds.push('DATE(m.fecha) <= ?');
    invParams.push(fecha_hasta);
  }
  const invWhere = invConds.join(' AND ');

  // Unidades/valor: en entrada = cantidad; en ajuste alcista = stock_posterior - stock_anterior
  const unidadesExpr = `CASE
    WHEN m.tipo = 'ajuste' THEN (m.stock_posterior - m.stock_anterior)
    ELSE m.cantidad
  END`;

  const [entradaSummary] = await pool.execute(
    `SELECT COUNT(*) AS cantidad,
            COALESCE(SUM(${unidadesExpr}), 0) AS unidades,
            COALESCE(SUM((${unidadesExpr}) * COALESCE(p.precio_costo, 0)), 0) AS valor_costo,
            COUNT(DISTINCT CASE
              WHEN p.precio_costo IS NULL OR p.precio_costo <= 0 THEN p.id
            END) AS productos_sin_costo
     FROM movimientos_inventario m
     INNER JOIN productos p ON p.id = m.producto_id
     WHERE ${invWhere}`,
    invParams
  );

  const [entradaDetalle] = await pool.execute(
    `SELECT m.id, m.fecha, m.tipo, m.cantidad, m.motivo,
            m.stock_anterior, m.stock_posterior,
            (${unidadesExpr}) AS unidades,
            p.id AS producto_id,
            p.nombre AS producto_nombre,
            p.codigo AS producto_codigo,
            p.unidad_medida,
            COALESCE(p.precio_costo, 0) AS precio_costo,
            ((${unidadesExpr}) * COALESCE(p.precio_costo, 0)) AS valor_costo,
            u.nombre_usuario AS usuario_nombre
     FROM movimientos_inventario m
     INNER JOIN productos p ON p.id = m.producto_id
     LEFT JOIN usuarios u ON u.id = m.usuario_id
     WHERE ${invWhere}
     ORDER BY m.fecha DESC, m.id DESC
     LIMIT 100`,
    invParams
  );

  const [porDiaEgresos] = await pool.execute(
    `SELECT DATE(m.fecha) AS fecha,
            COUNT(*) AS cantidad,
            COALESCE(SUM(m.monto), 0) AS total
     FROM caja_movimientos m
     WHERE ${cashWhere}
     GROUP BY DATE(m.fecha)
     ORDER BY fecha ASC`,
    cashQueryParams
  );

  const [porDiaEntradas] = await pool.execute(
    `SELECT DATE(m.fecha) AS fecha,
            COUNT(*) AS cantidad,
            COALESCE(SUM((${unidadesExpr}) * COALESCE(p.precio_costo, 0)), 0) AS total
     FROM movimientos_inventario m
     INNER JOIN productos p ON p.id = m.producto_id
     WHERE ${invWhere}
     GROUP BY DATE(m.fecha)
     ORDER BY fecha ASC`,
    invParams
  );

  const egresos_caja = Number(egresoSummary[0].total);
  const cantidad_egresos = Number(egresoSummary[0].cantidad);
  const valor_entradas = Number(entradaSummary[0].valor_costo);
  const cantidad_entradas = Number(entradaSummary[0].cantidad);
  const unidades_entradas = Number(entradaSummary[0].unidades);
  const productos_sin_costo = Number(entradaSummary[0].productos_sin_costo);
  const diferencia = egresos_caja - valor_entradas;
  const coinciden = Math.abs(diferencia) < 0.01;

  return {
    concepto: conceptoNombre,
    egresos_caja,
    cantidad_egresos,
    valor_entradas,
    cantidad_entradas,
    unidades_entradas,
    diferencia,
    coinciden,
    productos_sin_costo,
    costo_aproximado: true,
    detalle_egresos: egresoDetalle.map((r) => ({
      id: r.id,
      fecha: r.fecha,
      monto: Number(r.monto),
      descripcion: r.descripcion,
      metodo_pago_nombre: r.metodo_pago_nombre,
      usuario_nombre: r.usuario_nombre,
    })),
    detalle_entradas: entradaDetalle.map((r) => ({
      id: r.id,
      fecha: r.fecha,
      tipo: r.tipo,
      cantidad: Number(r.unidades ?? r.cantidad),
      motivo: r.motivo,
      producto_id: r.producto_id,
      producto_nombre: r.producto_nombre,
      producto_codigo: r.producto_codigo,
      unidad_medida: r.unidad_medida || 'uds',
      precio_costo: Number(r.precio_costo),
      valor_costo: Number(r.valor_costo),
      usuario_nombre: r.usuario_nombre,
    })),
    por_dia_egresos: porDiaEgresos.map((r) => ({
      fecha: r.fecha,
      cantidad: Number(r.cantidad),
      total: Number(r.total),
    })),
    por_dia_entradas: porDiaEntradas.map((r) => ({
      fecha: r.fecha,
      cantidad: Number(r.cantidad),
      total: Number(r.total),
    })),
  };
};

