# CHAMBA — Auditoría de Preparación para Lanzamiento

**Fecha:** 2026-07-08 · **Método:** análisis de código y configuración (sin modificar nada).
**Nota sobre Supabase:** por instrucción explícita, la disponibilidad actual de Supabase Cloud
(suspendido) **no influye** en esta calificación — se evalúa la calidad del producto asumiendo
que el backend funciona. Donde el backend importa estructuralmente (no solo su disponibilidad
momentánea), se indica explícitamente.

**Límite de esta auditoría:** es una revisión de código y configuración, no una sesión de uso
en vivo. "Diseño" y "Consistencia visual" no se califican con la misma confianza que el resto —
requieren ver la app corriendo, algo que esta auditoría no incluyó.

---

## 1. ¿Lista para piloto con usuarios reales? — Calificación por área

| Área | % | Base de la calificación |
|---|---:|---|
| Arquitectura | 70% | Feature-based sólida; Repository Pattern recién validado en Perfil (1 de ~7 dominios); `jobsService.ts` con 1.786 líneas es un god-file sin dividir |
| Estabilidad | 45% | 0 tests automatizados; 1 solo Error Boundary global (cualquier error de render tumba TODA la app); 2 bugs confirmados de comparaciones que nunca son `true` |
| Rendimiento | Sin evaluar a fondo | Requiere profiling en dispositivo real; señales indirectas (archivos grandes) sugieren riesgo, no hay evidencia dura |
| UX | 55% | Skeletons y estados vacíos parciales (ya identificado en `MVP_ROADMAP.md`); `console.log` de debug visibles en producción (`authStore.fetchProfile`) |
| Flujo de registro | 65% | Código completo; depende de Firebase (push) con credenciales placeholder |
| Flujo de contratación | 55% | Allocation engine avanzado (migraciones 068-069) pero sin tests, alta complejidad |
| Publicación de trabajos | 60% | Funcional; `CreateJobFormScreen.tsx` tiene 3 errores TS activos sin resolver |
| Perfil | 85% | Dominio más auditado de todo el proyecto; arquitectura validada esta sesión |
| Navegación | 75% | `RootNavigator` sólido (exclusión de árboles por rol); duplicidad de fetch de perfil aún sin consolidar |
| Diseño | No evaluable por código | Requiere sesión visual en vivo |
| Calidad de código | 50% | 14 errores TypeScript activos; **ESLint roto (config v9, cero linting corriendo hoy)** |
| Escalabilidad | 40% | 100% dependiente del free tier de Supabase (ya causó 2 outages de desarrollo esta sesión) |
| Seguridad | 50% | RLS + fixes de IDOR ya aplicados (059/060); pero bucket `worker-documents` con PII (cédula, récord policial) es **público**; credenciales de pago/push son placeholders |
| Manejo de errores | 45% | Boundary único a nivel raíz; múltiples `catch { console.warn }` que tragan errores sin notificar al usuario |
| Accesibilidad | 20% | Sin evidencia de labels de accesibilidad, roles ARIA/RN, o contraste verificado en el código revisado |
| Consistencia visual | No evaluable por código | Requiere sesión visual en vivo |

**Promedio de las áreas evaluables:** ~54%.

---

## 2. Auditoría funcional — 13 flujos

| Flujo | Estado | Evidencia |
|---|---|---|
| Registro | **Parcial** | Completo en código; push notifications dependen de Firebase con credenciales `REEMPLAZAR` en `.env` |
| Inicio de sesión | **Parcial** | SYSTEM GUARD ya distingue fallos reales de caídas de servidor (trabajo de esta sesión); depende de Supabase activo |
| Perfil | **Funcional** | Validado exhaustivamente en Fases 1-4 de esta sesión (16/16 checks) |
| Publicar trabajo | **Parcial** | Funciona; 3 errores TS activos en la pantalla principal (`any` implícitos, estilos inexistentes referenciados) |
| Buscar trabajos | **Parcial** | Radar/feed con migraciones dedicadas; RPCs complejas sin reprueba en esta sesión |
| Aceptar trabajo | **Parcial** | Motor de asignación (waves, fallback de liquidez, hybrid accept) — trabajo serio, pero sin tests que lo protejan |
| Chat | **Parcial** | RPC + Realtime dedicados; sin auditoría específica esta sesión |
| Notificaciones | **No funcional (producción real)** | `EXPO_PUBLIC_FIREBASE_*` = `REEMPLAZAR` en `.env` — no hay proyecto Firebase real conectado |
| Favoritos | **No funcional** | **No existe en el código** — cero servicio, hook, tabla o pantalla relacionada |
| Reputación | **Funcional** | Motor de reputación fue una fase de trabajo aprobada y cerrada explícitamente (sesión previa) |
| Historial | **Funcional** | Bug de clasificación de estados ya identificado y corregido (`MyJobsScreen`, `else` defensivo) |
| Fotografías | **Parcial — riesgo activo** | Funciona, pero **comparte el mismo patrón de fallback a data-URI** que causó el incidente crítico de avatar (login roto por timeout). Ese patrón **NO se corrigió** en `jobWorkPhotosService.ts`/`jobRequestPhotoService.ts` — solo en `authService.ts` |
| Documentos | **Parcial — riesgo activo, agravado** | Mismo riesgo que fotografías, para cédula/récord policial — y el bucket que los aloja (`worker-documents`) es **público** |

**Ningún flujo está en estado "roto por diseño"** — pero 2 de los 13 tienen un riesgo conocido y no corregido, y 1 (Notificaciones) tiene una dependencia externa no configurada que lo hace no funcional en producción real hoy.

---

## 3. Auditoría técnica

| Área | Hallazgo |
|---|---|
| TypeScript | **14 errores activos** (ver `MVP_ROADMAP.md` §1) — incluye 2 bugs reales (comparaciones que nunca son `true`, features silenciosamente muertas) |
| ESLint | **Roto** — config incompatible con ESLint v9. Cero advertencias de lint visibles hoy; deuda invisible |
| Arquitectura | Feature-based, 24 pantallas / 80 componentes / 22 hooks / 5 stores / 18 servicios. Repository Pattern implementado y validado en 1 dominio (Perfil) esta sesión |
| Hooks | 22 + 4 globales; bien distribuidos, sin god-hooks detectados |
| Servicios | `jobsService.ts` con 22 llamadas directas a Supabase y 1.786 líneas — el más acoplado y grande del proyecto por lejos |
| Stores | 5 Zustand; `authStore.ts` tiene una implementación de `fetchProfile` **duplicada** respecto a `authService.ts` (mismo query, dos caminos) |
| Navegación | Sólida — exclusión de árboles por rol, remount limpio al cambiar rol |
| Componentes | 80, bien fragmentados en general |
| Manejo de estado | Zustand + React Query instalado pero **subutilizado** (los hooks de Perfil usan `useState`/`useEffect` a mano en vez de `useQuery`) |
| Gestión de errores | 1 solo Error Boundary (raíz de la app) — sin boundaries por pantalla/sección |
| Código duplicado | `blobToDataUri` duplicado en 2 archivos; patrón de fallback a data-URI repetido en 3 servicios de upload distintos |
| Archivos grandes | `jobsService.ts` (1.786), `JobDetailScreen.tsx` (1.142), `CreateJobFormScreen.tsx` (861), `LoginScreen.tsx` (729) |
| Dependencias | Stack razonable y actualizado (Expo ~51, RN 0.74.5); Stripe instalado pero con clave placeholder |
| Seguridad | RLS + fixes IDOR aplicados (migraciones 059/060); **bucket con PII público** (hallazgo activo, sin corregir) |

---

## 4. Auditoría UX

- **Fricción de clics:** no medible sin sesión en vivo; el `MVP_ROADMAP.md` ya identificó "reducir clics en publicación/búsqueda" como tarea pendiente (P2).
- **Estados vacíos:** parciales — algunas listas los tienen, no es consistente en toda la app (tarea ya identificada, no resuelta).
- **Mensajes de error:** mezclados — algunos traducidos y claros (`translateAuthError` en authStore), otros son `err.message` crudo de Supabase mostrado directo al usuario (`Alert.alert('Error al subir foto', err.message)` en `ProfileScreen.tsx`) — inconsistente.
- **Qué haría que un usuario abandone la app:** (1) el error de login falso ya resuelto esta sesión, pero de clase similar podría repetirse en otros flujos con el mismo patrón de causa raíz (timeout por payload grande); (2) mensajes de error técnicos crudos filtrados a la UI; (3) ausencia de favoritos/historial visual atractivo.

---

## 5. Auditoría de producción — riesgos activos hoy

| Riesgo | Estado |
|---|---|
| **Pérdida de datos / corrupción de datos** | Activo — mismo patrón data-URI del bug de avatar (ya resuelto) sigue latente en fotos de trabajo y documentos de técnico |
| **Cierres inesperados** | Alto — 1 solo Error Boundary global; cualquier error de render no capturado localmente tumba toda la sesión |
| **Errores silenciosos** | Confirmado — múltiples `catch { console.warn(...) }` sin notificar al usuario ni registrar en un sistema de monitoreo real |
| **Rendimiento** | No evaluado con datos duros — señal indirecta de riesgo por tamaño de archivos |
| **Escalabilidad** | Alto riesgo — free tier de Supabase (auto-pausa, límites de conexión) ya causó 2 incidentes de desarrollo esta sesión; sin plan de mitigación de costos definido |
| **Mantenimiento** | Alto riesgo — 0 tests automatizados + ESLint roto = cualquier regresión se detecta solo manualmente |
| **Monitoreo de errores en producción** | Ausente — el único registro de crashes (`AppErrorBoundary`) inserta en `analytics_events` vía Supabase; si Supabase está caído (como ahora), los crashes de esa ventana **no quedan registrados en ningún lado** |

---

## 6. Auditoría para Play Store

| Ítem | Estado |
|---|---|
| Permisos | Razonables y justificados con descripciones (`NSLocationWhenInUseUsageDescription`, etc.) — sin permisos excesivos |
| `targetSdkVersion` | 34 — cumple el requisito vigente de Google Play (2024+) |
| Icono / Splash | Configurados (`icon.png`, `adaptive-icon.png`, `splash.png`) — no evaluada su calidad visual |
| Versión | `1.0.0` / `versionCode: 1` — coherente para un primer release |
| **Política de privacidad** | ❌ **`https://chamba.app/privacy` NO RESUELVE** (verificado en vivo: `HTTP 000`, el dominio no responde). Google Play **exige** una URL de política de privacidad accesible — esto **bloquea la publicación por sí solo**. |
| Términos / Comunidad / Cancelaciones | Mismo dominio (`chamba.app`) — con el mismo problema de resolución |
| Firebase (push) | `EXPO_PUBLIC_FIREBASE_*` = `REEMPLAZAR` — sin proyecto Firebase real, sin `google-services.json` en el repo |
| Stripe (pagos) | `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` = `pk_live_REEMPLAZAR` — clave placeholder, pagos reales no funcionarían |
| Data safety / PII | Bucket `worker-documents` (cédula, récord policial) es público — riesgo de que la declaración de seguridad de datos en Play Console no coincida con la realidad del código |

### Veredicto Play Store: **RECHAZADA hoy, con causa concreta**
La política de privacidad no resuelve — es un bloqueo automático de la política de Google Play, independiente de cualquier otra consideración de calidad. Sumado a credenciales de pago/push sin configurar, la app no pasaría revisión ni brindaría la funcionalidad prometida a un usuario real.

---

## 7. Roadmap priorizado

| # | Tarea | Prioridad | Backend | Impacto | Riesgo | Tiempo |
|---|---|:---:|:---:|---|---|---|
| 1 | Publicar una política de privacidad real y accesible en `chamba.app/privacy` (o cambiar el dominio en `legalLinks.ts`) | **P0** | No | Bloquea Play Store por sí solo | Ninguno | 2-4h |
| 2 | Configurar credenciales reales de Firebase (push) o remover el feature de notificaciones hasta tenerlas | **P0** | No | Notificaciones no funcionan en producción real | Bajo | 4h-1 día |
| 3 | Configurar clave real de Stripe o bloquear el flujo de pago hasta tenerla | **P0** | No | Pagos reales fallarían en producción | Bajo | 2h + coordinación con Stripe |
| 4 | Aplicar el mismo fix anti data-URI (ya hecho en avatar) a `jobWorkPhotosService`/`jobRequestPhotoService`/`documentUploadService` | **P0** | No | Previene el mismo incidente crítico ya vivido, en 3 lugares más | Bajo | 3-4h |
| 5 | Hacer privado el bucket `worker-documents` + `createSignedUrl` | **P0** | Parcial | PII expuesta públicamente hoy | Medio (requiere tocar 1 servicio) | 4-6h |
| 6 | Arreglar los 14 errores TypeScript (incluye 2 bugs reales) | **P0** | No | Features silenciosamente rotas | Ninguno | 2h |
| 7 | Reparar configuración de ESLint (v9) | **P1** | No | Recupera visibilidad de calidad de código | Ninguno | 1h |
| 8 | Error Boundaries por sección (no solo global) | **P1** | No | Reduce cierres totales de app por errores locales | Bajo | 1 día |
| 9 | Suite mínima de tests (lógica pura + Perfil, ya tiene `DemoProfileRepository` como fixture) | **P1** | No | Red de seguridad para futuros refactors | Ninguno | 1-2 días |
| 10 | Servicio de monitoreo de errores (Sentry o similar) | **P1** | No | Visibilidad de crashes incluso con backend caído | Bajo | 4h |
| 11 | Consolidar duplicidad `fetchProfile` (authStore/authService) | **P2** | No | Reduce superficie de bugs futuros | Medio (store central) | 1h |
| 12 | Dividir `jobsService.ts` (1.786 líneas) | **P2** | Parcial | Mantenibilidad | Medio | 1 día |
| 13 | Estados vacíos + skeletons consistentes | **P2** | No | UX | Ninguno | 1 día |
| 14 | Implementar Favoritos (no existe hoy) | **P3** | Parcial | Feature nueva, no bloqueante | Ninguno | 1-2 días |
| 15 | Auditoría de accesibilidad (labels, contraste) | **P3** | No | Cumplimiento e inclusión | Ninguno | 1 día |

---

## Veredicto

### ¿Está lista para una prueba piloto con usuarios reales?

**Sí, con restricciones.**

Puede probarse con un grupo pequeño y controlado — el flujo de Perfil está sólidamente validado, el motor de reputación y el de asignación de trabajos representan trabajo de ingeniería real y serio. Pero el piloto debe **excluir explícitamente**: pagos reales (Stripe no configurado), notificaciones push reales (Firebase no configurado), y debe asumirse el riesgo conocido de fotos/documentos con el patrón data-URI sin corregir todavía en 3 servicios.

### ¿Está lista para Google Play?

**No.**

Motivo concreto y bloqueante: la URL de política de privacidad referenciada en el código (`chamba.app/privacy`) **no resuelve** — verificado en vivo (`HTTP 000`). Google Play exige una política de privacidad accesible como requisito no negociable de publicación. A esto se suman credenciales de pago y notificaciones sin configurar (`REEMPLAZAR` en `.env`), que harían que funcionalidad prometida al usuario simplemente no funcione tras la instalación.

### Puntuación global: **60 / 100**

**Para llegar a 95/100 (nivel de lanzamiento profesional):**
1. Resolver los 6 ítems P0 del roadmap (política de privacidad real, credenciales de Firebase/Stripe, fix data-URI en 3 servicios más, bucket privado, 14 errores TS) — esto por sí solo probablemente sube el puntaje a ~75-80/100, porque elimina los bloqueos duros de Play Store y los riesgos de pérdida de datos conocidos.
2. Los 4 ítems P1 (ESLint, error boundaries seccionados, suite mínima de tests, monitoreo de errores) — sin estos, cualquier mejora futura se construye sin red de seguridad; son los que separan "funciona hoy" de "se puede mantener con confianza."
3. Reactivar Supabase Cloud (fuera del alcance de esta auditoría, pero condición obvia para operar en producción real).

**Lo que no hay que perder de vista:** el trabajo de arquitectura, seguridad (RLS/IDOR) y motor de negocio (reputación, asignación) que ya existe es sustancial y de calidad razonable — el gap principal no es "falta construir features", es "falta la red de seguridad de calidad (tests, lint, monitoreo) y cerrar 6 cabos sueltos concretos y bien identificados" antes de exponer la app a usuarios y a la revisión de Google.
