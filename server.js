import dotenv from 'dotenv';
import app from './src/app.js';
import { env, validateEnv } from './src/config/env.js';
import { pool, testConnection } from './src/config/database.js';
import { applySchemaPatches } from './src/database/setup.js';

dotenv.config();

const startServer = async () => {
  try {
    validateEnv();
    await testConnection();
    await applySchemaPatches(pool);
    app.listen(env.PORT, () => {
      console.log(`[Tran-Pack API] Servidor en http://localhost:${env.PORT}`);
      console.log(`[Tran-Pack API] Entorno: ${env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('[Tran-Pack API] No se pudo iniciar el servidor:', error.message);
    process.exit(1);
  }
};

startServer();
