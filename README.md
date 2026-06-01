# ⚡ CHAMBA — MVP On-Demand Labor Marketplace

> Trabaja. Cobra. Vuela.

Plataforma móvil tipo TaskRabbit/Uber para que empresas publiquen excedentes de trabajo y trabajadores pre-aprobados los acepten en tiempo real con protección de concurrencia a nivel de base de datos.

---

## 🏗️ Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Mobile | React Native + Expo (Managed Workflow) + TypeScript |
| UI | NativeWind (Tailwind), Dark Theme + Verde acentos |
| Estado | Zustand (global) + React Query (server state) |
| Backend | Supabase (Auth, PostgreSQL, Realtime, Storage) |
| Notificaciones | Expo Push + Supabase Edge Functions |
| Pagos | Stripe Connect (modo Test) |
| Mapas | React Native Maps (Google Maps) |
| Navegación | React Navigation v6 (Stack + Bottom Tabs) |

---

## 📂 Estructura del Proyecto

```
CHAMBA/
├── App.tsx                     # Entry point
├── src/
│   ├── App.tsx                 # Providers & auth init
│   ├── components/             # Átomos globales
│   │   ├── Avatar.tsx
│   │   ├── Badge.tsx
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── EmptyState.tsx
│   │   └── LoadingScreen.tsx
│   ├── constants/
│   │   ├── theme.ts            # Colores, tipografía, spacing
│   │   └── config.ts           # Variables de entorno
│   ├── features/
│   │   ├── auth/               # Login, Register, Role Selection
│   │   ├── jobs/               # Feed, Detail, Accept (concurrency-safe), MyJobs
│   │   ├── admin/              # Dashboard, PublishJob, ManageWorkers
│   │   └── workers/            # Profile
│   ├── navigation/             # Root, Auth, Worker, Admin navigators
│   ├── services/               # Supabase client, Stripe, Notifications
│   ├── store/                  # authStore (Zustand), jobStore (Zustand)
│   ├── types/                  # TypeScript globals
│   └── utils/                  # formatters, validation
├── supabase/
│   ├── schema.sql              # Esquema completo PostgreSQL + RLS + trigger concurrencia
│   ├── seed.sql                # Datos de prueba
│   ├── config.toml             # Supabase local config
│   └── functions/
│       ├── create-payment-intent/   # Stripe PaymentIntent (5% fee)
│       ├── send-push-notification/  # Expo Push Notifications
│       └── notify-new-job/          # DB Webhook → push a trabajadores
└── README.md
```

---

## 🚀 Guía de Configuración

### 1. Prerrequisitos

```bash
node >= 18
npm >= 9
expo-cli >= 7
```

### 2. Clonar e instalar

```bash
git clone <repo>
cd CHAMBA
npm install
```

### 3. Variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales:

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
```

### 4. Supabase Setup

1. Crea un proyecto en [supabase.com](https://supabase.com)
2. Ve a **SQL Editor** y ejecuta `supabase/schema.sql` completo
3. Crea los **Storage Buckets**:
   - `avatars` → público, máx 5MB
   - `job-media` → privado, máx 10MB
4. Configura las Edge Functions:

```bash
# Instala Supabase CLI
npm install -g supabase

# Vincula tu proyecto
supabase link --project-ref TU_PROJECT_REF

# Despliega funciones
supabase functions deploy create-payment-intent
supabase functions deploy send-push-notification
supabase functions deploy notify-new-job

# Agrega secrets
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
```

5. Configura el **Database Webhook** en Dashboard → Database → Webhooks:
   - Event: `INSERT` en tabla `jobs`
   - URL: `https://TU_PROJECT.supabase.co/functions/v1/notify-new-job`

### 5. Stripe Setup (Modo Test)

1. Crea cuenta en [stripe.com](https://stripe.com)
2. Activa **Stripe Connect** (para pagos a trabajadores)
3. Usa las claves de **modo Test** (`pk_test_...` / `sk_test_...`)
4. Para simular pagos usa tarjeta test: `4242 4242 4242 4242`

### 6. Google Maps

1. Ve a [Google Cloud Console](https://console.cloud.google.com)
2. Crea una API Key con permisos para:
   - Maps SDK for Android
   - Maps SDK for iOS
   - Geocoding API
3. Agrega la key en `.env`

### 7. Correr el proyecto

```bash
npm start
# o específicamente:
npm run android
npm run ios
```

---

## 🛡️ Lógica de Concurrencia (Regla de Oro)

La protección contra doble-aceptación está implementada **a nivel de base de datos** con:

```sql
-- RPC accept_job en schema.sql usa:
SELECT * FROM jobs WHERE id = p_job_id FOR UPDATE NOWAIT;
```

- `FOR UPDATE` bloquea el row para la transacción
- `NOWAIT` falla inmediatamente si el row ya está bloqueado (vs esperar)
- Si dos trabajadores intentan aceptar al mismo tiempo, uno obtiene el lock y el otro recibe `"Este trabajo ya fue tomado"`
- La constraint `UNIQUE (job_id, worker_id)` previene duplicados a nivel DB

**Flujo de aceptación:**
1. App llama `supabase.rpc('accept_job', { p_job_id, p_worker_id })`
2. PostgreSQL ejecuta la función en una transacción serializada
3. Valida: status `open`, slots disponibles, worker aprobado
4. Crea `job_assignment`, incrementa `slots_taken`
5. Si `slots_taken >= required_workers` → cambia status a `'taken'`
6. Supabase Realtime publica el cambio → todos los clientes actualizan el feed instantáneamente

---

## 💳 Modelo de Pagos

```
Pago Total = $1,000
├── Plataforma (5%) = $50
└── Trabajador (95%) = $950
```

- Admin publica job con `pay_amount`
- Se calculan `platform_fee` y `worker_payout` automáticamente
- Edge Function `create-payment-intent` crea PaymentIntent con Stripe
- Stripe Connect transfiere directamente al account del trabajador
- En MVP/Test: todo se simula con tarjetas de prueba Stripe

---

## 👥 Roles y Permisos (RLS)

| Acción | Worker | Admin |
|---|---|---|
| Ver chambas abiertas | ✅ (solo aprobados) | ✅ |
| Aceptar chamba | ✅ (solo aprobados) | ❌ |
| Publicar chamba | ❌ | ✅ |
| Aprobar trabajadores | ❌ | ✅ |
| Ver todos los jobs | ❌ | ✅ |
| Ver dashboard stats | ❌ | ✅ |

---

## 🔄 Flujo de Onboarding

### Trabajador
1. Registro → selecciona rol "Trabajador"
2. **Estado: Pendiente** — no puede aceptar chambas
3. Admin lo aprueba en panel "Trabajadores"
4. **Estado: Aprobado** — ve el feed y puede aceptar

### Admin
1. Registro → selecciona rol "Empresa/Admin"
2. **Auto-aprobado** → accede directamente al dashboard
3. Publica chambas, gestiona trabajadores

---

## 📡 Realtime

Supabase Realtime está activo en las tablas:
- `jobs` → el feed se actualiza instantáneamente cuando se publica/toma una chamba
- `job_assignments` → historial de trabajos
- `notifications` → notificaciones en tiempo real

---

## 🧪 Usuarios de Prueba (después del seed)

| Rol | Email | Password |
|---|---|---|
| Admin | admin@chamba.com | Admin123! |
| Worker (aprobado) | worker1@chamba.com | Worker123! |
| Worker (pendiente) | worker2@chamba.com | Worker123! |

> Crear manualmente en Supabase Auth → luego ejecutar seed.sql

---

## 📦 Scripts

```bash
npm start          # Expo dev server
npm run android    # Android
npm run ios        # iOS
npm run lint       # ESLint
```

---

## 🔮 Roadmap Post-MVP

- [ ] Chat en tiempo real trabajador ↔ empresa
- [ ] Rating y reseñas bidireccionales
- [ ] Geofencing para confirmar llegada al trabajo
- [ ] Modo admin web (Next.js + Supabase)
- [ ] Onboarding con verificación de ID (Stripe Identity)
- [ ] Multi-idioma (i18n)
- [ ] Analytics con Amplitude/Mixpanel
#   C H A M B A 
 
 