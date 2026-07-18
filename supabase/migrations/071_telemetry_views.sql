-- CHAMBA 071 — Telemetry SQL Views

-- 1. Vista de Salud de la Oferta (Supply Health)
-- Clasifica a los técnicos activos según su 'last_active_at' y si están asignados a un trabajo abierto.
CREATE OR REPLACE VIEW view_telemetry_supply_health AS
WITH WorkerStates AS (
  SELECT 
    wp.worker_id as id,
    CASE
      WHEN wp.availability_status::text = 'offline' THEN 'offline'
      WHEN EXISTS (
        SELECT 1 FROM jobs j 
        WHERE j.assigned_worker_id = wp.worker_id AND j.status IN ('taken', 'in_progress', 'arrived')
      ) THEN 'in_service'
      WHEN wp.last_location_at >= NOW() - INTERVAL '15 minutes' THEN 'online'
      WHEN wp.last_location_at >= NOW() - INTERVAL '60 minutes' THEN 'idle'
      ELSE 'offline'
    END as current_state
  FROM worker_profiles wp
)
SELECT 
  current_state,
  COUNT(*) as worker_count
FROM WorkerStates
GROUP BY current_state;

-- 2. Vista de Rendimiento de Emparejamiento (Matching Performance)
-- Mide los tiempos de aceptación, la ola que tomó la chamba y la conversión por tipo.
CREATE OR REPLACE VIEW view_telemetry_matching_performance AS
WITH JobMetrics AS (
  SELECT 
    j.id,
    j.booking_type,
    j.status,
    EXTRACT(EPOCH FROM (j.updated_at - j.created_at)) as seconds_to_accept,
    -- Aquí estimamos la ola basada en el tiempo de aceptación.
    -- (W1: 0-10s, W2: 10-40s, W3: 40-90s, Fallback: >90s)
    CASE 
      WHEN EXTRACT(EPOCH FROM (j.updated_at - j.created_at)) <= 10 THEN 'Wave 1'
      WHEN EXTRACT(EPOCH FROM (j.updated_at - j.created_at)) <= 40 THEN 'Wave 2'
      WHEN EXTRACT(EPOCH FROM (j.updated_at - j.created_at)) <= 90 THEN 'Wave 3'
      ELSE 'Fallback Wave'
    END as assigned_wave
  FROM jobs j
  WHERE j.status IN ('taken', 'completed', 'in_progress', 'cancelled_by_client', 'cancelled_by_worker')
)
SELECT 
  booking_type,
  COUNT(id) as total_requests,
  SUM(CASE WHEN status IN ('taken', 'completed', 'in_progress') THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(id), 0) as conversion_rate,
  AVG(CASE WHEN status IN ('taken', 'completed', 'in_progress') THEN seconds_to_accept ELSE NULL END) as avg_time_to_accept,
  SUM(CASE WHEN assigned_wave = 'Wave 1' AND status IN ('taken', 'completed', 'in_progress') THEN 1 ELSE 0 END) as w1_success,
  SUM(CASE WHEN assigned_wave = 'Wave 2' AND status IN ('taken', 'completed', 'in_progress') THEN 1 ELSE 0 END) as w2_success,
  SUM(CASE WHEN assigned_wave = 'Wave 3' AND status IN ('taken', 'completed', 'in_progress') THEN 1 ELSE 0 END) as w3_success,
  SUM(CASE WHEN assigned_wave = 'Fallback Wave' AND status IN ('taken', 'completed', 'in_progress') THEN 1 ELSE 0 END) as w4_success
FROM JobMetrics
GROUP BY booking_type;

-- Permitir lectura anónima/autenticada para el dashboard de telemetría
GRANT SELECT ON view_telemetry_supply_health TO anon, authenticated;
GRANT SELECT ON view_telemetry_matching_performance TO anon, authenticated;
