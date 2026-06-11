import { createHash } from 'crypto';
import { spawn } from 'child_process';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { env } from '../../src/config/env.js';
import { createDbConnection } from './dbConnection.js';
import { cleanupBackups } from './cleanupService.js';
import {
  buildBackupBasename,
  buildBackupPaths,
  ensureBackupDir,
} from './backupPaths.js';
import {
  buildBackupHeader,
  buildInsertStatements,
  buildTableSection,
  quoteIdentifier,
} from './sqlUtils.js';

const log = (msg) => console.log(`[db:backup] ${msg}`);

const mysqldumpAvailable = async () => {
  if (!env.BACKUP_USE_MYSQLDUMP) return false;

  return new Promise((resolve) => {
    const proc = spawn('mysqldump', ['--version'], { stdio: 'ignore' });
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => resolve(code === 0));
  });
};

const getTables = async (connection) => {
  const [rows] = await connection.query(
    `SELECT TABLE_NAME AS name
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME`
  );
  return rows.map((row) => row.name);
};

const createNodeDump = async (connection) => {
  const tables = await getTables(connection);
  let sql = buildBackupHeader({
    database: env.DB_NAME,
    method: 'node',
    tableCount: tables.length,
  });

  const stats = {
    tables: {},
    totalRows: 0,
  };

  for (const table of tables) {
    const quoted = quoteIdentifier(table);
    const [createRows] = await connection.query(`SHOW CREATE TABLE ${quoted}`);
    const createSql = `${createRows[0]['Create Table']};`;
    const [dataRows] = await connection.query(`SELECT * FROM ${quoted}`);
    const insertSql = buildInsertStatements(table, dataRows);

    sql += buildTableSection(table, createSql, insertSql);
    stats.tables[table] = dataRows.length;
    stats.totalRows += dataRows.length;
  }

  sql += 'SET FOREIGN_KEY_CHECKS = 1;\n';
  return { sql, stats, tables: tables.length };
};

const createMysqldump = () =>
  new Promise((resolve, reject) => {
    const args = [
      '-h',
      env.DB_HOST,
      '-P',
      String(env.DB_PORT),
      '-u',
      env.DB_USER,
      '--single-transaction',
      '--quick',
      '--hex-blob',
      '--routines',
      '--triggers',
      '--default-character-set=utf8mb4',
      '--set-gtid-purged=OFF',
      '--skip-add-locks',
      env.DB_NAME,
    ];

    const chunks = [];
    const proc = spawn('mysqldump', args, {
      env: { ...process.env, MYSQL_PWD: env.DB_PASSWORD },
    });

    proc.stdout.on('data', (chunk) => chunks.push(chunk));
    proc.stderr.on('data', (chunk) => {
      const msg = chunk.toString().trim();
      if (msg && !msg.includes('Warning')) {
        console.error(`[db:backup] mysqldump: ${msg}`);
      }
    });

    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`mysqldump finalizó con código ${code}`));
        return;
      }
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
  });

const writeBackupArtifact = async ({ sql, method, stats, tableCount }) => {
  await ensureBackupDir();
  const basename = buildBackupBasename();
  const paths = buildBackupPaths(basename);
  const checksum = createHash('sha256').update(sql).digest('hex');

  if (env.BACKUP_COMPRESS) {
    const gzip = createGzip({ level: 9 });
    const source = Readable.from([sql]);
    const destination = fs.createWriteStream(paths.archiveFile);
    await pipeline(source, gzip, destination);
  } else {
    await fsPromises.writeFile(paths.sqlFile, sql, 'utf8');
  }

  const meta = {
    version: 1,
    database: env.DB_NAME,
    method,
    createdAt: new Date().toISOString(),
    tableCount: tableCount ?? Object.keys(stats?.tables || {}).length,
    totalRows: stats?.totalRows ?? null,
    tables: stats?.tables ?? null,
    compressed: env.BACKUP_COMPRESS,
    checksum,
    file: paths.outputFile,
  };

  await fsPromises.writeFile(paths.metaFile, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');

  return {
    ...paths,
    meta,
    checksum,
  };
};

export const createBackup = async () => {
  const useDump = await mysqldumpAvailable();
  let sql;
  let method;
  let stats = null;
  let tableCount = null;

  if (useDump) {
    log('Usando mysqldump (rápido)...');
    sql = await createMysqldump();
    method = 'mysqldump';
  } else {
    log('mysqldump no disponible — usando exportación Node.js...');
    const connection = await createDbConnection();
    try {
      const dump = await createNodeDump(connection);
      sql = dump.sql;
      stats = dump.stats;
      tableCount = dump.tables;
      method = 'node';
    } finally {
      await connection.end();
    }
  }

  const artifact = await writeBackupArtifact({ sql, method, stats, tableCount });
  const cleanup = await cleanupBackups();

  return {
    file: artifact.outputFile,
    metaFile: artifact.metaFile,
    method,
    checksum: artifact.checksum,
    tableCount: artifact.meta.tableCount,
    totalRows: artifact.meta.totalRows,
    cleanup,
  };
};
