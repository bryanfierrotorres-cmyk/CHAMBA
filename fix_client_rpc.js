// Script para arreglar el RPC get_client_orders_panel
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'TU_URL';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || 'TU_SERVICE_ROLE_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixClientOrdersRPC() {
  console.log('Generando script SQL para arreglar get_client_orders_panel...');

  const sqlFix = `
    CREATE OR REPLACE FUNCTION get_client_orders_panel(p_client_id UUID)
    RETURNS JSON AS $$
    DECLARE
      v_result JSON;
    BEGIN
      -- Se ha añadido j.created_at y todas las columnas relevantes de 'jobs' al GROUP BY
      -- para evitar el error: "column j.created_at must appear in the GROUP BY clause"
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'id', j.id,
            'status', j.status,
            'title', j.title,
            'description', j.description,
            'price', j.price,
            'category', j.category,
            'location', j.location,
            'created_at', j.created_at,
            'updated_at', j.updated_at,
            'assigned_worker_id', j.assigned_worker_id,
            'assigned_worker', CASE 
              WHEN j.assigned_worker_id IS NOT NULL THEN (
                SELECT json_build_object(
                  'id', p.id,
                  'full_name', p.full_name,
                  'avatar_url', p.avatar_url,
                  'phone', p.phone
                )
                FROM profiles p WHERE p.id = j.assigned_worker_id
              )
              ELSE NULL
            END,
            'applications_count', COUNT(ja.id)
          )
        ),
        '[]'::json
      )
      INTO v_result
      FROM jobs j
      LEFT JOIN job_worker_applications ja ON ja.job_id = j.id
      WHERE j.created_by = p_client_id
      GROUP BY j.id, j.status, j.title, j.description, j.price, j.category, j.location, j.created_at, j.updated_at, j.assigned_worker_id
      ORDER BY j.created_at DESC;

      RETURN v_result;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

  console.log("=== EJECUTA ESTE SQL EN EL SQL EDITOR DE TU PANEL DE SUPABASE ===");
  console.log(sqlFix);
  console.log("=================================================================");
  console.log("Nota: El error 400 (Bad Request) que ves en consola se debe a que la consulta SQL");
  console.log("dentro de la función get_client_orders_panel en tu base de datos utiliza una agregación");
  console.log("como COUNT() sin agrupar correctamente la columna j.created_at.");
}

fixClientOrdersRPC();
