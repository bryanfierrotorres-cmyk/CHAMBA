# Scripts — Política CHAMBA SYSTEM GUARD

Regla de oro: **los scripts de carga / caos / e2e NUNCA corren contra producción.**
La saturación del free tier de Supabase fue la causa del falso "Número no registrado"
(ver `docs/KNOWN_ISSUES.md`).

## Clasificación

| Tipo | Carpeta / patrón | Entorno | Toca datos |
|------|------------------|---------|------------|
| **Diagnóstico (solo lectura)** | `production-safe/` | producción OK | NO escribe |
| **Migraciones** | `apply-migration-*.mjs`, `../supabase/migrations/` | producción (con cuidado) | DDL |
| **Caos / carga** | `chaos-test-*.mjs` | **SOLO test** | escribe/borra masivo |
| **E2E** | `e2e_*_validation.mjs` | **SOLO test** | escribe/borra |

## Protección automática

Todo script de caos/e2e importa `_guard.mjs` y llama `assertTestEnvironment(...)`.
Si apunta a la URL de producción (`xvolxgonpjzjkytpsmil`), **aborta**:

```js
import { assertTestEnvironment, createRateLimiter } from './_guard.mjs';
loadEnv();
assertTestEnvironment('mi-script');          // bloquea producción
const throttle = createRateLimiter(5);        // máx 5 req/seg
// ...
await throttle(); await supabase.from(...)...
```

## Separación de entornos (recomendada para producción real)

Hoy hay **un solo** proyecto Supabase (producción). Para aislar de verdad los tests:

1. Crear un **segundo proyecto Supabase gratis** (panel → New project), exclusivo para test.
2. Copiar `.env.test.example` → `.env.test` y poner ahí la URL/anon key del proyecto de TEST.
3. Correr los scripts de caos con ese entorno:
   ```bash
   NODE_ENV=test node scripts/chaos-test-073.mjs
   ```

Mientras no exista el proyecto de test, los scripts de caos quedan **bloqueados** (correcto:
no deben tocar la BD de los usuarios del beta).

## Diagnóstico (siempre seguro)

```bash
node scripts/production-safe/system-health.mjs
```

Reporta `internet`, `supabase`, `rpc` y un `STATUS` final (OK / DEGRADED / DOWN).
Usalo ANTES de asumir que hay un bug: distingue caída de servidor de un error real.

## Escape hatch (peligroso)

`ALLOW_TEST_SCRIPTS=true` salta el bloqueo. Úsalo solo si sabés exactamente lo que hacés.
