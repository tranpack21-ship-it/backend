import fs from 'fs/promises';
import { env } from '../../src/config/env.js';
import { getBackupDir, listBackupFiles } from './backupPaths.js';

export const cleanupBackups = async () => {
  const dir = getBackupDir();
  const files = await listBackupFiles();

  if (!files.length) {
    return { deleted: [], kept: 0, dir };
  }

  const retentionMs = env.BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const deleteSet = new Set();

  for (const file of files) {
    if (retentionMs > 0 && now - file.mtimeMs > retentionMs) {
      deleteSet.add(file.path);
    }
  }

  if (env.BACKUP_MAX_COUNT > 0 && files.length > env.BACKUP_MAX_COUNT) {
    const overflow = files.slice(env.BACKUP_MAX_COUNT);
    for (const file of overflow) {
      deleteSet.add(file.path);
    }
  }

  const deleted = [];

  for (const filePath of deleteSet) {
    const metaPath = filePath.replace(/\.sql(\.gz)?$/, '.meta.json');
    await fs.unlink(filePath).catch(() => {});
    await fs.unlink(metaPath).catch(() => {});
    deleted.push(filePath);
  }

  return {
    dir,
    deleted,
    kept: files.length - deleted.length,
  };
};
