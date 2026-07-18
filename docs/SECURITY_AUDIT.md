# CHAMBA — Auditoría de Seguridad (ETAPA 2)

**Fecha:** 2026-07-08 · **Enfoque:** solo seguridad (sin features, rendimiento ni arquitectura).
**Método:** análisis de código y migraciones. **Sin cambios de código** (informe primero).

> **Limitación honesta:** Supabase Cloud está caído. Las políticas RLS y los GRANT reales **no se
> pudieron verificar en vivo** (no hay forma de hacer un dump de `pg_policies`/`information_schema`).
> Este informe se basa en las **migraciones versionadas**, que son la mejor evidencia disponible pero
> podrían no reflejar el estado exacto de producción si hubo cambios manuales en el panel. Los hallazgos
> marcados con 🔎 requieren confirmación con un dump de políticas cuando la nube vuelva.

---

## Resumen ejecutivo

CHAMBA tiene un **modelo de seguridad inconsistente**: hay hardening real y bien hecho en algunas
funciones (migración 059), pero conviven con un **modelo de autenticación falso** para el login por
teléfono y con **grants amplios al rol `anon`** heredados del esquema base. El resultado es que la
superficie de ataque efectiva depende de qué políticas permisivas siguen activas — y varias
probablemente lo están.

**Los 2 hallazgos que bloquean un piloto seguro:**
1. **Autenticación rota** (sesión falsa con anon key) + grants amplios a `anon` → potencial exposición
   masiva de PII e IDOR sobre operaciones de escritura.
2. **Bucket `worker-documents` público** → cédulas y récord policial accesibles por URL.

---

## Hallazgos detallados

### 🔴 CRÍTICA — SEC-1: Autenticación falsa + acceso amplio de `anon`

**Evidencia:**
- `src/store/authStore.ts:260-268` — el login por teléfono crea una **sesión falsa** cuyo
  `access_token` y `refresh_token` son `ENV.SUPABASE_ANON_KEY` (la anon key pública), y la guarda en
  AsyncStorage como `supabase.auth.token`. El usuario NO queda autenticado ante Supabase: opera con rol `anon`.
- `supabase/migrations/000_base_schema.sql` — grants amplios: `get_profile_by_phone`, `accept_job`,
  `worker_complete_job`, `worker_start_job`, `boost_client_job_offer`, `create_client_job`,
  `submit_worker_review`, `advance_complete_assignment` … **todos `GRANT EXECUTE ... TO anon`**.
- Políticas permisivas: `"profiles: public read" USING (true)`, `"jobs: select own or public" USING (true)`,
  `"pilot_anon_assignments_select" TO anon USING (true)`.

**Impacto:** exposición de PII de todos los usuarios (nombre, teléfono, email vía `profiles: public read`)
y manipulación de datos de terceros vía RPCs de escritura invocables por `anon` con IDs arbitrarios.

**Riesgo real:** alto. La anon key es pública por diseño (está en el bundle web y la extraje yo mismo
esta sesión). Los nombres de los RPCs son visibles en el bundle. Los IDs se obtienen del `public read`.

**Cómo explotarlo:**
1. Extraer la anon key del bundle (o de `env.ts`).
2. `POST /rest/v1/rpc/get_profile_by_phone {"p_phone":"..."}` → PII de cualquier número.
3. `GET /rest/v1/profiles?select=*` (rol anon, `USING(true)`) → volcado de todos los perfiles. 🔎
4. `POST /rest/v1/rpc/worker_complete_job` / `boost_client_job_offer` / `submit_worker_review` con
   IDs de terceros → alterar trabajos, ofertas y reseñas ajenas. 🔎 (confirmar qué RPCs de escritura
   validan `auth.uid()`; 059 solo blindó `get_worker_agenda_panel` y `get_worker_assignments`).

**Matiz (para no exagerar):** la migración **059 sí** exige `auth.uid()` y restringe a dueño/admin en 2
funciones de lectura de agenda — hardening correcto. Pero eso **contradice** el modelo de sesión falsa:
para un usuario de login-por-teléfono, `auth.uid()` es NULL, así que esas funciones le devuelven `[]` y
la app cae a caché local. Es decir: el hardening existe pero es **inconsistente** con cómo la app
autentica; las escrituras y el `public read` siguen siendo el vector abierto.

**Cómo corregirlo:**
- Migrar el login por teléfono a **Supabase Auth real** (OTP por SMS ya está codificado detrás de
  `DEV_MODE`; en producción se usa `signInWithOtp`/`verifyOtp`, que sí crean sesión real). Eliminar la
  sesión falsa. *(Toca Auth — requiere tu autorización expresa; hoy está prohibido por tus reglas.)*
- `REVOKE ... FROM anon` en todos los RPCs de escritura y de datos personales; dejar `TO anon` solo en
  lo estrictamente pre-login (`get_profile_by_phone`).
- Reemplazar `profiles: public read USING(true)` por lectura restringida (la 077 lo intentó pero de
  forma **aditiva**: no eliminó la política permisiva base, así que `true OR ...` sigue siendo `true`). 🔎

**Tiempo estimado:** 1–2 días (incluye pruebas). La parte de RLS/grants: ~4–6h. La migración de Auth real: el resto.

---

### 🔴 CRÍTICA — SEC-2: Bucket `worker-documents` público (cédula + récord policial)

**Evidencia:** `supabase/migrations/092_storage_buckets.sql` crea `worker-documents` con `public=true`
y política `public_read_worker-documents FOR SELECT USING (bucket_id='worker-documents')`.
`documentUploadService.ts:50` usa `getPublicUrl`. Contenido: cédula de identidad y récord de policía.

**Impacto:** exposición de documentos de identidad oficiales (PII de máxima sensibilidad).

**Riesgo real:** alto. Los paths son predecibles (`{userId}/cedula.jpg`, `{userId}/record_policia.jpg`)
y los `userId` se obtienen del `public read` de perfiles (ver SEC-1). Con la URL pública, cualquiera
descarga el documento.

**Cómo explotarlo:** obtener un `userId` de trabajador → `GET .../storage/v1/object/public/worker-documents/{userId}/cedula.jpg`.

**Cómo corregirlo:** bucket a **privado** (`public=false`), quitar la política de lectura pública, y en
`documentUploadService.ts` usar `createSignedUrl` (URL temporal firmada) en vez de `getPublicUrl`.
*(Toca un servicio de lógica de negocio — dentro del alcance de seguridad, cambio acotado.)*

**Tiempo estimado:** 4–6h (migración + 1 servicio + prueba).

---

### 🟠 ALTA — SEC-3: Escalamiento de privilegios vía auto-edición de `role`

**Evidencia:** `000_base_schema.sql:230` — `"profiles: owner upsert" FOR ALL USING (id=auth.uid())
WITH CHECK (id=auth.uid())`. Permite al usuario actualizar **cualquier columna** de su propio perfil,
incluyendo `role` e `is_approved`.

**Impacto:** un usuario autenticado podría cambiar su `role` a `admin` o su `is_approved` a `true`.

**Riesgo real:** medio-alto. Requiere una sesión real (los usuarios de teléfono son anon, ver SEC-1) y
que ninguna trigger lo impida. 🔎 confirmar si `076_robust_onboarding_trigger` u otra bloquea cambios de
`role`/`is_approved`.

**Cómo explotarlo:** `PATCH /rest/v1/profiles?id=eq.{miId}` con `{"role":"admin"}`.

**Cómo corregirlo:** política de UPDATE que excluya `role`/`is_approved` (column-level), o una trigger
`BEFORE UPDATE` que impida a no-admins modificar esas columnas.

**Tiempo estimado:** 2–3h.

---

### 🟠 ALTA — SEC-4: RLS restrictiva aplicada de forma aditiva (no anula la permisiva)

**Evidencia:** `077_profiles_rls_security.sql` agrega `"clients can read own profile" USING (auth.uid()=id)`
pero **no elimina** `"profiles: public read" USING (true)` de la 000. En Postgres, múltiples políticas
PERMISSIVE se combinan con **OR** → `true OR (auth.uid()=id)` = `true`. La restricción no tiene efecto.

**Impacto:** la lectura pública de perfiles sigue vigente pese a la apariencia de estar restringida.

**Riesgo real:** alto (habilita SEC-1). **Riesgo de mantenimiento:** peor aún — da falsa sensación de seguridad.

**Cómo corregirlo:** `DROP POLICY "profiles: public read"` y dejar solo las restrictivas; o convertirlas
en `RESTRICTIVE`. 🔎 verificar en vivo cuáles políticas coexisten hoy.

**Tiempo estimado:** 2–4h (auditar todas las tablas por el mismo patrón aditivo).

---

### 🟡 MEDIA — SEC-5: PII en logs de consola (95 `console.*` en 39 archivos)

**Evidencia:** `authStore.ts:100-101` — `console.log('FETCH PROFILE RAW:', data)` y
`console.log('STORE PROFILE SET:', data.avatar_url)` filtran el perfil completo y el avatar en cada
fetch. `adminService.ts` (9), `jobsService.ts` (22) y otros loguean datos de dominio.

**Impacto:** en web, los logs quedan en la consola del navegador (accesibles a cualquiera con DevTools);
en nativo, en logcat. Exposición de PII y de estructura interna.

**Riesgo real:** medio. **Cómo explotarlo:** abrir DevTools / `adb logcat` mientras se usa la app.

**Cómo corregirlo:** remover los `console.log` de datos sensibles; envolver el resto en un logger que se
silencie en producción (`if (__DEV__)`).

**Tiempo estimado:** 3–4h.

---

### 🟡 MEDIA — SEC-6: Tokens de sesión en AsyncStorage (no cifrado)

**Evidencia:** `services/supabase.ts` configura el cliente con `storage: AsyncStorage`. La sesión falsa
se guarda en `AsyncStorage.setItem('supabase.auth.token', ...)`. `app.json` incluye el plugin
`expo-secure-store` pero **no se usa** para los tokens de auth.

**Impacto:** en un dispositivo rooteado/con backup ADB, AsyncStorage es legible en texto plano → robo de sesión.

**Riesgo real:** medio (requiere acceso físico o dispositivo comprometido).

**Cómo corregirlo:** usar un storage adapter basado en `expo-secure-store` (ya instalado) para los
tokens de Supabase Auth.

**Tiempo estimado:** 3–4h.

---

### 🟡 MEDIA — SEC-7: `data:` URI como fallback → PII binaria en la BD

**Evidencia:** `documentUploadService.ts`, `jobWorkPhotosService.ts`, `jobRequestPhotoService.ts` caen a
`blobToDataUri` si el Storage falla, guardando la imagen/documento como texto base64 en la BD. (En
`authService.ts` ya se corrigió + constraint 091, pero **no** en estos 3.)

**Impacto:** documentos de identidad guardados como texto en `profiles`/`jobs` (fuera del control de acceso
de Storage), y el incidente ya vivido de timeout por payload gigante.

**Riesgo real:** medio. **Cómo corregirlo:** eliminar el fallback a data-URI en los 3 servicios; si
Storage falla, fallar explícitamente. Extender el constraint anti-`data:` a las columnas relevantes.

**Tiempo estimado:** 3h.

---

### 🟡 MEDIA — SEC-8: Google Maps API key embebida y (probablemente) sin restringir

**Evidencia:** `env.ts:53`, `app.config.js`, `web/index.html:10` y `public/index.html:9` contienen
`AIzaSyCzAiobbJzkSegwibdS8fOqScZFdgNisyc` en texto plano en el bundle web.

**Impacto:** si la key no tiene restricciones de referrer HTTP / app, terceros pueden usarla y generarte
costos en Google Cloud.

**Riesgo real:** medio (financiero). **Cómo corregirlo:** en Google Cloud Console, restringir la key por
referrer (dominio Vercel) y por app (package name + SHA-1). No requiere cambio de código.

**Tiempo estimado:** 1h (configuración en consola).

---

### 🟢 BAJA — SEC-9: Caché de chat en texto plano en AsyncStorage

**Evidencia:** `useJobChat.ts:75,111` cachea los últimos 50 mensajes por trabajo en AsyncStorage sin cifrar.

**Impacto/Riesgo:** bajo (mensajes operativos, acceso físico requerido). **Fix:** cifrar o limitar
retención. **Tiempo:** 2h.

---

### 🟢 BAJA / INFORMATIVO

| Área | Estado |
|---|---|
| **XSS (11)** | Bajo riesgo estructural: React Native no renderiza HTML; **cero** `dangerouslySetInnerHTML`/`innerHTML`/`eval`/`new Function` en `src`. |
| **Injection (12)** | Bajo: los RPCs usan plpgsql parametrizado; el `EXECUTE format()` de la 092 usa `%I`/`%L` (identificadores/literales escapados). Sin concatenación de SQL con input crudo detectada. |
| **Anon key hardcodeada** (`env.ts:49`) | Bajo: es una *publishable key*, pública por diseño. No es un secreto. |
| **Permisos Android (8)** | Correctos y justificados (INTERNET, ubicación, cámara, notificaciones). Sin permisos excesivos. Descripciones de uso presentes. |
| **Admin login** | Correcto: `signIn` real de Supabase (email+password), `secureTextEntry`, sin credenciales hardcodeadas. |
| **Validación cliente/servidor (18)** | La validación de negocio vive en RPCs SECURITY DEFINER (server-side) — bien; el problema no es falta de validación sino el control de acceso (SEC-1/3). |

---

## Mapa OWASP Mobile Top 10 (2024)

| OWASP | Hallazgo CHAMBA | Severidad |
|---|---|---|
| M1 Uso indebido de credenciales | SEC-1 sesión falsa con anon key | 🔴 |
| M2 Seguridad de la cadena de suministro | Firebase/Stripe placeholder (no explotable, pero sin configurar) | 🟢 |
| M3 Auth/Autorización insegura | SEC-1, SEC-3, SEC-4 | 🔴 |
| M4 Validación insuficiente de entrada/salida | Parcial (SEC-3) | 🟠 |
| M5 Comunicación insegura | HTTPS en todo (Supabase/Vercel) — OK | 🟢 |
| M6 Controles de privacidad inadecuados | SEC-2, SEC-7 (documentos/PII expuestos) | 🔴 |
| M7 Malas prácticas de binarios | Maps key embebida (SEC-8) | 🟡 |
| M8 Mala configuración de seguridad | SEC-4 (RLS aditiva), SEC-6 (storage no cifrado) | 🟠 |
| M9 Almacenamiento inseguro de datos | SEC-6, SEC-9 (AsyncStorage sin cifrar) | 🟡 |
| M10 Criptografía insuficiente | Tokens en claro en AsyncStorage (SEC-6) | 🟡 |

---

## Plan de corrección priorizado

### P0 — Bloquea el piloto seguro (hacer antes de exponer a usuarios reales)
| # | Acción | Toca Auth | Tiempo |
|---|---|---|---|
| SEC-2 | Bucket `worker-documents` privado + signed URLs | No | 4–6h |
| SEC-4 | Eliminar políticas `USING(true)` permisivas; dejar solo restrictivas | No (SQL) | 2–4h |
| SEC-1b | `REVOKE FROM anon` en RPCs de escritura y de datos personales | No (SQL) | 4–6h |
| SEC-3 | Bloquear auto-edición de `role`/`is_approved` (política o trigger) | No (SQL) | 2–3h |

> **P0 mayor (requiere tu autorización porque toca Auth):** SEC-1a — reemplazar la sesión falsa por
> Supabase Auth real (OTP SMS). Sin esto, los grants de anon son la única barrera. Es la corrección de
> fondo, pero la dejo separada por tu regla de no tocar Auth sin permiso expreso.

### P1 — Muy importante (antes de Google Play)
| # | Acción | Tiempo |
|---|---|---|
| SEC-5 | Quitar PII de logs + logger silenciado en producción | 3–4h |
| SEC-7 | Eliminar fallback a data-URI en los 3 servicios de upload | 3h |
| SEC-6 | Tokens de auth en `expo-secure-store` | 3–4h |
| SEC-8 | Restringir la Google Maps key en Google Cloud (referrer + app) | 1h |

### P2 — Recomendable
| # | Acción | Tiempo |
|---|---|---|
| SEC-9 | Cifrar/limitar caché de chat en AsyncStorage | 2h |
| — | Auditoría completa de políticas RLS tabla por tabla (patrón aditivo) 🔎 | 1 día |

---

## Recomendación

**No exponer a usuarios reales hasta cerrar los P0.** Los cuatro P0 marcados como "No toca Auth" son SQL
y un servicio — de bajo riesgo de implementación y alto impacto de seguridad; se pueden hacer sin tocar
la autenticación. El P0 mayor (SEC-1a, Auth real) es la corrección de fondo y requiere tu autorización
expresa para tocar Auth.

**Cuando apruebes, empezamos por los P0 en este orden:** SEC-2 (documentos, el más sensible) → SEC-4/SEC-1b
(cerrar `anon`) → SEC-3 (privesc). Todo esto necesita que Supabase Cloud esté disponible para aplicar y
verificar las migraciones de seguridad.
