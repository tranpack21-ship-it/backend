# Despliegue Tran-Pack — Railway + Vercel



Guía para llevar el backend y la base de datos a **Railway** y el frontend a **Vercel**.



## Arquitectura



```

Vercel (React PWA)  ──HTTPS──►  Railway (Node API)  ──SSL──►  Railway MySQL

```



## 1. Base de datos (Railway MySQL)



1. En tu proyecto Railway: **New → Database → MySQL**.

2. Copiá las variables del plugin MySQL al servicio Node:



| Variable Railway (MySQL) | Variable en el backend |

|--------------------------|------------------------|

| `MYSQLHOST`              | `DB_HOST`              |

| `MYSQLPORT`              | `DB_PORT`              |

| `MYSQLUSER`              | `DB_USER`              |

| `MYSQLPASSWORD`          | `DB_PASSWORD`          |

| `MYSQLDATABASE`          | `DB_NAME`              |



3. **SSL**: en producción con host remoto se activa automáticamente.



## 2. Backend (Railway Node)



### Variables obligatorias en producción



```env

NODE_ENV=production

PORT=3000



JWT_SECRET=genera_un_secreto_aleatorio_de_al_menos_32_caracteres

CORS_ORIGIN=https://tu-app.vercel.app



DB_HOST=...

DB_PORT=3306

DB_USER=...

DB_PASSWORD=...

DB_NAME=...

DB_TIMEZONE=-03:00



ADMIN_USERNAME=admin

ADMIN_PASSWORD=contraseña_segura_minimo_12_caracteres

```



### Comando de inicio (un solo paso)



En Railway → servicio Node → **Settings → Deploy → Start Command**:



```bash

npm run db:setup && npm start

```



`db:setup` crea la base de datos, aplica el esquema completo, carga datos iniciales y crea el usuario admin. Es **idempotente** — seguro en cada deploy.



Documentación: [src/database/README.md](src/database/README.md)



### Health check (Railway)



**Settings → Deploy → Healthcheck Path:** `/health`



### Generar JWT_SECRET seguro



```bash

node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

```



## 3. Frontend (Vercel)



Guía detallada: [frontend/DEPLOY.md](../frontend/DEPLOY.md)



### Variables en Vercel (Production)



```env

VITE_API_URL=https://tu-api.up.railway.app/api/v1

VITE_APP_NAME=Tran-Pack

```



### CORS en el backend



`CORS_ORIGIN` debe coincidir **exactamente** con la URL de Vercel.



## 4. Dominio propio (Hostinger → Vercel)



1. En Vercel: agregá el dominio `app.tudominio.com`.

2. En Hostinger DNS: `CNAME` → `cname.vercel-dns.com`.

3. Actualizá `CORS_ORIGIN` en Railway.



## 5. Backups (opcional)



Guía: [scripts/backup/BACKUPS.md](scripts/backup/BACKUPS.md)



```bash

npm run db:backup

npm run db:backup:list

```



## 6. Checklist pre-producción



- [ ] `ADMIN_PASSWORD` fuerte configurada en Railway

- [ ] `npm run db:setup` probado (o incluido en start command)

- [ ] `JWT_SECRET` ≥ 32 caracteres

- [ ] `CORS_ORIGIN` apunta al dominio de Vercel

- [ ] `/health` responde `200`

- [ ] Login desde producción funciona



## 7. Comandos útiles



```bash

# Instalar / actualizar base de datos completa

npm run db:setup



# Health local

curl http://localhost:3000/health



# Backups

npm run db:backup

```


