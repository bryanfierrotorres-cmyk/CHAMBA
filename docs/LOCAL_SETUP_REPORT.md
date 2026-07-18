# Informe técnico — Setup Supabase Local (2026-07-08)

## Estado: NO levantó. Detenido por instrucción del usuario tras 4 intentos.

---

## Diagnóstico preciso (causa raíz identificada)

En el último arranque limpio, **9 de 10 contenedores quedaron SANOS**:

| Contenedor | Estado |
|-----------|--------|
| `supabase_db` (Postgres) | ✅ healthy |
| `supabase_auth` | ✅ healthy |
| `supabase_kong` (gateway/API) | ✅ healthy |
| `supabase_rest` (PostgREST) | ✅ up |
| `supabase_realtime` | ✅ healthy |
| `supabase_pg_meta` | ✅ healthy |
| `supabase_inbucket` (mail) | ✅ healthy |
| `supabase_edge_runtime` | ✅ up |
| `supabase_storage` | ❌ **unhealthy** |
| `supabase_studio` | ❌ unhealthy (depende de storage) |

**Causa exacta:** el contenedor `storage` estaba corriendo sus migraciones internas de
`pgvector` (`storage_vectors`) cuando el **health-check del CLI expiró** → el CLI declara
fallo y hace teardown de TODO (comportamiento all-or-nothing). No es que storage esté roto:
**arranca más lento que el timeout del CLI en esta máquina.**

**Error secundario mío:** intenté excluir storage con `-x storage`, pero el nombre real del
servicio en el CLI es **`storage-api`**, no `storage`. Por eso storage siguió arrancando y
volvió a bloquear el health-check. Este es el detalle que explica por qué "excluir storage"
no funcionó.

---

## Lo que SÍ funcionó (importante)

- ✅ Las **92 migraciones numéricas aplican limpio** (incluidas 091 y 092) en los 4 intentos.
- ✅ **DB + Auth + PostgREST + Realtime** quedan sanos y operativos.
- ✅ El problema es **100% del stack Docker en Windows**, NO del código de CHAMBA.

---

## Pendientes (no ejecutados por el fallo)

- ❌ `.env.local` **no creado** (no llegué a extraer la anon key local).
- ❌ Seed de usuarios de prueba **no aplicado**.
- ❌ **12 migraciones con sufijo de letra** (`000b`, `010b-f`, `024b`, `030b`, `032b`, `045b`,
  `047b`, `081b`) el CLI local las **salta** por el formato del nombre (`<numero>_nombre.sql`).
  La BD local quedaría incompleta sin ellas (pgcrypto, catálogo unificado, scheduling, etc.).
- ❌ Storage (buckets sirviendo archivos) queda **PENDIENTE** — se retoma cuando sea necesario
  o cuando vuelva Supabase Cloud.

---

## Archivos modificados/creados en esta fase (setup local)

| Archivo | Cambio | Estado |
|---------|--------|--------|
| `app.config.js` | Carga `.env.local` con precedencia sobre `.env` | Modificado, sin commit |
| `src/utils/env.ts` | `SUPABASE_URL/KEY` leen del entorno (fallback nube) | Modificado, sin commit |
| `supabase/migrations/092_storage_buckets.sql` | Versiona los 3 buckets | Nuevo, sin commit |
| `supabase/seed_dev_users.sql` | Seed usuarios de prueba | Nuevo, sin commit |
| `docs/LOCAL_DEV.md` | Guía switch local↔nube + retorno | Nuevo, sin commit |
| `.env.test.example` | Plantilla entorno test | Ya commiteado antes |

**Ningún cambio rompe nada:** `app.config.js` y `env.ts` tienen la **nube como fallback**.
Sin `.env.local`, la app se comporta **igual que siempre**.

---

## Variables de entorno

- `.env` (nube) — **intacto**, sin cambios.
- `.env.local` — **no creado**. Cuando se cree, contendría:
  ```
  EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
  EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key que imprime supabase start>
  EXPO_PUBLIC_DEV_MODE=true
  ```

---

## Riesgos detectados

1. **Storage lento en Windows** — el CLI hace timeout antes de que storage termine sus
   migraciones pgvector. Fixeable (ver alternativa A).
2. **12 migraciones saltadas** por formato de nombre → BD local incompleta si no se aplican a mano.
3. **`worker-documents` es bucket público con PII** (cédula/récord) — riesgo de privacidad,
   a revisar al volver a la nube.
4. **Fallback a data URI** en 3 servicios de upload — misma raíz del bug de avatar ya resuelto.

---

## Alternativas disponibles (para decidir)

### A. Reintentar UNA vez con la exclusión CORRECTA (recomendada) — requiere tu OK
Ahora sé que el nombre real es `storage-api`. Un solo arranque con:
```
npx supabase start -x storage-api,imgproxy,vector,logflare
```
Como los otros 9 contenedores ya estaban sanos, hay **alta probabilidad de que levante**.
Storage quedaría fuera (pendiente, como acordamos). **No lo ejecuto sin tu autorización.**

### B. Desarrollo solo frontend/UI (sin backend) — cero riesgo, disponible ya
Trabajar componentes, pantallas, estilos, navegación y los errores de TypeScript pendientes,
que **no necesitan Supabase**. Retomamos backend cuando vuelva la nube.

### C. Esperar Supabase Cloud
Reactivar tu cuenta y volver a la nube (borrando `.env.local` que no existe = ya estás en modo nube).
Es el backend principal según definiste.

### D. Otro backend gratuito (Neon/Postgres)
Solo Postgres, sin Auth/Storage/Realtime integrados → mucho más trabajo de adaptación. No recomendado.

---

## Reversión / estado limpio

- Contenedores: **eliminados** (teardown completo). Sin procesos residuales.
- Volúmenes: limpiados.
- Código: sin daño; fallback a nube activo. **Cancelar local = cero deuda técnica.**

---

## Recomendación

**Alternativa A** (un intento con el nombre correcto `storage-api`) tiene alta probabilidad
y respeta "no perder tiempo en storage". Si preferís no arriesgar más, **Alternativa B** te
deja desarrollando CHAMBA hoy mismo sin backend. Vos decidís; no ejecuto nada sin tu OK.
