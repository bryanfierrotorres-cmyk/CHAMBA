const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!connectionString || connectionString.includes('[PASSWORD]')) {
  console.error("❌ ERROR: No se encontró la URL de conexión a la base de datos válida en el .env");
  console.error("⚠️  Asegúrate de reemplazar [PASSWORD] por tu contraseña real en el archivo .env");
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false } // Requerido para conexiones a Supabase
});

const sql = `
  -- Primero eliminamos la política si ya existe para evitar errores de duplicidad
  DROP POLICY IF EXISTS "Clientes pueden cancelar solo trabajos pendientes" ON public.jobs;
  
  -- Creamos la política blindada
  CREATE POLICY "Clientes pueden cancelar solo trabajos pendientes" 
  ON public.jobs 
  FOR UPDATE 
  USING (
    auth.uid() = created_by AND 
    status = 'open'
  )
  WITH CHECK (
    status = 'cancelled'
  );
`;

async function applyRLS() {
  try {
    await client.connect();
    console.log("Conectado a PostgreSQL...");
    await client.query(sql);
    console.log("✅ Política RLS inyectada exitosamente en public.jobs");
  } catch (err) {
    console.error("❌ Error inyectando RLS:", err.message);
  } finally {
    await client.end();
  }
}

applyRLS();
