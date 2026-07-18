# DEMO MODE — Backend en memoria, 100 % offline

Permite usar CHAMBA **sin Supabase ni internet**: registro, login, publicar/aceptar/
finalizar trabajos, reputación, historial y chat, todo contra un backend en memoria
(`demoDb.ts`) que persiste en AsyncStorage durante la sesión.

## Cómo activarlo

Definí la variable de entorno antes de levantar Expo:

```bash
# PowerShell
$env:EXPO_PUBLIC_DATA_MODE = "demo"; npx expo start

# bash / .env / .env.local
EXPO_PUBLIC_DATA_MODE=demo
```

Sin la variable (o con `production` / `development`) la app usa Supabase igual que
siempre: **el camino de producción no cambia** — todas las ramas demo están detrás de
`ENV.DATA_MODE === 'demo'`.

## Usuarios y datos de prueba (seed)

| Rol      | Teléfono   | Nombre             |
|----------|------------|--------------------|
| Cliente  | `88883333` | Cliente de Prueba  |
| Técnico  | `88884444` | Técnico de Prueba  |
| Técnico  | `88885555` | Marlon Herrera     |

- **Código OTP en demo:** `123456`.
- Podés registrar números nuevos y todo persiste hasta `demoDb.reset()`.
- Seed inicial: 2 solicitudes abiertas (limpieza de sofá, electricidad).

## Qué está cableado (gated por DATA_MODE)

| Dominio        | Seam de producción reutilizado                    |
|----------------|---------------------------------------------------|
| Auth           | `authStore` (register / requestOtp / verifyOtp / signOut) + bootstrap en `App.tsx` |
| Publicar       | `jobsService.createJob`                            |
| Feed técnico   | `jobsService.fetchJobs` / `fetchJobById`          |
| Aceptar        | `jobsService.acceptJob` / `workerAcceptJob`       |
| Flujo operativo| `advanceOperationalPhase` / `startJob` / `completeJob` |
| Panel cliente  | `jobsService.fetchClientOrders` / `cancelClientJob` |
| Mis chambas    | `jobsService.fetchWorkerAssignments`              |
| Reputación     | `reviewsService` (fetch / summary / submit) — reusa store local |
| Chat           | `chatService` (context / messages / send)         |

## Notas

- **Realtime**: las suscripciones (`subscribeToJobs`, radar, chat) son no-op en demo;
  la UI se refresca vía React Query (refetch), no en vivo. Suficiente para un solo
  dispositivo.
- **Favoritos / feed de notificaciones**: no existen como feature en la app; no se
  fabricaron. Las notificaciones locales (toasts/push) ya operan offline.
- **Volver a la nube**: quitar la variable de entorno. Cero deuda técnica, cero
  migraciones tocadas.

## Validación

`node scripts/validate-demo.cjs` ejecuta la lógica real de `demoDb` en Node
(AsyncStorage mockeado) — 33 asserts cubriendo el flujo completo.
