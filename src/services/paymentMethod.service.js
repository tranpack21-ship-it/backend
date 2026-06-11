import { pool } from '../config/database.js';
import { AppError } from '../utils/AppError.js';

const mapMethod = (row) => ({
  id: row.id,
  codigo: row.codigo,
  nombre: row.nombre,
  descripcion: row.descripcion,
  requiere_cliente: Boolean(row.requiere_cliente),
  requiere_monto_recibido: Boolean(row.requiere_monto_recibido),
  registra_en_caja: Boolean(row.registra_en_caja),
  genera_cargo_cc: Boolean(row.genera_cargo_cc),
  es_predeterminado: Boolean(row.es_predeterminado),
  orden: Number(row.orden),
  estado: row.estado,
  fecha_creacion: row.fecha_creacion,
  fecha_actualizacion: row.fecha_actualizacion,
});

const normalizeCodigo = (codigo) =>
  String(codigo)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

export const listPaymentMethods = async ({ activos, estado } = {}) => {
  const conditions = ['1=1'];
  const params = [];

  if (activos === true || activos === 'true' || estado === 'activo') {
    conditions.push("estado = 'activo'");
  } else if (estado && estado !== 'todos') {
    conditions.push('estado = ?');
    params.push(estado);
  }

  const [rows] = await pool.execute(
    `SELECT * FROM metodos_pago
     WHERE ${conditions.join(' AND ')}
     ORDER BY orden ASC, nombre ASC`,
    params
  );

  return rows.map(mapMethod);
};

export const getPaymentMethodById = async (id) => {
  const [rows] = await pool.execute('SELECT * FROM metodos_pago WHERE id = ? LIMIT 1', [
    id,
  ]);
  if (!rows.length) throw new AppError('Método de pago no encontrado', 404);
  return mapMethod(rows[0]);
};

export const getActivePaymentMethodByCode = async (codigo, connection = null) => {
  const conn = connection || pool;
  const code = normalizeCodigo(codigo);
  const [rows] = await conn.execute(
    `SELECT * FROM metodos_pago WHERE codigo = ? AND estado = 'activo' LIMIT 1`,
    [code]
  );
  if (!rows.length) {
    throw new AppError('Método de pago no válido o inactivo', 400);
  }
  return mapMethod(rows[0]);
};

export const getDefaultPaymentMethod = async (connection = null) => {
  const conn = connection || pool;
  const [rows] = await conn.execute(
    `SELECT * FROM metodos_pago
     WHERE estado = 'activo'
     ORDER BY es_predeterminado DESC, orden ASC, id ASC
     LIMIT 1`
  );
  if (!rows.length) {
    throw new AppError('No hay métodos de pago activos configurados', 400);
  }
  return mapMethod(rows[0]);
};

export const resolvePaymentMethodForSale = async (codigo, connection = null) => {
  if (codigo) {
    return getActivePaymentMethodByCode(codigo, connection);
  }
  return getDefaultPaymentMethod(connection);
};

export const createPaymentMethod = async (data) => {
  const codigo = normalizeCodigo(data.codigo);
  if (!codigo || codigo.length < 2) {
    throw new AppError('El código debe tener al menos 2 caracteres válidos', 400);
  }

  const [dup] = await pool.execute(
    'SELECT id FROM metodos_pago WHERE codigo = ? LIMIT 1',
    [codigo]
  );
  if (dup.length) throw new AppError('Ya existe un método con ese código', 409);

  const [result] = await pool.execute(
    `INSERT INTO metodos_pago (
      codigo, nombre, descripcion,
      requiere_cliente, requiere_monto_recibido, registra_en_caja, genera_cargo_cc,
      es_predeterminado, orden, estado
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      codigo,
      data.nombre.trim(),
      data.descripcion?.trim() || null,
      data.requiere_cliente ? 1 : 0,
      data.requiere_monto_recibido ? 1 : 0,
      data.registra_en_caja ? 1 : 0,
      data.genera_cargo_cc ? 1 : 0,
      data.es_predeterminado ? 1 : 0,
      data.orden ?? 0,
      data.estado ?? 'activo',
    ]
  );

  if (data.es_predeterminado) {
    await pool.execute(
      'UPDATE metodos_pago SET es_predeterminado = 0 WHERE id != ?',
      [result.insertId]
    );
  }

  return getPaymentMethodById(result.insertId);
};

export const updatePaymentMethod = async (id, data) => {
  const current = await getPaymentMethodById(id);

  const updates = [];
  const params = [];

  if (data.nombre !== undefined) {
    updates.push('nombre = ?');
    params.push(data.nombre.trim());
  }
  if (data.descripcion !== undefined) {
    updates.push('descripcion = ?');
    params.push(data.descripcion?.trim() || null);
  }
  if (data.requiere_cliente !== undefined) {
    updates.push('requiere_cliente = ?');
    params.push(data.requiere_cliente ? 1 : 0);
  }
  if (data.requiere_monto_recibido !== undefined) {
    updates.push('requiere_monto_recibido = ?');
    params.push(data.requiere_monto_recibido ? 1 : 0);
  }
  if (data.registra_en_caja !== undefined) {
    updates.push('registra_en_caja = ?');
    params.push(data.registra_en_caja ? 1 : 0);
  }
  if (data.genera_cargo_cc !== undefined) {
    updates.push('genera_cargo_cc = ?');
    params.push(data.genera_cargo_cc ? 1 : 0);
  }
  if (data.orden !== undefined) {
    updates.push('orden = ?');
    params.push(data.orden);
  }
  if (data.estado !== undefined) {
    if (data.estado === 'inactivo' && current.es_predeterminado) {
      throw new AppError(
        'No puede desactivar el método predeterminado. Asigne otro como predeterminado primero.',
        400
      );
    }
    updates.push('estado = ?');
    params.push(data.estado);
  }

  if (!updates.length && data.es_predeterminado === undefined) {
    return current;
  }

  if (updates.length) {
    params.push(id);
    await pool.execute(
      `UPDATE metodos_pago SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
  }

  if (data.es_predeterminado) {
    await pool.execute('UPDATE metodos_pago SET es_predeterminado = 0');
    await pool.execute(
      "UPDATE metodos_pago SET es_predeterminado = 1, estado = 'activo' WHERE id = ?",
      [id]
    );
  }

  return getPaymentMethodById(id);
};

export const deactivatePaymentMethod = async (id) => {
  const method = await getPaymentMethodById(id);

  if (method.es_predeterminado) {
    throw new AppError(
      'No puede desactivar el método predeterminado. Elija otro método como predeterminado.',
      400
    );
  }

  const [used] = await pool.execute(
    'SELECT COUNT(*) AS total FROM ventas WHERE metodo_pago = ? LIMIT 1',
    [method.codigo]
  );
  if (Number(used[0].total) > 0) {
    await pool.execute("UPDATE metodos_pago SET estado = 'inactivo' WHERE id = ?", [
      id,
    ]);
    return getPaymentMethodById(id);
  }

  await pool.execute("UPDATE metodos_pago SET estado = 'inactivo' WHERE id = ?", [id]);
  return getPaymentMethodById(id);
};

export const getPaymentMethodLabelMap = async () => {
  const methods = await listPaymentMethods({ activos: false });
  return Object.fromEntries(methods.map((m) => [m.codigo, m.nombre]));
};
