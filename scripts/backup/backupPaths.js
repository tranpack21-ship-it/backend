import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from '../../src/config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, '../..');

export const getBackupDir = () => {
  const configured = env.BACKUP_DIR;
  return path.isAbsolute(configured) ? configured : path.resolve(BACKEND_ROOT, configured);
};

export const ensureBackupDir = async () => {
  const dir = getBackupDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
};

export const buildBackupBasename = (database = env.DB_NAME) => {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+/, '')
    .replace('T', '_');
  return `${database}_${timestamp}`;
};

export const buildBackupPaths = (basename, compress = env.BACKUP_COMPRESS) => {
  const dir = getBackupDir();
  const sqlFile = path.join(dir, `${basename}.sql`);
  const archiveFile = path.join(dir, `${basename}.sql.gz`);
  const metaFile = path.join(dir, `${basename}.meta.json`);

  return {
    dir,
    basename,
    sqlFile,
    archiveFile,
    metaFile,
    outputFile: compress ? archiveFile : sqlFile,
  };
};

const BACKUP_FILE_REGEX = /^.+\_\d{8}\_\d{6}\.sql(\.gz)?$/;

export const listBackupFiles = async () => {
  const dir = getBackupDir();

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!BACKUP_FILE_REGEX.test(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      const stat = await fs.stat(fullPath);
      files.push({
        name: entry.name,
        path: fullPath,
        sizeBytes: stat.size,
        createdAt: stat.mtime.toISOString(),
        mtimeMs: stat.mtimeMs,
        compressed: entry.name.endsWith('.gz'),
      });
    }

    return files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
};

export const resolveBackupFile = async (inputPath) => {
  if (inputPath) {
    const resolved = path.isAbsolute(inputPath)
      ? inputPath
      : path.resolve(getBackupDir(), inputPath);
    await fs.access(resolved);
    return resolved;
  }

  const files = await listBackupFiles();
  if (!files.length) {
    throw new Error('No hay backups disponibles en el directorio configurado.');
  }

  return files[0].path;
};
