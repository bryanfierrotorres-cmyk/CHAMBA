# CHAMBA — Auditoría de Arquitectura: Desacoplamiento de Supabase (Fase 1)

**Fecha:** 2026-07-08 · **Fase:** 1 — Auditoría (solo lectura, cero código modificado)
**Alcance:** Mapa completo de dependencias + diseño propuesto (sin implementar) para el dominio piloto **Perfil**.

---

## 1. Mapa arquitectónico

### Stack
| Capa | Tecnología | Versión |
|---|---|---|
| UI runtime | React Native + Expo | 0.74.5 / ~51 |
| Backend actual | `@supabase/supabase-js` | 2.106.2 |
| Estado global | Zustand | 4.5.2 |
| Server-state (instalado, subutilizado) | `@tanstack/react-query` | 5.40.0 |

### Estructura general
```
src/
├── App.tsx                 ← bootstrap: sesión Supabase + fetchProfile + onAuthStateChange
├── navigation/
│   └── RootNavigator.tsx   ← lee authStore.profile.role → monta Auth/Admin/Client/WorkerNavigator
├── store/                  ← 5 stores Zustand
│   ├── authStore.ts        ← session + UserProfile (profiles table)
│   ├── profileStore.ts     ← WorkerProfile (worker_profiles table)
│   ├── assignmentsStore.ts
│   ├── jobStore.ts
│   └── supportBubbleStore.ts
├── context/
│   └── ErrorContext.tsx    ← único Context (banner de error global)
├── services/                ← 7 servicios transversales (supabase.ts, stripe, analytics, notifications...)
├── features/                ← 9 dominios: admin, auth, catalog, chat, client, home-banners, jobs, reviews, workers
│   └── <dominio>/{screens,hooks,services,components}
├── hooks/                   ← 4 hooks globales (lifecycle, session warmup, support bubble, sync location)
└── utils/                   ← profileSync, loginSafety, systemHealth, localWorkerProfile, etc.
```

### Flujo de datos (arranque)
```
App.tsx
  → supabase.auth.getSession()          [timeout 8s, fallback session:null]
  → authStore.fetchProfile(userId)      [SELECT profiles WHERE id=... ]
  → onAuthStateChange(...)              [SIGNED_OUT / TOKEN_REFRESHED / sesión nueva]
       ↓
RootNavigator
  → lee { profile, session } de authStore
  → isAuthenticated = !!profile && !!session.access_token
  → profile.role → Admin | Client | Worker | Auth navigator
       ↓ (si role === worker)
  → profileStore.loadProfile(id) + loadStats(id)   [worker_profiles + job_assignments]
```

### Inventario
| Elemento | Cantidad |
|---|---|
| Pantallas | 24 |
| Componentes | 80 |
| Hooks (features + globales) | 22 + 4 |
| Stores (Zustand) | 5 |
| Servicios | 18 (features) + 7 (globales) |
| Providers/Context | 1 (`ErrorContext`) + `QueryClientProvider` + `BottomSheetModalProvider` + `SafeAreaProvider` |

---

## 2. Dependencias de Supabase (mapa completo)

**31 archivos** importan el cliente (`from '@services/supabase'`). De ellos, **23 archivos concentran 72 llamadas directas** (`supabase.from/rpc/storage/auth/channel`):

| Archivo | Llamadas | Nota |
|---|---:|---|
| `features/jobs/services/jobsService.ts` | **22** | El más acoplado del proyecto, con margen |
| `features/admin/services/adminService.ts` | 10 | |
| `utils/offlineSyncEngine.ts` | 4 | |
| `features/chat/hooks/useJobChat.ts` | 4 | |
| `features/client/services/clientJobSelectionService.ts` | 3 | |
| `features/chat/services/chatService.ts` | 3 | |
| `hooks/useAppLifecycleResilience.ts` | 3 | |
| resto (16 archivos) | 1–2 c/u | incluye `authStore.ts`, `profileSync.ts`, `profileService.ts` |

**Nota de precisión:** el patrón mecánico no capturó `authService.ts` (llamadas confirmadas por lectura directa: `supabase.storage.from('perfil')`, `supabase.from('profiles')`). Verificado manualmente — no es una omisión real, es un límite del regex. El mapa de abajo usa evidencia de lectura directa, no solo grep.

**Módulos que dependen indirectamente** (no llaman a Supabase, pero consumen datos que sí lo hacen):
- Todas las pantallas que leen `useAuthStore((s) => s.profile)` (≈15+ componentes/pantallas)
- `RootNavigator.tsx` (decide el árbol de navegación según `profile.role`)
- `useWorkerProfile.ts`, `useClientOrders.ts`, `useJobs.ts` y demás hooks de features

### Candidatos a Repository (por dominio, orden de acoplamiento ascendente)
1. **Perfil** (`profiles`) — bajo (piloto, este documento)
2. **Perfil extendido de trabajador** (`worker_profiles`) — bajo-medio, con Realtime
3. Categorías/Catálogo (`catalogService.ts`, `preciosCatalogService.ts`)
4. Reviews (`reviewsService.ts`)
5. Chat (`chatService.ts`, `useJobChat.ts`) — Realtime
6. Client selection/applications
7. **Jobs** (`jobsService.ts`) — el más grande y complejo, migrar al final

---

## 3. Dominio Perfil — análisis exclusivo

### Hallazgo central: "Perfil" son en realidad DOS dominios de datos distintos

| | `UserProfile` (tabla `profiles`) | `WorkerProfile` (tabla `worker_profiles`) |
|---|---|---|
| Usado por | Admin, Client, Worker (los 3 roles) | Solo Worker |
| Contenido | identidad, avatar, aprobación, categorías, teléfono | bio, skills, disponibilidad, rating, stats |
| Realtime | No | Sí (`subscribeToWorkerProfile`) |
| Caché local | No | Sí (`localWorkerProfile.ts`, AsyncStorage) |
| Complejidad | Baja | Media (stats agregadas desde `job_assignments`+`jobs`) |

**Recomendación de scope:** el piloto de Fase 3 debe cubrir **únicamente `UserProfile`**. Es más simple, sin Realtime, y se usa en los 3 roles — mejor prueba del patrón. `WorkerProfile` queda como el **siguiente** dominio en la Fase 5 ("Trabajadores"), no mezclado en el piloto.

### Flujo completo — `UserProfile`

**Escritura/lectura, con duplicidad detectada:**

| Función | Archivo | Operación | Nota |
|---|---|---|---|
| `fetchProfile(userId)` | `authService.ts` | `SELECT profiles WHERE id=` | |
| `fetchProfile(userId)` | `authStore.ts` (acción propia) | `SELECT profiles WHERE id=` | **Duplicado** — misma query, dos implementaciones independientes |
| `updateProfile(userId, updates)` | `authService.ts` | `UPDATE profiles` | ya tiene guard anti data-URI (sesión anterior) |
| `uploadAvatar(userId, uri)` | `authService.ts` | Storage bucket `perfil` | ya blindado (091 + fix web) |
| `lookupProfileByPhone/fetchProfileByPhone` | `profileSync.ts` | RPC `get_profile_by_phone` + SELECT fallback | camino de **login por teléfono**, independiente del camino por ID |
| `ensureProfileInDb` | `profileSync.ts` | `UPSERT profiles` | |
| `resolveAdminActorProfile` | `profileSync.ts` | `SELECT` por `session.user.id` | |
| `signUp` | `authStore.ts` | `UPSERT`/`UPDATE profiles` | cruza con dominio Auth |

**Consumo desde UI (acoplamiento directo pantalla→servicio, sin pasar por hook):**
- `ProfileScreen.tsx` (worker): llama `uploadAvatar`+`updateProfile` **directo** desde el componente
- `ClientProfileScreen.tsx`: mismo patrón directo
- `WorkerOnboardingScreen.tsx`: escribe `cedula_url`, `record_policia_url`, `category_1/2`
- `AdminProfileScreen.tsx`: **solo lectura** — únicamente `useAuthStore((s)=>s.profile)`, sin escrituras (el más simple de los 3)

**Fuera de alcance (dejar intacto):** `loginSafety.ts` / `systemHealth.ts` hacen `fetch()` crudo a PostgREST para diagnóstico de salud — no son operaciones de dominio, son health-checks. No deben pasar por el Repository.

### Riesgos específicos de Perfil
- La duplicidad `fetchProfile` (authService vs authStore) debe resolverse **durante** la migración (consolidar en una sola función dentro del Repository) — si no, el Repository heredaría la inconsistencia.
- `ProfileScreen.tsx`/`ClientProfileScreen.tsx` llaman servicios directo, sin pasar por un hook — la migración deberá tocar las pantallas (import swap), no solo la capa de servicio.
- `signUp` mezcla creación de perfil con lógica de Auth — **no tocar** en el piloto (regla de no modificar Auth sin autorización expresa).

---

## 4. Diseño propuesto (solo diseño, sin implementar)

```
┌─────────────────────────────┐
│  ProfileScreen / ClientProfileScreen / AdminProfileScreen  │  ← sin cambios de UI
└──────────────┬──────────────┘
               │ (mismo hook público)
┌──────────────▼──────────────┐
│   useAuthStore (Zustand)     │  ← misma forma pública: profile, setProfile
│   fetchProfile/updateProfile │     ahora delegan al repository, no a supabase directo
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│  ProfileRepository (interface)│
│  - getById(id)                │
│  - update(id, patch)          │
│  - uploadAvatar(id, uri)      │
└──────────────┬───────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌─────────────┐  ┌──────────────┐
│ SupabaseProfileRepository │  FakeProfileRepository │
│ (código actual, movido)   │  (en memoria + seed)   │
└─────────────┘  └──────────────┘
               │
┌──────────────▼──────────────┐
│  getProfileRepository()  (factory)             │
│  lee EXPO_PUBLIC_DATA_MODE (demo|dev|prod)      │
└──────────────────────────────┘
```

### Interfaz propuesta (diseño, no código final)
```ts
// Reusa el tipo UserProfile ya existente en @/types — cero DTOs nuevos.
interface ProfileRepository {
  getById(userId: string): Promise<UserProfile | null>;
  update(userId: string, patch: Partial<Pick<UserProfile,
    'full_name' | 'phone' | 'avatar_url' | 'fcm_token' | 'cedula_url' |
    'record_policia_url' | 'category_1' | 'category_2'>>): Promise<UserProfile>;
  uploadAvatar(userId: string, localUri: string): Promise<string>;
}
```

- **SupabaseProfileRepository**: envuelve el código que YA existe en `authService.ts` (fetchProfile/updateProfile/uploadAvatar) — se mueve, no se reescribe la lógica.
- **FakeProfileRepository**: mismo contrato, datos en memoria + `AsyncStorage` para persistencia entre reloads (mismo patrón que `localWorkerProfile.ts`, ya probado en este proyecto).
- **Factory**: función pura `getProfileRepository()` que lee una variable de entorno y retorna la instancia correcta — mismo mecanismo de `.env`/`.env.local` que ya se implementó para el switch local↔nube.

### Por qué NO ViewModels/UseCases/Controllers
`authStore.fetchProfile`/`updateProfile` **ya cumplen el rol de "UseCase"** — orquestan la llamada y actualizan el estado. Insertar una capa adicional encima duplicaría responsabilidad sin beneficio medible, violando KISS.

---

## 5. Plan de migración (Perfil — paso a paso)

| Paso | Acción | Archivos | Riesgo | Tiempo |
|---|---|---|---|---|
| 1 | Crear interfaz `ProfileRepository` + tipo de factory | 1 archivo nuevo | Ninguno (código inerte) | 30 min |
| 2 | `SupabaseProfileRepository`: mover lógica de `authService.ts` (fetchProfile/updateProfile/uploadAvatar) sin cambiarla | 1 archivo nuevo + `authService.ts` reduce responsabilidad | Bajo — mismo SQL, mismo comportamiento | 1 h |
| 3 | `FakeProfileRepository` + seed (2 usuarios de prueba ya conocidos) | 1 archivo nuevo | Ninguno | 2 h |
| 4 | Factory + variable `EXPO_PUBLIC_DATA_MODE` | 1 archivo nuevo + `env.ts` (1 línea) | Bajo | 30 min |
| 5 | `authStore.fetchProfile`/`updateProfile` delegan al repository (resuelve la duplicidad del hallazgo §3) | `authStore.ts` | Medio — es el store más usado del proyecto | 1 h + pruebas |
| 6 | `ProfileScreen.tsx`/`ClientProfileScreen.tsx`: swap de import (`uploadAvatar/updateProfile` → repository vía store) | 2 pantallas | Bajo — mismo flujo, distinto origen de la función | 1 h |
| 7 | Validar manualmente: login, ver perfil, cambiar avatar, en modo `demo` y en modo `production` | — | — | 1 h |

**Total estimado: ~1 día de trabajo efectivo** (coincide con la estimación previa).

**Orden recomendado:** 1→2→3→4 son aditivos (cero riesgo, nada existente se toca). 5→6 son los únicos pasos que tocan código en uso — se hacen al final, uno a la vez, con prueba manual entre cada uno.

### Estrategia de reversión
Cada paso 1-4 es un archivo nuevo — reversión = borrar el archivo. Pasos 5-6 son ediciones pequeñas y acotadas (menos de 20 líneas cada una) — reversión = `git diff`/revert puntual del archivo. En ningún punto se toca `supabase/migrations/` ni RLS.

---

## 6. Fake Backend — diseño de funcionamiento

```
FakeProfileRepository
├── state: Map<userId, UserProfile>          ← en memoria, mutable
├── seed(): carga estado inicial              ← 2 usuarios de prueba (88883333/88884444)
├── reset(): vuelve state a la copia del seed ← llamado al reiniciar la app en modo demo
├── persist(): AsyncStorage (opcional)        ← mismo patrón que localWorkerProfile.ts
├── latency: simula 200-600ms por operación   ← Promise + setTimeout aleatorio
└── errorRate?: hook para forzar errores en tests de resiliencia (opt-in, no por defecto)
```

- **Seed inicial:** reutiliza los datos ya capturados de los 2 usuarios de prueba de producción (mismo `id`, `full_name`, `phone`) — consistencia con lo que ya se prueba manualmente hoy.
- **Reset automático:** al arrancar en modo `demo`, el estado vuelve al seed (evita arrastrar mutaciones de sesiones anteriores — lección aprendida del intento fallido de Supabase local).
- **Persistencia durante la sesión:** las mutaciones (`update`, `uploadAvatar`) sí quedan en memoria mientras la app está abierta — para que la UX de "guardé mi perfil y lo veo reflejado" funcione en demo.
- **Latencia simulada:** evita que el modo demo "se sienta distinto" a producción (loading states, skeletons se siguen viendo).
- **Errores simulados:** opt-in, no activo por defecto — solo para probar manejo de errores deliberadamente.

Esto es reutilizable para los siguientes dominios (Fase 5): cada `Fake<Dominio>Repository` sigue la misma forma (seed/reset/persist/latency).

---

## 7. Confirmación de compatibilidad

| Área | ¿Se rompe? | Por qué |
|---|---|---|
| **Auth** | **No** | El Repository envuelve `profiles` CRUD, no `signIn/signUp/signOut/OTP`. Esas funciones de `authStore.ts` quedan intactas en este piloto. |
| **Navegación** | **No** | `RootNavigator` sigue leyendo `authStore.profile`/`session` con la misma forma (`UserProfile`) — el Repository solo cambia CÓMO se llena ese campo, no su forma. |
| **Providers** | **No** | `ErrorContext`, `QueryClientProvider`, `BottomSheetModalProvider` no interactúan con Supabase para Perfil. |
| **Session** | **No** | `supabase.auth.getSession()`/`onAuthStateChange` en `App.tsx` no se tocan. |
| **Stores** | **Cambio interno, no de contrato** | `authStore.fetchProfile/updateProfile` cambian su implementación interna (delegan al repository); su firma pública y el campo `profile` no cambian — los 30+ consumidores de `useAuthStore((s)=>s.profile)` no se enteran. |
| **Compatibilidad con Supabase** | **Mantenida al 100%** | `SupabaseProfileRepository` es el código actual movido, no reescrito. Mismo SQL, mismas tablas, mismo RLS. |

---

## 8. Riesgos

**Técnicos**
- La duplicidad `fetchProfile` (authService/authStore) debe resolverse con cuidado — hay que confirmar cuál versión es la que realmente se usa en producción antes de descartar la otra (evidencia: `authStore.fetchProfile` es la que corre en `App.tsx` bootstrap; la de `authService.ts` no se llama desde ningún otro archivo además de sí misma — candidata a quedar solo en el Repository).
- `console.log` de debug activo en `authStore.fetchProfile` (`FETCH PROFILE RAW`, `STORE PROFILE SET`) — filtra `avatar_url` a la consola en cada fetch. No es bug de esta fase, pero quedará expuesto al mover el código; recomendable retirarlo en el mismo paso 5 (no antes, por la regla de "no corregir bugs en Fase 1").

**Funcionales**
- `ProfileScreen.tsx`/`ClientProfileScreen.tsx` llaman servicios directo (no vía hook) — la migración toca 2 pantallas, no solo backend. Bajo riesgo pero no es "cero cambios de UI" en sentido literal de imports.

**Rendimiento**
- Ninguno esperado — incluir el store detrás de una interfaz no añade overhead medible (una llamada de función más).

**Mantenimiento**
- Si el patrón se valida bien en Perfil, el mismo molde aplica a los 6+ dominios restantes — riesgo de mantenimiento es BAJO si la interfaz se mantiene delgada (advertencia: no dejar que `ProfileRepository` crezca para incluir lógica de `WorkerProfile` — mantenerlos separados, ver §3).

---

## 9. Recomendaciones y alternativas consideradas

**La arquitectura propuesta (Hooks → Repository → Adapters → Factory por env) es la correcta para CHAMBA hoy.** Alternativas descartadas, con motivo:

| Alternativa | Por qué NO |
|---|---|
| Backend local real (Supabase local / Postgres propio) | Ya se intentó esta sesión — 4 fallos por el contenedor `storage` en Docker/Windows. El Fake Backend in-memory no depende de Docker ni de infraestructura — es estrictamente más simple y más confiable en este entorno. |
| tRPC/GraphQL BFF intermedio | Requiere un servidor adicional — contradice KISS y el objetivo de "cero infraestructura nueva". |
| Mock Service Worker (intercepción HTTP) | Simula al nivel de red (respuestas HTTP), no al nivel de dominio — no da la interfaz limpia que pediste para "cualquier backend reemplazable". Es una herramienta de testing, no de arquitectura de datos. |

**Una mejora opcional (no obligatoria, fuera del piloto):** ya tenés `@tanstack/react-query` instalado pero no se usa en el dominio Perfil (los hooks actuales usan `useState`+`useEffect` a mano). El Repository se integraría naturalmente con `useQuery`/`useMutation` más adelante (caché, reintentos, loading automático) — lo señalo como oportunidad futura, no lo meto en el piloto para no violar "no sobreingeniería".

---

## Cierre de Fase 1

Auditoría completa. **Cero líneas de código modificadas.** Recomendación de scope: el piloto de Fase 2/3 cubre **solo `UserProfile`** (no `WorkerProfile`, que queda para Fase 5). Quedo a la espera de tu aprobación para iniciar Fase 2 (diseño detallado con ventajas/desventajas antes de escribir código).
