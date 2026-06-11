import dotenv from 'dotenv';
import { inspectBackup, restoreBackup } from './backup/restoreService.js';

dotenv.config();

const parseArgs = (argv) => {
  const args = {
    file: null,
    confirm: false,
    dryRun: false,
    inspect: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--confirm') args.confirm = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--inspect') args.inspect = true;
    else if (arg === '--file') {
      args.file = argv[i + 1];
      i += 1;
    } else if (!arg.startsWith('--')) {
      args.file = arg;
    }
  }

  return args;
};

const run = async () => {
  const args = parseArgs(process.argv);

  if (args.inspect || (!args.confirm && !args.dryRun)) {
    const inspection = await inspectBackup(args.file);

    console.log('\n=== Inspección de backup ===\n');
    console.log(`Archivo: ${inspection.file}`);
    console.log(`Formato: ${inspection.format}`);
    console.log(`Tablas: ${inspection.tableCount ?? inspection.tables.length ?? 'n/d'}`);
    if (inspection.totalRows != null) {
      console.log(`Filas (metadata): ${inspection.totalRows}`);
    }
    if (inspection.tables.length) {
      console.log(`Listado: ${inspection.tables.join(', ')}`);
    }
    if (inspection.meta?.createdAt) {
      console.log(`Creado: ${inspection.meta.createdAt}`);
    }
    console.log('');

    if (!args.confirm && !args.dryRun) {
      console.log('⚠  La restauración SOBRESCRIBE los datos actuales de la base.');
      console.log('   Para continuar: npm run db:restore -- --confirm');
      console.log('   Para validar sin cambios: npm run db:restore -- --dry-run --confirm\n');
      return;
    }
  }

  const result = await restoreBackup({
    file: args.file,
    confirm: args.confirm,
    dryRun: args.dryRun,
  });

  if (!result.confirmed) {
    console.error(result.message);
    process.exit(1);
  }

  console.log(`[db:restore] ${result.message}`);
  if (result.result) {
    console.log(`[db:restore] Modo: ${result.result.mode}`);
    if (result.result.tables) {
      console.log(`[db:restore] Tablas restauradas: ${result.result.tables}`);
    }
  }
};

run().catch((err) => {
  console.error('[db:restore] Error:', err.message);
  process.exit(1);
});
