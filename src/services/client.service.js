import { pool } from '../config/database.js';
import { sqlLimitOffset } from '../utils/paginationSql.js';
import { AppError } from '../utils/AppError.js';

const mapClient = (row) => ({
  id: row.id,
  tipo_documento: row.tipo_documento,
  numero_documento: row.numero_documento,
  nombre: row.nombre,
  email: row.email,
  telefono: row.telefono,
  direccion: row.direccion,
  estado: row.estado,
  saldo_cuenta_corriente: Number(row.saldo_cuenta_corriente ?? 0),
  limite_credito:
    row.limite_credito != null ? Number(row.limite_credito) : null,
  fecha_creacion: row.fecha_creacion,
  fecha_actualizacion: row.fecha_actualizacion,
});

export const listClients = async ({ page, limit, search, estado }) => {
  const offset = (page - 1) * limit;
  const conditions = ['1=1'];
  const params = [];

  if (search) {
    conditions.push(
      '(c.nombre LIKE ? OR c.numero_documento LIKE ? OR c.email LIKE ? OR c.telefono LIKE ?)'
    );
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  if (estado && estado !== 'todos') {
    conditions.push('c.estado = ?');
    params.push(estado);
  }

  const whereClause = conditions.join(' AND ');

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM clientes c WHERE ${whereClause}`,
    params
  );

  const total = countRows[0].total;

  const [rows] = await pool.execute(
    `SELECT c.* FROM clientes c
     WHERE ${whereClause}
     ORDER BY c.nombre ASC
     ${sqlLimitOffset(limit, offset)}`,
    params
  );

  return {
    data: rows.map(mapClient),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
};

export const listClientsActive = async () => {
  const [rows] = await pool.execute(
    `SELECT id, nombre, tipo_documento, numero_documento,
            saldo_cuenta_corriente, limite_credito
     FROM clientes WHERE estado = 'activo' ORDER BY nombre ASC`
  );
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    tipo_documento: r.tipo_documento,
    numero_documento: r.numero_documento,
    saldo_cuenta_corriente: Number(r.saldo_cuenta_corriente ?? 0),
    limite_credito: r.limite_credito != null ? Number(r.limite_credito) : null,
  }));
};

export const getClientById = async (id) => {
  const [rows] = await pool.execute('SELECT * FROM clientes WHERE id = ? LIMIT 1', [id]);
  if (!rows.length) throw new AppError('Cliente no encontrado', 404);
  return mapClient(rows[0]);
};

export const createClient = async (data) => {
  if (data.numero_documento) {
    const [dup] = await pool.execute(
      'SELECT id FROM clientes WHERE tipo_documento = ? AND numero_documento = ? LIMIT 1',
      [data.tipo_documento, data.numero_documento]
    );
    if (dup.length) throw new AppError('Ya existe un cliente con ese documento', 409);
  }

  const [result] = await pool.execute(
    `INSERT INTO clientes (
      tipo_documento, numero_documento, nombre, email, telefono, direccion, estado, limite_credito
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.tipo_documento,
      data.numero_documento ?? null,
      data.nombre,
      data.email || null,
      data.telefono ?? null,
      data.direccion ?? null,
      data.estado,
      data.limite_credito ?? null,
    ]
  );

  return getClientById(result.insertId);
};

export const updateClient = async (id, data) => {
  await getClientById(id);

  if (data.numero_documento !== undefined && data.numero_documento) {
    const tipo = data.tipo_documento ?? (await getClientById(id)).tipo_documento;
    const [dup] = await pool.execute(
      'SELECT id FROM clientes WHERE tipo_documento = ? AND numero_documento = ? AND id != ? LIMIT 1',
      [tipo, data.numero_documento, id]
    );
    if (dup.length) throw new AppError('Ya existe un cliente con ese documento', 409);
  }

  const updates = [];
  const params = [];
  const fields = [
    'tipo_documento',
    'numero_documento',
    'nombre',
    'email',
    'telefono',
    'direccion',
    'estado',
    'limite_credito',
  ];

  for (const field of fields) {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`);
      let val = data[field];
      if (field === 'email') val = data[field] || null;
      if (field === 'limite_credito') val = data[field] ?? null;
      params.push(val);
    }
  }

  if (!updates.length) return getClientById(id);

  params.push(id);
  await pool.execute(`UPDATE clientes SET ${updates.join(', ')} WHERE id = ?`, params);
  return getClientById(id);
};

export const deactivateClient = async (id) => {
  await getClientById(id);
  await pool.execute("UPDATE clientes SET estado = 'inactivo' WHERE id = ?", [id]);
  return getClientById(id);
};
