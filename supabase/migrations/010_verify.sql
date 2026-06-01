-- Verificación rápida (ejecutar al final de las 4 partes)

SELECT 'service_categories' AS tabla, COUNT(*)::int AS filas FROM service_categories
UNION ALL
SELECT 'service_types', COUNT(*)::int FROM service_types;

SELECT jsonb_array_length((get_active_catalog()->'categories')) AS categorias,
       jsonb_array_length((get_active_catalog()->'service_types')) AS tipos;
