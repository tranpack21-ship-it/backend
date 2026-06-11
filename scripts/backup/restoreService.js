import { gunzip } from 'zlib';
import { promisify } from 'util';
import fsPromises from 'fs/promises';

const gunzipAsync = promisify(gunzip);
import { createDbConnection } from './dbConnection.js';
import { resolveBackupFile } from './backupPaths.js';
import { parseTableSections } from './sqlUtils.js';

const log = (msg) => console.log(`[db:restore] ${msg}`);

const readBackupContent = async (filePath) => {
  if (filePath.endsWith('.gz')) {
    const compressed = await fsPromises.readFile(filePath);
    return (await gunzipAsync(compressed)).toString('utf8');
  }

  return fsPromises.readFile(filePath, 'utf8');
};

const isTranPackFormat = (sql) => sql.includes('Format: tran-pack-sql-v1');

const restoreTranPackFormat = async (connection, sql) => {
  const sections = parseTableSections(sql);

  if (!sections.length) {
    throw new Error('El backup no contiene secciones de tablas reconocibles.');
  }

  await connection.query('SET FOREIGN_KEY_CHECKS = 0');

  for (const section of sections) {
    log(`Restaurando tabla ${section.table}...`);
    await connection.query(section.sql);
  }

  await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  return { mode: 'tran-pack-sections', tables: sections.length };
};

const restoreGenericSql = async (connection, sql) => {
  await connection.query('SET FOREIGN_KEY_CHECKS = 0');
  await connection.query(sql);
  await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  return { mode: 'generic-sql' };
};

export const inspectBackup = async (filePath) => {
  const resolved = await resolveBackupFile(filePath);
  const sql = await readBackupContent(resolved);
  const tranPack = isTranPackFormat(sql);
  const sections = tranPack ? parseTableSections(sql) : [];

  let meta = null;
  const metaPath = resolved.replace(/\.sql(\.gz)?$/, '.meta.json');
  try {
    meta = JSON.parse(await fsPromises.readFile(metaPath, 'utf8'));
  } catch {
    meta = null;
  }

  return {
    file: resolved,
    format: tranPack ? 'tran-pack-sql-v1' : 'generic-sql',
    tables: sections.map((s) => s.table),
    tableCount: sections.length || meta?.tableCount || null,
    totalRows: meta?.totalRows ?? null,
    meta,
  };
};

export const restoreBackup = async ({ file, confirm = false, dryRun = false }) => {
  const resolved = await resolveBackupFile(file);
  const inspection = await inspectBackup(resolved);

  if (!confirm) {
    return {
      confirmed: false,
      inspection,
      message:
        'Restaurar sobrescribe datos actuales. Reejecutá con --confirm para continuar.',
    };
  }

  if (dryRun) {
    return {
      confirmed: true,
      dryRun: true,
      inspection,
      message: 'Dry-run OK — el backup es legible y está listo para restaurar.',
    };
  }

  const sql = await readBackupContent(resolved);
  const connection = await createDbConnection();

  try {
    const result = isTranPackFormat(sql)
      ? await restoreTranPackFormat(connection, sql)
      : await restoreGenericSql(connection, sql);

    return {
      confirmed: true,
      dryRun: false,
      inspection,
      result,
      message: 'Restauración completada.',
    };
  } finally {
    await connection.end();
  }
};
