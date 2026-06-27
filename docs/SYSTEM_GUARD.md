# CHAMBA SYSTEM GUARD

Sistema de diagnóstico y protección. Objetivo: que **ningún error de login se muestre
sin antes saber si la causa es internet, Supabase o un bug real**, y que los scripts de
test no saturen producción.

## Piezas

| Archivo | Rol |
|---------|-----|
| `src/utils/systemHealth.ts` | Motor de diagnóstico reutilizable: `checkInternet()`, `checkSupabaseHealth()`, `checkRPCHealth()`, `diagnoseSystem()`. Solo mide, sin lógica de negocio. |
| `src/utils/loginSafety.ts` | `resolveLoginProfile(phone)`: distingue "usuario inexistente" de "servidor caído". Loguea diagnóstico con teléfono enmascarado. |
| `src/store/authStore.ts` | Login usa `resolveLoginProfile` en los 3 puntos (request OTP, verify DEV, verify real). |
| `scripts/_guard.mjs` | `assertTestEnvironment()` bloquea scripts de caos contra producción + `createRateLimiter()`. |
| `scripts/production-safe/system-health.mjs` | Diagnóstico CLI de solo lectura (seguro en producción). |
| `scripts/production-safe/keep-alive.mjs` + `.github/workflows/keep-alive.yml` | Ping diario gratuito (GitHub Actions) para que el free tier no se auto-pause (7 días). |

## Regla crítica del login

`resolveLoginProfile` reemplaza el viejo patrón `if (!fetchProfileByPhone()) "no registrado"`.
Antes, un `null` por **servidor caído** y un `null` por **usuario inexistente** daban el mismo
mensaje falso. Ahora:

- `lookup.status === 'found'`        → devuelve el perfil (happy path idéntico).
- `lookup.status === 'unavailable'`  → `diagnoseSystem()` → mensaje de servicio según causa.
- `lookup.status === 'not_found'`    → "Número no registrado" (solo tras respuesta 200 del server).

### Mensajes según diagnóstico

| Causa | Mensaje al usuario |
|-------|--------------------|
| Internet OFF | "Sin conexión a internet…" |
| Supabase DOWN (503/PGRST002) | "Servicio temporalmente no disponible…" |
| RPC error (SQL/DB) | "Sistema en mantenimiento…" |
| Lento/saturado | "El servidor está lento…" |

## Logs de diagnóstico

Cada login fallido emite `[LOGIN_DIAG]` con `{ step, result, phone (enmascarado),
internet, supabase, rpc, status, reason }`.

## Protección de scripts

Scripts de caos/e2e importan `_guard.mjs`. Si apuntan a la URL de producción, **abortan**
(salvo `ALLOW_TEST_SCRIPTS=true`). Ver `scripts/README.md` para la política completa y cómo
crear un proyecto Supabase de TEST separado.

## Uso

```bash
# Diagnóstico inmediato (seguro, solo lectura)
node scripts/production-safe/system-health.mjs
```
```ts
// En código, antes de decidir un mensaje de error:
import { diagnoseSystem } from '@utils/systemHealth';
const health = await diagnoseSystem();   // { internet, supabase, rpc, status, reason }
```
