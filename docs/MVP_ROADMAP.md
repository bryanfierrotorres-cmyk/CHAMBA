# CHAMBA — Auditoría + Roadmap a MVP (sin backend)

Fecha: 2026-07-08. Enfoque: avanzar al máximo tratando el backend (Supabase) como
**servicio externo que volverá**. Prioridad: producto, no infraestructura.

---

## 1. Estado real del proyecto (auditoría)

| Métrica | Valor | Lectura |
|---------|-------|---------|
| Pantallas | 24 | App grande y madura |
| Componentes | 80 | Buena descomposición |
| Hooks | 22 | Lógica reutilizable presente |
| Stores (Zustand) | 5 | Estado global ordenado |
| Servicios | 18 | Capa de datos separada |
| Líneas totales | ~43.000 | Proyecto sustancial |
| **Errores TypeScript** | **14** | Bloquean build estricto |
| **Tests** | **0** | Riesgo alto para refactors |
| **ESLint** | **roto** (config v9) | No corre → warnings invisibles |
| TODO/FIXME | 0 | Sin deuda marcada (o no documentada) |

**Arquitectura:** estructura feature-based limpia (`features/`, `components`, `hooks`,
`store`, `services`, `navigation`, `context`, `types`). Buen fundamento.

**"God files" (candidatos a dividir):**
- `jobsService.ts` — **1.786 líneas** ⚠️
- `JobDetailScreen.tsx` — 1.142
- `CreateJobFormScreen.tsx` — 861
- `LoginScreen.tsx` — 729
- `useJobs.ts` — 701

**Bugs reales detectados (no solo estilo):**
- `ClientActiveServiceCard.tsx:80` — compara estado contra `'cancelled_by_client_pending'`
  que **no existe** en el union `JobStatus` → la comparación **nunca es true** (feature muerta).
- `JobCard.tsx:31` — compara contra `'selected'`, valor inexistente en el enum → lógica rota.
- `JobStatus` creció (migración 066) pero **3 mapas exhaustivos** no se actualizaron
  (Badge, formatters, localAssignments) → faltan `pending, rejected, arrived, assigned`.

---

## 2. Keystone — la tarea que multiplica todo

**Capa de abstracción de datos + adaptador mock** (Repository pattern).

Hoy los servicios llaman a `supabase` directo. Si introducimos una interfaz
(`JobsRepository`, `ProfilesRepository`, …) con **dos implementaciones** — `SupabaseAdapter`
y `MockAdapter` — la app corre **100% offline con datos falsos** y al volver la nube se
cambia **una línea de config**. Esto convierte al backend en el "servicio externo" que pediste
y **desbloquea desarrollar y probar TODAS las features sin Supabase**.

- Backend: **No** · Prioridad: **P0** · Tiempo: **1–2 días** · Impacto: **Muy Alto**

---

## 3. Roadmap priorizado

Prioridad: **P0** (fundamento, hacer ya) → **P3** (nice-to-have).
Backend: **No** (se puede hoy) · **Parcial** (UI ya, datos luego) · **Sí** (bloqueado).

### FASE 0 — Calidad base (desbloquea todo lo demás)
| # | Tarea | Backend | Prio | Tiempo | Impacto |
|---|-------|:------:|:----:|:------:|:------:|
| 0.1 | Arreglar mapas `JobStatus` (Badge, formatters, localAssignments) | No | P0 | 30 min | Alto |
| 0.2 | `CreateJobFormScreen`: estilos faltantes + `any` implícitos | No | P0 | 30 min | Alto |
| 0.3 | **Bugs reales de comparación** (ClientActiveServiceCard, JobCard) | No | P0 | 45 min | Alto |
| 0.4 | Errores TS restantes (BottomSheetView children, `shadowSm`) | No | P1 | 20 min | Medio |
| 0.5 | Reparar config de ESLint (v9 flat) → lint corre de nuevo | No | P1 | 1 h | Medio |
| 0.6 | Limpiar warnings que exponga el lint | No | P2 | 2–3 h | Medio |

### FASE 1 — Fundación de tests (permite refactorizar seguro)
| # | Tarea | Backend | Prio | Tiempo | Impacto |
|---|-------|:------:|:----:|:------:|:------:|
| 1.1 | Setup Jest + React Native Testing Library | No | P1 | 2 h | Alto |
| 1.2 | Tests de lógica pura: `clientOrderClassification`, `jobActiveLimits`, `profileSync` helpers, reputación, `formatters` | No | P1 | 1 día | Alto |
| 1.3 | Tests de componentes clave (Badge, tarjetas, steppers) | No | P2 | 1 día | Medio |

### FASE 2 — Arquitectura (con la keystone + tests ya listos)
| # | Tarea | Backend | Prio | Tiempo | Impacto |
|---|-------|:------:|:----:|:------:|:------:|
| 2.1 | Keystone: Repository + MockAdapter (ver §2) | No | P0 | 1–2 días | Muy Alto |
| 2.2 | Dividir `jobsService.ts` (1.786 líneas) en módulos | Parcial | P2 | 1 día | Alto |
| 2.3 | Dividir `JobDetailScreen`/`CreateJobFormScreen` en subcomponentes | No | P2 | 1 día | Medio |
| 2.4 | Unificar manejo de errores/estados de carga en un hook común | No | P2 | 4 h | Medio |

### FASE 3 — UX (alto impacto visible, sin backend)
| # | Tarea | Backend | Prio | Tiempo | Impacto |
|---|-------|:------:|:----:|:------:|:------:|
| 3.1 | Estados vacíos consistentes (todas las listas) | No | P1 | 1 día | Alto |
| 3.2 | Skeleton loading uniforme (ya existe `SkeletonCard`, extender) | No | P2 | 4 h | Medio |
| 3.3 | Reducir clics en flujos de publicación y búsqueda | No | P2 | 1 día | Alto |
| 3.4 | Animaciones/transiciones (Reanimated) | No | P3 | 1 día | Medio |
| 3.5 | Accesibilidad (labels, roles, contraste, touch targets) | No | P2 | 1 día | Medio |

### FASE 4 — Funcionalidades (UI completa hoy con MockAdapter)
| # | Tarea | Backend | Prio | Tiempo | Impacto |
|---|-------|:------:|:----:|:------:|:------:|
| 4.1 | Favoritos (persistencia local AsyncStorage) | No | P2 | 4 h | Medio |
| 4.2 | Notificaciones locales (expo-notifications) | No | P2 | 1 día | Medio |
| 4.3 | Configuración/Preferencias (tema, idioma, avisos) | No | P2 | 1 día | Medio |
| 4.4 | Reputación: UI + cálculo con datos mock | Parcial | P1 | 1 día | Alto |
| 4.5 | Historial: cache local + UI | Parcial | P2 | 1 día | Medio |
| 4.6 | Flujo de búsqueda: UI/filtros (resultados vía mock) | Parcial | P1 | 1 día | Alto |
| 4.7 | Flujo de publicación: validación/preview completa | Parcial | P1 | 1 día | Alto |

### FASE 5 — Preparación producción
| # | Tarea | Backend | Prio | Tiempo | Impacto |
|---|-------|:------:|:----:|:------:|:------:|
| 5.1 | Fix fallback data-URI en 3 servicios de upload (bug latente) | No | P1 | 3 h | Alto |
| 5.2 | Revisar `worker-documents` público (PII) — plan signed URLs | Parcial | P1 | 4 h | Alto |
| 5.3 | Auditoría de rendimiento (re-renders, listas, memo) | No | P2 | 1 día | Medio |
| 5.4 | Reducir código duplicado (blobToDataUri repetido, etc.) | No | P2 | 4 h | Medio |
| 5.5 | Documentación de arquitectura y componentes | No | P3 | 1 día | Bajo |

---

## 4. Secuencia recomendada (máximo avance)

1. **FASE 0.1–0.4** — dejar el build TS en verde (≈2 h). Base para todo.
2. **FASE 2.1 (keystone)** — Repository + MockAdapter. Desbloquea todas las features offline.
3. **FASE 1.1–1.2** — tests de lógica pura (red de seguridad).
4. **FASE 4.4 / 4.6 / 4.7** — reputación, búsqueda, publicación con mocks (avance de MVP visible).
5. **FASE 3.1 / 3.3** — estados vacíos + menos clics (pulido UX).
6. Resto por prioridad.

**Al volver Supabase Cloud:** cambiar el adaptador `Mock → Supabase` (1 línea) + aplicar
migraciones 091/092 pendientes. El trabajo de features/UX/tests queda intacto.

---

## 5. Qué queda BLOQUEADO por backend (Sí)
- Login real con OTP/SMS (funciona en DEV_MODE con código local).
- Persistencia real de datos (jobs, perfiles, reviews) — el MockAdapter lo simula mientras tanto.
- Storage de archivos (fotos) — pendiente hasta reactivar la nube.
- Realtime (radar en vivo, chat en vivo) — el MockAdapter puede simular estados.
