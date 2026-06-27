# KNOWN ISSUES — CHAMBA

Historial de bugs resueltos. Cada entrada documenta causa raíz, fix y cómo detectarlo nuevamente.
Nunca investigar desde cero un problema ya resuelto.

---

## [INFRA] Login "Número no registrado" FALSO — API REST de Supabase caída (503 PGRST002)

**PROBLEMA**
Todos los usuarios (incluso los que existen en BD) reciben "Número no registrado".
NO es un bug de código. La causa es que la **API REST de Supabase (PostgREST) está caída**.

**CÓMO CONFIRMARLO (medición real, no suposiciones)**
Correr el sondeo de salud — pega 8 requests a la API REST:
```
node scripts/temp_diag_health.mjs    # 8/8 OK = sano | 0/8 = API caída
node scripts/temp_diag_login.mjs     # prueba el login real de 88884444 / 88883333
```
Si devuelve `HTTP 503` con `PGRST002: "Could not query the database for the schema cache"`,
la API está caída. Tiempos de respuesta >1500ms = saturación; <500ms = sano.

**DATO CLAVE — por qué "se arregla y se vuelve a dañar"**
- El **SQL Editor del panel** conecta DIRECTO a Postgres → funciona aunque la API esté caída.
- La **app** conecta por la API REST (PostgREST) → es la que se cae.
Son dos caminos distintos. Por eso el SQL corría pero el login fallaba. Cuando el free tier
se satura o se pausa, PostgREST pierde la conexión; cuando se recupera, "parece arreglado".

**ROOT CAUSE**
Free tier de Supabase: CPU/RAM compartida, límite bajo de conexiones, auto-pausa tras 7 días
sin actividad. Se satura por: scripts pesados (chaos-test, e2e_validation) que abren muchas
conexiones, blobs grandes en la BD (data URIs base64), o despertar tras pausa.

**FIX (operativo, NO de código)**
1. Panel Supabase → si dice "Paused" → **Restore**.
2. Settings → Database → **Restart project** (~2-4 min downtime).
3. SQL Editor: `NOTIFY pgrst, 'reload schema';`
4. Esperar 2-3 min y reconfirmar con `node scripts/temp_diag_health.mjs` → debe dar 8/8 OK.

**PREVENCIÓN**
- NO correr scripts de carga/caos (`chaos-test-*.mjs`, `e2e_*_validation.mjs`) contra la BD del beta.
- NO guardar imágenes/blobs en columnas de la BD; solo URLs de Storage (ver entrada de avatar_url).
- Mantener la BD < 500 MB (límite free tier).
- Hacer al menos 1 request cada 7 días para evitar auto-pausa (o un cron keep-alive).
- Para producción real: plan Pro ($25/mes) elimina auto-pausa y sube límites.

**FECHA**
2026-06-27

---

## [CERRADO] Login "Número no registrado" — data URI en avatar_url causaba timeout

**PROBLEMA**
El Técnico de Prueba (`88884444`) recibía "Número no registrado" al iniciar sesión.
El perfil existía en BD pero la columna `avatar_url` contenía un screenshot en base64
(`data:image/png;base64,...`, ~100KB en texto). Tanto el RPC como el SELECT de respaldo
en `profileSync.ts` retornaban ese payload enorme → el `withTimeout` de 8s expiraba en
ambas rutas → `fetchProfileByPhone` devolvía null → auth fallaba con mensaje falso.

**ROOT CAUSE**
El `uploadAvatar` anterior no detectaba que la URI de entrada era una data URI en web.
En web, `uri.split('.').pop()` sobre una data URI genera una extensión inválida (base64
aleatorio) → el path del Storage es malformado → el upload puede fallar silenciosamente
o en edge cases guardar el URI original en la BD a través de otra ruta (admin/onboarding).
Sin constraint en BD, cualquier UPDATE podía escribir un data URI directamente.

**FIX — 3 capas**
1. **BD (migración 091):** `CHECK (avatar_url IS NULL OR avatar_url NOT LIKE 'data:%')`
   — imposible guardar una data URI desde cualquier cliente.
2. **BD (migración 091):** RPC `get_profile_by_phone` hace strip defensivo del campo
   `avatar_url` si empieza por `data:` antes de retornar el payload de login.
3. **Frontend (`authService.ts`):** `updateProfile` rechaza data URIs con excepción.
   `uploadAvatar` detecta data URI en la entrada (web), extrae el MIME, convierte a Blob
   correctamente en lugar de depender de la extensión del path, y valida que la URL
   retornada por Storage empiece con `http`.

**SQL APLICAR (producción)**
```sql
\i supabase/migrations/091_avatar_url_protection.sql
```

**ARCHIVOS**
- `supabase/migrations/091_avatar_url_protection.sql`
- `src/features/auth/services/authService.ts` — `uploadAvatar`, `updateProfile`

**FECHA**
2026-06-27

**TESTS**
1. Aplicar `091_avatar_url_protection.sql` en producción
2. `SELECT data_uris_restantes FROM ...` → 0
3. Login `88884444` → entra en < 2s, sin "Número no registrado"
4. Login `88883333` → idem
5. Técnico cambia foto → foto aparece, no hay alert de error
6. Intentar `UPDATE profiles SET avatar_url = 'data:x' WHERE ...` → viola constraint → error BD

**CÓMO DETECTARLO OTRA VEZ**
- Login falla con "Número no registrado" para usuario que existe
- Console: timeout en `fetchProfileByPhone` (~8s)
- `SELECT LENGTH(avatar_url), LEFT(avatar_url, 20) FROM profiles WHERE phone = '88884444'`
  muestra `data:image/...`

**PREVENCIÓN**
- El CHECK constraint de BD es la barrera definitiva; nunca removerlo.
- Nunca usar `select('*')` en queries de login path si hay columnas de tipo blob/text largo.
- En web, siempre detectar data URIs antes de procesarlas con lógica de extensión de archivo.

---

## [CERRADO] Avatar Técnico no persistía tras upload

**PROBLEMA**
El técnico cambiaba su foto de perfil: el archivo llegaba a Supabase Storage pero
`profiles.avatar_url` nunca se actualizaba en la BD ni en el store Zustand.
El usuario veía un alert "Error al subir foto" y la foto vieja seguía apareciendo
tras refresh y logout/login.

**ROOT CAUSE**
`ProfileScreen.tsx` (worker) llamaba `useAuthStore.getState().profile` sin haber
importado `useAuthStore`. En runtime (Metro/Hermes vía Babel, sin typecheck),
esto lanzaba `ReferenceError: Can't find variable: useAuthStore` dentro del bloque
`try` del upload. El `catch` capturaba el error, reseteaba `avatarPreview` a `null`
y mostraba el alert. El archivo SÍ llegaba al bucket `perfil/{userId}/avatar.*`
pero `updateProfile` nunca se ejecutaba.

**FIX**
Reemplazar la llamada a `useAuthStore.getState()` por el `profile` ya disponible
en el scope del componente (proveniente de `useWorkerProfile()` que a su vez
extrae de `useAuthStore`).

```ts
// ANTES (roto):
const currentProfile = useAuthStore.getState().profile;
if (currentProfile) {
  setProfile({ ...currentProfile, avatar_url: url });
}

// DESPUÉS (correcto):
setProfile({ ...profile, avatar_url: url });
```

**ARCHIVOS**
- `src/features/workers/screens/ProfileScreen.tsx` líneas 149–152 (anteriores)

**FECHA**
2026-06-27

**TESTS**
1. Técnico inicia sesión
2. Entra a Mi Perfil → toca el avatar
3. Selecciona foto
4. Debe aparecer inmediatamente (sin alert de error)
5. Pull-to-refresh → sigue la foto nueva
6. Logout → Login → foto sigue
7. Verificar en Supabase: `profiles.avatar_url` contiene la nueva URL

**CÓMO DETECTARLO OTRA VEZ**
- Alert "Error al subir foto" aparece después de seleccionar imagen
- Console muestra `ReferenceError: Can't find variable: useAuthStore`
- El archivo existe en Storage pero `profiles.avatar_url` es el valor anterior
- El avatar del cliente SÍ funciona pero el del técnico no

**PREVENCIÓN**
Antes de usar `useAuthStore.getState()` en un componente React, verificar que
el import esté presente. En componentes que ya usan `useWorkerProfile()` o
cualquier hook que envuelva `useAuthStore`, usar directamente el valor del hook.

---

## [CERRADO] Login "Número no registrado" — RPC timeout + duplicado

**PROBLEMA**
Usuarios existentes (`88883333`, `88884444`) recibían "Número no registrado"
al intentar ingresar. El error era falso — los perfiles existían en BD.

**ROOT CAUSE** (tres capas)
1. **DB — RPC no-sargable**: `get_profile_by_phone` v009 usaba
   `WHERE regexp_replace(phone, ...)` — expresión sobre columna, no usa índice
   → Sequential Scan → statement timeout (33–107s).
2. **DB — Duplicado**: Había 2 perfiles con `phone = '88883333'`
   ("Cliente de Prueba" y "Maria Cliente"). Empeoraba el timeout.
3. **Frontend — early abort**: En `profileSync.ts`, un error del RPC causaba
   `return { status: 'unavailable' }` antes de intentar el SELECT de respaldo.
4. **Frontend — `.maybeSingle()` fallaba** con 2 filas (duplicado); necesitaba `.limit(1)`.

**FIX**
- DB: columna `phone_normalized` + trigger + índice + UNIQUE partial index
- DB: RPC reemplazado por versión sargable (`WHERE phone_normalized = v_digits`)
- DB: Duplicado eliminado (conservado `b0332110` Cliente de Prueba)
- Frontend: `profileSync.ts` ya no aborta en error RPC; cae al SELECT directo
- Frontend: `.maybeSingle()` → `.limit(1)` para tolerar temporalmente 1 duplicado

**ARCHIVOS**
- `APLICAR_LOGIN_FIX.sql` (consolidado, ya aplicado en producción)
- `supabase/migrations/084–090` (detalle paso a paso)
- `src/utils/profileSync.ts` (fixes frontend)

**FECHA**
2026-06-25 / 2026-06-26

**TESTS**
```
RPC('88883333') → "Cliente de Prueba"  ✅ ~500ms
RPC('88884444') → "Técnico de Prueba"  ✅ ~500ms
RPC('8888-3333') → "Cliente de Prueba" ✅ (normaliza guiones)
perfiles con 88883333: exactamente 1   ✅
```

**CÓMO DETECTARLO OTRA VEZ**
- Error "Número no registrado" para usuarios que existen en BD
- `EXPLAIN ANALYZE` muestra Seq Scan en lugar de Index Scan para `get_profile_by_phone`
- RPC tarda >5s
- Console muestra timeout en `fetchProfileByPhone`

**PREVENCIÓN**
- Nunca usar expresiones sobre columnas en WHERE de RPCs de login (no-sargable)
- Mantener el UNIQUE index `idx_profiles_phone_normalized_uniq` activo
- Ante un duplicado de teléfono: resolver manualmente antes de producción

---

## [CERRADO] Jobs desaparecían del dashboard del técnico al recargar

**PROBLEMA**
Al hacer refresh en la pantalla "Mis Chambas" (técnico), trabajos con estado
`'assigned'`, `'arrived'`, `'pending'` etc. desaparecían — no aparecían
ni en Activas ni en Historial.

**ROOT CAUSE**
`MyJobsScreen.tsx` tenía un loop de clasificación con `else if (isWorkerAgendaActive(...))`.
Jobs que no satisfacían `isWorkerAgendaHistory` NI `isWorkerAgendaActive`
eran descartados silenciosamente.

**FIX**
```ts
// ANTES (descarte silencioso):
if (isWorkerAgendaHistory(item)) history.push(item);
else if (isWorkerAgendaActive(item)) active.push(item);
// → estados no cubiertos → pérdida silenciosa

// DESPUÉS (defensivo):
if (isWorkerAgendaHistory(item)) history.push(item);
else active.push(item);  // todo lo no-terminal cae en Activas
```

**ARCHIVOS**
- `src/features/jobs/screens/MyJobsScreen.tsx`

**FECHA**
2026-06-24

**CÓMO DETECTARLO OTRA VEZ**
- Job existe en BD pero no aparece en ninguna pestaña de Mis Chambas
- Console no muestra error (descarte silencioso)

**PREVENCIÓN**
En clasificadores de estado, usar `else` defensivo en lugar de `else if` para
el caso por defecto.

---

## [CERRADO] Cliente veía cambios de estado del trabajo con 60–90s de retraso

**PROBLEMA**
El cliente no veía en tiempo real cuando el técnico actualizaba el estado del trabajo.
El cambio aparecía 60–90 segundos después.

**ROOT CAUSE**
1. `useClientOrders.ts`: `refetchOnWindowFocus: false` y `staleTime: 10_000`
   → no se recargaba al volver a la pantalla
2. Canal Realtime de Supabase: sin fallback si el canal fallaba / se cerraba

**FIX**
- `staleTime: 5_000`, `refetchOnWindowFocus: true`, `refetchOnReconnect: true`
- Polling de respaldo cada 15s cuando el canal Realtime está caído

**ARCHIVOS**
- `src/features/client/hooks/useClientOrders.ts`
- `src/features/client/hooks/useClientJobStatusRealtime.ts`

**FECHA**
2026-06-24

**PREVENCIÓN**
Siempre tener polling de respaldo cuando se depende de Realtime para UX crítico.
