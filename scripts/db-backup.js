import dotenv from 'dotenv';
import { createBackup } from './backup/backupService.js';
import { listBackupFiles } from './backup/backupPaths.js';

dotenv.config();

const log = (msg) => console.log(`[db:backup] ${msg}`);

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const runBackup = async () => {
  const result = await createBackup();

  log(`✓ Backup creado: ${result.file}`);
  log(`  Método: ${result.method}`);
  log(`  Tablas: ${result.tableCount ?? 'n/d'}`);
  if (result.totalRows != null) log(`  Filas: ${result.totalRows}`);
  log(`  SHA-256: ${result.checksum.slice(0, 16)}...`);
  log(`  Metadata: ${result.metaFile}`);

  if (result.cleanup.deleted.length) {
    log(`  Limpieza: ${result.cleanup.deleted.length} backup(s) antiguo(s) eliminado(s)`);
  } else {
    log(`  Limpieza: sin archivos para eliminar (retenidos: ${result.cleanup.kept})`);
  }
};

const runBackupList = async () => {
  const files = await listBackupFiles();

  console.log('\n=== Backups disponibles ===\n');

  if (!files.length) {
    console.log('No hay backups guardados todavía.');
    console.log('Creá uno con: npm run db:backup\n');
    return;
  }

  for (const file of files) {
    console.log(`  ${file.name}`);
    console.log(`    Fecha: ${file.createdAt}`);
    console.log(`    Tamaño: ${formatBytes(file.sizeBytes)}`);
    console.log(`    Comprimido: ${file.compressed ? 'sí' : 'no'}`);
    console.log('');
  }
};

const command = process.argv[2] || 'run';

if (command === 'list') {
  runBackupList().catch((err) => {
    console.error('[db:backup] Error:', err.message);
    process.exit(1);
  });
} else {
  runBackup().catch((err) => {
    console.error('[db:backup] Error:', err.message);
    process.exit(1);
  });
}
