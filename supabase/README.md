# Base de datos CHAMBA

**No uses `archive/schema-mvp-frozen.sql`** en proyectos nuevos: es un snapshot del MVP inicial y contradice el esquema actual.

## Aplicar esquema (orden obligatorio)

En Supabase SQL Editor, ejecuta **una migración a la vez** (o usa el script local):

```bash
npm run db:sync-chamba   # requiere SUPABASE_DB_URL en .env
```

| Orden | Archivo |
|------|---------|
| 1 | `migrations/001_add_availability_status.sql` |
| 2 | `migrations/005_chamba_complete_fix.sql` |
| 3 | `migrations/007_worker_reviews.sql` |
| 4 | `migrations/009_pilot_worker_agenda.sql` |
| 5 | `migrations/010_part1_tables.sql` |
| 6 | `migrations/010_part2_seed.sql` |
| 7 | `migrations/010_part3_rls.sql` |
| 8 | `migrations/010_part4_functions.sql` |
| 9 | `migrations/011_services_config_sync.sql` |

### Si la parte 1 de 010 hace timeout

Ejecuta solo `migrations/010_part1b_jobs_category_only.sql` y luego continúa con part2–4.

### Verificación opcional

`migrations/010_verify.sql` — consultas de comprobación, no modifica datos.

## Datos de prueba

1. Crear usuarios en Supabase Auth (ver comentarios en `seed-test-users.sql`).
2. Ejecutar `seed.sql` o `seed-test-users.sql` según necesites.

## Catálogo

```bash
npm run db:apply-catalog
npm run db:provision-catalog
```
