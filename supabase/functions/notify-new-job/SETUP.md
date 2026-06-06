# notify-new-job — Configuración en Supabase

## Arquitectura recomendada

| Opción | Veredicto |
|--------|-----------|
| **Database Webhook → Edge Function** | ✅ **Recomendado.** Dispara siempre al `INSERT`, sin depender del cliente. |
| Invoke solo desde la app | ⚠️ Respaldo (ya existe en `createJob`). Puede fallar si el cliente cierra la app. |
| Trigger SQL + `pg_net` | ❌ Innecesario aquí; expone secretos y duplica lógica. |

Flujo:

```
INSERT jobs  →  Webhook Supabase  →  notify-new-job  →  send-push-notification  →  Expo API
                                                      ↘  profiles.fcm_token
```

---

## Paso 1 — Desplegar Edge Functions

Desde la raíz del repo (con [Supabase CLI](https://supabase.com/docs/guides/cli) instalada):

```bash
supabase login
supabase link --project-ref TU_PROJECT_REF

supabase functions deploy notify-new-job --no-verify-jwt
supabase functions deploy send-push-notification --no-verify-jwt
```

> `--no-verify-jwt` coincide con `verify_jwt = false` en `supabase/config.toml` (el webhook usa service role).

Variables que Supabase inyecta automáticamente en funciones:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

No hace falta configurarlas manualmente en el panel.

---

## Paso 2 — Aplicar migración SQL (índice + comentarios)

```bash
npm run db:apply-push-notify
```

O pega el contenido de `supabase/migrations/031_jobs_push_notify_setup.sql` en el SQL Editor.

---

## Paso 3 — Crear Database Webhook (panel Supabase)

1. Abre [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto.
2. **Database** → **Webhooks** → **Create a new hook**.
3. Configura:

| Campo | Valor |
|-------|--------|
| **Name** | `jobs-insert-notify-workers` |
| **Table** | `jobs` |
| **Events** | ☑️ **Insert** |
| **Type** | Supabase Edge Function |
| **Function** | `notify-new-job` |
| **HTTP method** | POST |
| **Timeout** | 5000 ms |

4. Guarda el webhook.

Supabase enviará un payload como:

```json
{
  "type": "INSERT",
  "table": "jobs",
  "schema": "public",
  "record": { "id": "...", "category": "limpieza_sofas", "title": "...", "status": "open" }
}
```

---

## Paso 4 — Probar

### A) Prueba manual (curl)

```bash
curl -X POST "https://TU_PROJECT_REF.supabase.co/functions/v1/notify-new-job" \
  -H "Authorization: Bearer TU_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "INSERT",
    "table": "jobs",
    "record": {
      "id": "00000000-0000-0000-0000-000000000099",
      "category": "limpieza_sofas",
      "title": "Profunda de Sofás",
      "status": "open"
    }
  }'
```

Respuesta esperada: `{ "notified": N, "title": "¡Nueva chamba disponible!", ... }`

### B) Prueba real

1. Técnico aprobado con `fcm_token` en `profiles` (abrir app en dispositivo físico).
2. Cliente publica una solicitud.
3. El técnico recibe push con:
   - **title:** `¡Nueva chamba disponible!`
   - **body:** `Se necesita Profunda de Sofás` (o título del job)

---

## Paso 5 — Logs y depuración

- **Edge Functions** → `notify-new-job` / `send-push-notification` → **Logs**
- Verifica que `profiles.fcm_token` empiece con `ExponentPushToken[`
- Expo Push Tool: https://expo.dev/notifications

---

## Respaldo cliente (sin webhook)

`createJob` en la app sigue invocando `notify-new-job` tras publicar. El webhook es la vía principal; la app es fallback.
