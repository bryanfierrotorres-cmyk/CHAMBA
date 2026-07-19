# Design Spec — Pantalla Inicio (Técnico)

Fuente: `design-refs/inicio-tecnico.html` (export de Stitch, Tailwind). Medidas convertidas de Tailwind → puntos lógicos RN (1 unidad Tailwind = 4pt; `text-*` en px).

## 1. Design tokens

### Colores (clases reales usadas)
| Token | Hex | Uso |
|---|---|---|
| bg pantalla | `#F8FAFC` | fondo (`bg-gray-50`/surface) |
| card | `#FFFFFF` | tarjetas |
| border card | `#F3F4F6` | `border-gray-100` |
| texto fuerte | `#1F2937` | `text-gray-800` |
| texto medio | `#6B7280` | `text-gray-500` |
| texto tenue | `#9CA3AF` | `text-gray-400` |
| azul primario | `#2563EB` | `blue-600` (botones, activo) |
| azul icono | `#3B82F6` | `blue-500` |
| azul chip bg | `#DBEAFE` | `blue-100` |
| verde 500 | `#22C55E` | dot disponible |
| verde 600 | `#16A34A` | texto "vs ayer" |
| verde 50 / 100 | `#F0FDF4` / `#DCFCE7` | pill disponible |
| ámbar 500 | `#F59E0B` | estrella, DEMO |
| ámbar 50 / 100 | `#FFFBEB` / `#FEF3C7` | banner |
| teal 50 / 100 / 500 / 800 | `#F0FDFA` / `#CCFBF1` / `#14B8A6` / `#115E59` | card "Mejor hora" |
| púrpura 100 / 600 | `#F3E8FF` / `#9333EA` | icono radio |
| rojo 100 / 500 | `#FEE2E2` / `#EF4444` | icono banner |
| indigo 50 / 100 / 200 | `#EEF2FF` / `#E0E7FF` / `#C7D2FE` | card progreso |

### Tipografía (px)
- Saludo H1: 20 / 700 (`text-xl font-bold`)
- Subtítulo: 12 / 400 gris (`text-xs`)
- Título de sección: 16 / 700 (`font-bold`)
- Valor KPI: 18 / 700 (`text-lg font-bold`)
- Label KPI / meta: 12 / 400–500
- Título tarjeta solicitud: 14 / 700 (`text-sm font-bold`)
- Precio: 14 / 700
- Botón: 12 / 500 (`text-xs font-medium`)
- Micro (badges, "Hace 2 min"): 10 (`text-[10px]`)

### Radios (px)
- Tarjetas: 16 (`rounded-2xl`)
- Sub-elementos / thumbnails / botón "Ampliar radio": 12 (`rounded-xl`)
- Iconos KPI / avatar / pills / botón "Ver detalles": full
- Badge "NUEVA": 4 (`rounded`)

### Sombra card (premium)
`0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)`
→ RN: `shadowColor:'#000', shadowOffset:{0,4}, shadowOpacity:0.05, shadowRadius:6, elevation:2`

### Espaciado
- Padding lateral pantalla: 16 (`px-4`)
- Gap entre secciones: 16 (`gap-4`)
- Padding tarjetas grandes: 16 (`p-4`); KPI y solicitudes: 12 (`p-3`)
- Grid KPI: 2 columnas, gap 12 (`grid-cols-2 gap-3`)

## 2. Anatomía por sección (orden exacto)

1. **Header** (sticky, `bg-white/90`, `pt-12 pb-4 px-4`): avatar 48 (circulo `blue-100`, icono) + [Hola,Técnico! 👋 (20/700) / "Listo para recibir Chambas" (12)] · a la derecha: pill Disponible (verde, dot+texto+switch 36×20) y badge DEMO (ámbar, 10/700).
2. **KPIs** (grid 2×2, gap 12): cada card `p-3 rounded-2xl` borde gris. Fila: icono 32 circular tintado + valor 18/700. Debajo: label 12 gris + subline (verde "↑12% vs ayer" / azul "2 nuevas" / 5 estrellas / link azul "Cambiar ›").
3. **Actividad en tu zona** (card azul `#2563EB`, texto blanco, `p-4`, min-h 160, radio 16): título 16/700, "En las últimas 2 horas" 12 azul-claro; panel `bg-white/10` radio 12 con 3 filas (icono + texto 14): técnicos conectados, solicitudes publicadas, radio recomendado. Mitad derecha: mini-mapa abstracto (círculo, pulso, pin blanco, 3 dots verdes).
4. **Mejor hora hoy** (card `teal-50` borde `teal-100`, `p-4`, radio 16): "⚡ Mejor hora hoy" (teal-800/700), ventana 18/700, descripción 12; mini bar-chart (8 barras azules, pico al centro) + labels 8am…12am.
5. **Banner** (card `amber-50` borde `amber-100`, `p-4`): icono target rojo (circulo `red-100` 32) + [título 14/700 "Aumenta tus oportunidades" / desc 12] + botón blanco "Ampliar radio" (borde azul, texto azul, `rounded-xl`, `px-3 py-2`).
6. **Acciones rápidas** (scroll horizontal): título 16/700 + link "Ver todas ›". Items min-w 70, icono en cuadro 56 `rounded-2xl` blanco con sombra (Radar azul, Agenda verde, Billetera púrpura, Estadísticas ámbar, Perfil azul) + label 12 centrado.
7. **Solicitudes recientes cerca de ti**: título 16/700 + "● Actualizado hace 1 min" (10 gris). Cards `p-3 rounded-2xl flex gap-3`: thumbnail 80×80 radio 12 (badge "NUEVA" verde arriba-izq) + [título 14/700 / "Barrio • X km" 12 / "🕐 Hoy • hora" 12 / precio 14/700] + columna derecha: botón azul full "Ver detalles" + "Hace X min" 10.
8. **Progreso semanal** (card `indigo-50` borde `indigo-100`, `p-4`): trofeo en cuadro 48 azul radio 12 + [título 14/700 / "4 de 10 trabajos" 12 / barra progreso h8 radio-full (azul sobre `indigo-200`) / "Falta poco… 💪" 10]; divisor izquierdo + columna derecha: "Meta semanal" 12 / "C$ 5,000" 18/700 / "Llevas C$ 2,150" 10 verde.

No se toca: BottomTab, header general, botón flotante de Ayuda (ya existe `WhatsAppBubble`).

## 3. Datos (reales, sin placeholders)
- KPIs: `fetchWorkerInicioStats` (hoy/ayer/semana) + `workerProfile.rating_avg` + `radiusKm` (workerSearchRadius).
- Actividad zona: derivada de jobs open (publicadas últimas 2h) + conteo de técnicos + radio recomendado calculado.
- Mejor hora: histograma real de `created_at` de jobs open (pico → ventana de 4h; 8 barras normalizadas).
- **Solicitudes recientes**: jobs `open` con antigüedad **entre 1h y 24h** que nadie aceptó y que el técnico cubre (regla del producto). Fuera de esa ventana no aparecen.
- Progreso semanal: `fetchWorkerInicioStats` (completados + ganancias de la semana; meta configurable).

## 4. Componentes reutilizables
`InicioHeader`, `KpiCard`, `ZoneActivityCard`, `BestHourCard`, `PromoBanner`, `QuickActionRow`, `RequestCard`, `WeeklyProgressCard` — en `src/features/jobs/inicio/`. Animación de entrada con Reanimated (fade+rise escalonado).
