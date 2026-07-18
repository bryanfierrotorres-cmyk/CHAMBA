# CHAMBA — Desarrollo con Supabase Local

Entorno de desarrollo **temporal** con Supabase corriendo en Docker, mientras el proyecto
de Supabase Cloud está suspendido. **No sustituye** a producción — es solo para no detener
el desarrollo. El regreso a la nube se hace **sin tocar código**, solo configuración.

---

## Arquitectura del switch (local ↔ nube)

El único interruptor es la **presencia del archivo `.env.local`**:

| Archivo | Rol | Versionado |
|---------|-----|------------|
| `.env` | Valores de **NUBE** (producción) | gitignored |
| `.env.local` | Override de **LOCAL** (Supabase Docker) | gitignored |

`app.config.js` carga `.env.local` **con precedencia** sobre `.env` (el primero cargado gana).
`src/utils/env.ts` lee `SUPABASE_URL`/`ANON_KEY` del entorno, con la nube como fallback.

- **Existe `.env.local`** → la app usa **Supabase LOCAL**.
- **No existe `.env.local`** → la app usa **Supabase NUBE** (comportamiento original).

Ningún cambio de lógica de negocio. Solo config.

---

## Cómo levantar el entorno local

```bash
# 1. Docker Desktop corriendo (Engine running).
# 2. Levantar el stack (Postgres + Auth + PostgREST + Storage + Studio):
npx supabase start
# → imprime API URL y anon key locales (guardalas).

# 3. Crear .env.local con los valores locales (ver plantilla abajo).
# 4. Aplicar seed de usuarios de prueba:
Get-Content supabase/seed_dev_users.sql | docker exec -i supabase_db_CHAMBA psql -U postgres -d postgres

# 5. Levantar la app:
npx expo start --web --clear
```

### Plantilla `.env.local`

```
# Supabase LOCAL (Docker). Su presencia activa el modo local.
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key que imprime `npx supabase start`>
EXPO_PUBLIC_DEV_MODE=true
```

> El resto de las claves (Google Maps, Stripe, etc.) las hereda de `.env` — no se duplican.

### Puertos locales (por defecto)

| Servicio | URL |
|----------|-----|
| API REST / Auth / Storage | http://127.0.0.1:54321 |
| Postgres | postgresql://postgres:postgres@127.0.0.1:54322/postgres |
| Studio (panel visual) | http://127.0.0.1:54323 |

---

## Cómo VOLVER a Supabase Cloud (cuando reactives tu cuenta)

```bash
# 1. Reactivar el proyecto en el panel de Supabase Cloud.
# 2. Borrar (o renombrar) .env.local  → la app vuelve a leer .env (nube).
Remove-Item .env.local
# 3. (Opcional) Detener el stack local para liberar recursos:
npx supabase stop
# 4. Reiniciar la app:
npx expo start --web --clear
```

Eso es todo. Sin cambios de código.

### Reconciliar el drift al volver (importante)

Mientras estuvimos en local se versionaron cosas que en producción se habían creado a mano:

- **Migración `092_storage_buckets.sql`**: crea los buckets `perfil`, `worker-documents`,
  `job-work-photos` + sus políticas RLS. Al volver a la nube, verificá si ya existían;
  si producción ya los tenía, la migración es idempotente (no rompe nada).
- **Migración `091_avatar_url_protection.sql`**: constraint anti data-URI. Aplicar en la nube si no se aplicó.

---

## Riesgos detectados (revisar al reactivar la nube)

1. **`worker-documents` es un bucket PÚBLICO** pero contiene PII (cédula + récord policial).
   El código usa `getPublicUrl`, por eso se reconstruyó público. **Riesgo de privacidad**:
   cualquiera con la URL accede al documento. Fix correcto = bucket privado + `createSignedUrl`
   (requiere cambio de código, fuera del alcance actual).
2. **Fallback a data URI**: `documentUploadService`, `jobWorkPhotosService` y `jobRequestPhotoService`
   guardan un data URI en la BD si Storage falla. Es la misma raíz del bug de avatar ya resuelto en
   `authService`. Latente en esos 3 servicios.
3. **Reconstrucción de buckets**: como la nube estaba inaccesible, las políticas RLS de Storage se
   reconstruyeron según el comportamiento del código, **no** copiadas 1:1 de producción. Comparar al volver.
4. **Datos locales ≠ producción**: la BD local arranca vacía; solo tiene los usuarios del seed.
   No confundir datos de prueba locales con datos reales de producción.
