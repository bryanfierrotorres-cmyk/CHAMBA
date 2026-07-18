# CHAMBA — Fase 2: Diseño del Repository de Perfil (sin implementar)

**Fecha:** 2026-07-08 · **Fase:** 2 — Diseño detallado. Continúa de `PERFIL_ARCHITECTURE_AUDIT.md`.
**Regla de esta fase:** diseño únicamente. Ninguna línea de `.ts`/`.tsx` se crea todavía.

---

## 1. Estructura de archivos propuesta (a crear en Fase 3)

```
src/repositories/
└── profile/
    ├── ProfileRepository.ts           ← interfaz + tipos
    ├── SupabaseProfileRepository.ts    ← implementación real (código movido de authService.ts)
    ├── FakeProfileRepository.ts        ← implementación en memoria + seed
    └── index.ts                        ← factory getProfileRepository()
```

Un archivo nuevo, `src/utils/env.ts`, recibe **una línea agregada** (`DATA_MODE`). Ningún otro archivo existente se crea o mueve en esta fase.

---

## 2. `ProfileRepository` — interfaz

```ts
// src/repositories/profile/ProfileRepository.ts
import type { UserProfile } from '@/types';

export type ProfileUpdatePatch = Partial<Pick<UserProfile,
  | 'full_name' | 'phone' | 'avatar_url' | 'fcm_token'
  | 'cedula_url' | 'record_policia_url'
  | 'category_1' | 'category_2'
>>;

export interface ProfileRepository {
  getById(userId: string): Promise<UserProfile | null>;
  update(userId: string, patch: ProfileUpdatePatch): Promise<UserProfile>;
  uploadAvatar(userId: string, localUri: string): Promise<string>;
}
```

**Decisión de scope (confirmada de Fase 1):** NO incluye búsqueda por teléfono (`lookupProfileByPhone`) — eso pertenece al flujo de login (dominio Auth), fuera de este piloto por regla explícita de no tocar Auth. `ProfileRepository` cubre exclusivamente "ver/editar mi perfil ya logueado".

Reusa `UserProfile` de `@/types` tal cual existe — cero DTOs nuevos, cero mapeo de datos.

---

## 3. `SupabaseProfileRepository` — diseño

Envuelve, **sin reescribir**, la lógica que hoy vive en `authService.ts`:

| Método interfaz | Código fuente (se mueve, no se reescribe) |
|---|---|
| `getById` | `fetchProfile()` de `authService.ts` |
| `update` | `updateProfile()` de `authService.ts` (incluye el guard anti data-URI ya existente) |
| `uploadAvatar` | `uploadAvatar()` de `authService.ts` (incluye detección de data-URI en web, conversión Blob, validación de URL `http`) |

**Cero cambios de comportamiento.** Mismo SQL, misma tabla `profiles`, mismo bucket `perfil`, mismo RLS. Es un *move*, no un *rewrite*.

---

## 4. `FakeProfileRepository` — diseño

```ts
class FakeProfileRepository implements ProfileRepository {
  private state: Map<string, UserProfile>;   // en memoria
  private readonly seedData: UserProfile[];   // constante, para reset()

  constructor() {
    this.seedData = [/* Cliente de Prueba, Técnico de Prueba — ver §4.1 */];
    this.state = new Map(this.seedData.map(p => [p.id, p]));
  }

  async getById(userId) {
    await simulateLatency();
    return this.state.get(userId) ?? null;
  }

  async update(userId, patch) {
    await simulateLatency();
    const current = this.state.get(userId);
    if (!current) throw new Error('Perfil no encontrado (fake)');
    const updated = { ...current, ...patch, updated_at: new Date().toISOString() };
    this.state.set(userId, updated);
    await persistToAsyncStorage(this.state);       // mismo patrón que localWorkerProfile.ts
    return updated;
  }

  async uploadAvatar(userId, localUri) {
    await simulateLatency();
    return localUri;   // ver nota de desventaja §7 — no hay Storage real en demo
  }

  reset(): void {                                    // llamado al arrancar en modo demo
    this.state = new Map(this.seedData.map(p => [p.id, p]));
  }
}
```

### 4.1 Seed inicial (reusa datos ya conocidos de esta sesión)
```ts
{ id: 'b0332110-9d62-46f4-89d2-d4139d9a98e3', phone: '88883333',
  full_name: 'Cliente de Prueba', role: 'client', is_approved: true, ... }
{ id: '78ae307b-80c1-4185-bbb6-8bc80486d6fd', phone: '88884444',
  full_name: 'Técnico de Prueba', role: 'worker', is_approved: true,
  worker_status: 'active', category_1: 'limpieza_sofas', ... }
```
Mismos datos que `supabase/seed_dev_users.sql` — consistencia entre lo que se prueba manualmente y lo que corre en demo.

### 4.2 Simulación de latencia y errores
```ts
const simulateLatency = () => new Promise(r => setTimeout(r, 200 + Math.random() * 400));
```
Errores: **no activos por defecto** (para no confundir demos a inversionistas/clientes). Queda como método opt-in (`forceErrorOnNextCall()`) para pruebas deliberadas de manejo de errores — no se usa en Fase 3.

---

## 5. Factory — selección de implementación

```ts
// src/repositories/profile/index.ts
import { ENV } from '@utils/env';

let _instance: ProfileRepository | null = null;

export function getProfileRepository(): ProfileRepository {
  if (_instance) return _instance;
  _instance = ENV.DATA_MODE === 'demo'
    ? new FakeProfileRepository()
    : new SupabaseProfileRepository();
  return _instance;
}
```

Deliberadamente **binario** (`demo` vs. todo lo demás) — no se crean ramas separadas para `development`/`production` en el Repository, porque ambas usan Supabase real (la diferencia entre esos dos entornos ya la resuelve el switch `.env`/`.env.local` que existe desde la sesión anterior, a nivel de URL/anon key, no a nivel de Repository). Evita una capa de distinción que hoy no aporta nada — KISS.

## 6. Configuración de entorno

Una sola variable nueva, mismo mecanismo que ya usa `EXPO_PUBLIC_SUPABASE_URL`:

```
EXPO_PUBLIC_DATA_MODE=demo   # demo | development | production (default si ausente: production)
```

`env.ts` agrega:
```ts
DATA_MODE: readPublicEnv('EXPO_PUBLIC_DATA_MODE') || 'production',
```//
Sin `EXPO_PUBLIC_DATA_MODE` en `.env` → `DATA_MODE = 'production'` → comportamiento **idéntico al actual**. Cambiar de entorno = cambiar una línea en `.env`/`.env.local`, sin tocar código — exactamente el objetivo pedido.

---

## 7. Ventajas

- **Backend intercambiable de verdad:** swap Supabase↔Fake con una variable de entorno, cero cambios de código downstream. Valor concreto dado que Supabase ya causó 2 bloqueos de desarrollo en este proyecto (outage de cuota + fallo de Docker local).
- **Riesgo acotado:** la Fase 3 toca como máximo `authStore.ts` (internamente) + 2 pantallas (import swap) — no un refactor masivo.
- **Cero DTOs nuevos:** reusa `UserProfile` tal cual — no hay capa de mapeo que mantener.
- **Resuelve un bug de paso:** consolida la duplicidad `fetchProfile` (authService vs authStore) detectada en Fase 1, sin que sea el objetivo principal.
- **Sinergia con el roadmap ya acordado:** el `FakeProfileRepository` sirve como fixture reusable para los tests unitarios que están planeados en la Fase 1 del `MVP_ROADMAP.md` — mismo trabajo, dos beneficios.

## 8. Desventajas (honestas)

- **Complejidad marginal mientras solo exista un dominio migrado:** 4 archivos nuevos + una indirección de factory para reemplazar 3 funciones que hoy se llaman directo. El retorno de inversión se nota cuando 2+ dominios ya estén migrados (Fase 5), no antes — es el costo esperado de validar el patrón antes de comprometerse.
- **`authStore.ts` es el store más importado del proyecto** (perfil + sesión, consumido por 30+ archivos indirectamente) y **hoy no hay tests automatizados** (hallazgo de la auditoría de calidad previa). Mitigación propuesta: checklist de prueba manual explícito antes/después del paso 5 del plan de migración (login, ver perfil, cambiar avatar, logout — en los 3 roles).
- **`uploadAvatar` en modo Fake no sube a ningún Storage real** — devuelve el URI local del dispositivo tal cual. Funciona para mostrar la imagen en la sesión demo (`<Image source={{uri}}>` la renderiza igual), pero es una simulación, no una URL remota persistente. Aceptable para el objetivo (demo/desarrollo), documentado para que no sorprenda.

## 9. Riesgos

Ya identificados en Fase 1 (§8 de la auditoría), sin novedades: duplicidad de `fetchProfile` a resolver con cuidado, `console.log` de debug a retirar de paso, y el acoplamiento directo pantalla→servicio en 2 pantallas. Ninguno es bloqueante; todos tienen mitigación en el plan de migración ya aprobado.

## 10. Impacto

| Archivo | Tipo de cambio |
|---|---|
| `src/repositories/profile/*.ts` (4 archivos) | **Nuevos** — cero riesgo por sí solos |
| `src/utils/env.ts` | +1 línea |
| `src/store/authStore.ts` | `fetchProfile`/`updateProfile` delegan al repository (interno, firma pública sin cambios) |
| `src/features/workers/screens/ProfileScreen.tsx` | import swap (`uploadAvatar/updateProfile` → vía store) |
| `src/features/client/screens/ClientProfileScreen.tsx` | import swap, mismo patrón |

Ningún archivo de `supabase/migrations/`, Auth, Router, Providers o RLS se toca.

## 11. Plan de reversión

- Pasos 1-4 (archivos nuevos + factory): revertir = borrar los 4 archivos. No hay nada que "deshacer" en el resto del código porque nada más los referencia todavía.
- Pasos 5-6 (authStore + 2 pantallas): ediciones acotadas (<20 líneas cada una) — revertir = `git checkout` puntual de esos 3 archivos.
- En ningún punto se requiere rollback de base de datos ni de configuración de producción.

---

## Cierre de Fase 2

Diseño completo. Sin código escrito. Quedo a la espera de tu aprobación explícita para iniciar **Fase 3** (implementación real de los 4 archivos + los 2 cambios acotados en `authStore.ts` y las 2 pantallas).
