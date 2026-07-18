# CHAMBA — Fase 4: Validación del Repositorio de Perfil

**Fecha:** 2026-07-08 · **Restricción respetada:** cero cambios en `authStore`, pantallas, navegación, providers o sesión.
**Herramienta:** arnés temporal (`@babel/register` + stubs de AsyncStorage/expo-constants), ejecutado fuera de la app y **eliminado al terminar**. No queda ningún artefacto de prueba en el repo.

---

## 1. Verificación funcional — resultado: 16/16 ✅

| Método | Caso | Resultado |
|---|---|---|
| `getById` | perfil existente → datos correctos (nombre, teléfono, rol) | ✅ |
| `getById` | latencia simulada 200-600ms | ✅ 535ms medidos |
| `getById` | usuario inexistente → `null` (no lanza) | ✅ |
| `update` | modifica el campo pedido, preserva el resto, actualiza `updated_at` | ✅ |
| `update` | patch vacío `{}` → no lanza, solo refresca `updated_at` | ✅ |
| `update` | usuario inexistente → lanza `Error` | ✅ (`"Perfil no encontrado (demo)"`) |
| `uploadAvatar` | devuelve el mismo URI local (comportamiento documentado) | ✅ |

**Hallazgo del proceso, no del código:** la primera corrida falló en `reset()` — pero al investigar, el bug estaba en **mi propio arnés** (comparé contra `'Tecnico de Prueba'` sin tilde, el seed real tiene `'Técnico de Prueba'`). Corregido y re-verificado. Lo dejo explícito porque es exactamente el tipo de falso negativo que una validación real debe atrapar y no ocultar.

## 2. Compatibilidad de interfaz — confirmada por dos vías

- **Estática (ya probada antes):** `tsc --noEmit` no reporta errores nuevos — ambas clases satisfacen `implements ProfileRepository` con los mismos tipos de parámetros y retorno.
- **Dinámica (nueva, este arnés):** ambos objetos exponen exactamente los mismos 3 métodos como funciones (`getById`, `update`, `uploadAvatar`) — paridad estructural confirmada en runtime, no solo en tipos.

## 3. Auditoría de `DemoProfileRepository`

| Aspecto | Resultado |
|---|---|
| `reset()` | ✅ Restaura el seed original tras una mutación (verificado tras corregir el arnés) |
| Persistencia | ✅ `persist()` escribe en AsyncStorage tras cada `update()` (verificado contra el mock) |
| Latencia simulada | ✅ ~200-600ms real, no instantáneo |
| Usuario inexistente | ✅ `getById` → `null`; `update` → `Error` explícito (comportamiento distinto y correcto para cada caso) |
| Datos "inválidos" | ✅ Patch vacío no rompe nada; TypeScript ya impide en compilación pasar campos fuera de `ProfileUpdatePatch` |

## 4. `SupabaseProfileRepository` — límite honesto de esta validación

**Supabase Cloud está confirmado caído ahora mismo** (`node scripts/production-safe/system-health.mjs` → `STATUS: DOWN`, verificado en paralelo a este arnés). Esto significa:

- ✅ Verificado: la instancia se crea sin errores (constructor trivial).
- ✅ Verificado: al llamar `getById()`, el error se propaga como un `Error` real y controlado (`"Faltan las credenciales de Supabase en el build"` — el harness aislado no cargó `.env`, así que este mensaje específico viene del guard de configuración de `supabase.ts`, no de un timeout de red; ambos son fallos "seguros", no cuelgues silenciosos).
- ❌ **NO verificable en vivo hoy:** el camino feliz (`getById` devolviendo un perfil real de la nube) — no hay forma de probarlo mientras Supabase Cloud esté suspendido.
- **Mitigación:** la equivalencia del camino feliz está probada por **auditoría de código**, no por ejecución — `SupabaseProfileRepository` es una delegación 1:1 a `authService.ts` (código ya probado en producción durante meses, sin tocar). El riesgo de que se comporte distinto es el mismo riesgo que ya tenía `authService.ts` antes de esta fase — cero riesgo nuevo introducido.

## 5. Revisión de código — hallazgos

| Hallazgo | Severidad | Nota |
|---|---|---|
| `DemoProfileRepository` importa `AsyncStorage` de forma fija (no inyectada) | Menor | Tuve que interceptar la resolución de módulos (`Module._load`) para poder probarlo aislado — sería más testeable con inyección de dependencia en el constructor. No lo cambié: es una mejora, no un defecto, y tocarlo ahora saldría del alcance de "solo validar". |
| Duplicidad `fetchProfile` (authService vs authStore) | Ya conocida | Sigue pendiente — se resuelve en el paso de integración a `authStore`, no antes (fuera de esta fase por tu restricción explícita). |
| `RepositoryFactory` cachea la instancia para siempre | Ya documentado | Ver `docs/DATA_PROVIDER_EVOLUTION.md` — solución futura opcional, no urgente. |
| Duplicación innecesaria nueva | Ninguna encontrada | Los 4 archivos nuevos no repiten lógica entre sí. |

**Conclusión de esta sección:** no encontré defectos nuevos en el código construido. El único hallazgo (AsyncStorage no inyectado) es una oportunidad de mejora de testabilidad, no un bug.

## 6. Checklist de migración (antes de tocar `authStore`)

| Archivo | Cambio | Líneas aprox. | Impacto | Riesgo | Reversión |
|---|---|---:|---|---|---|
| `src/store/authStore.ts` | `fetchProfile` delega a `repositoryFactory.getProfileRepository().getById()` en vez de su `supabase.from()` propio (elimina la duplicidad §5) | ~10 | Interno — firma pública (`profile`, `setProfile`) sin cambios | Medio — store más importado del proyecto (30+ consumidores indirectos), sin tests automatizados todavía | `git checkout` puntual del archivo |
| `src/features/workers/screens/ProfileScreen.tsx` | Import `uploadAvatar/updateProfile` de `authService` → vía repositorio | ~5 | Ninguno visible — mismo flujo de UI | Bajo | `git checkout` puntual |
| `src/features/client/screens/ClientProfileScreen.tsx` | Mismo patrón | ~5 | Ninguno visible | Bajo | `git checkout` puntual |

**Total: ~20 líneas en 3 archivos.** Checklist de prueba manual sugerido tras el cambio (dado que no hay tests automatizados): login como worker/client/admin, ver perfil, cambiar avatar, cerrar sesión — en los 3 roles, en modo `production` (comportamiento sin cambios esperado) y en modo `demo` (nuevo).

---

## Veredicto de esta fase

**La arquitectura está lista para la integración**, con una salvedad honesta: el camino feliz de `SupabaseProfileRepository` no se pudo ejercitar en vivo por la caída de Supabase Cloud (ajena a esta arquitectura). Esto no es un defecto del diseño — es una limitación del entorno actual, y la mitigación (auditoría de código 1:1 contra `authService.ts` ya probado) es razonable.

Quedo a la espera de tu decisión: ¿autorizás el paso de integración a `authStore.ts` + 2 pantallas (checklist §6), o preferís mantener el repositorio sin conectar por ahora?
