# Backups MySQL

Los scripts de backup viven en `backend/scripts/` (fuera de `src/database/`).

```bash
npm run db:backup
npm run db:backup:list
npm run db:restore
npm run db:restore -- --confirm
```

Variables: `BACKUP_DIR`, `BACKUP_RETENTION_DAYS`, `BACKUP_MAX_COUNT` — ver `backend/.env.example`.
