const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!connectionString || connectionString.includes('[PASSWORD]')) {
  console.error('❌ ERROR: Debes configurar SUPABASE_DB_URL en el archivo .env con tu contraseña real.');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log('✅ Conectado a Supabase PostgreSQL.');

    console.log('1️⃣  Creando bucket "avatars"...');
    await client.query(`
      INSERT INTO storage.buckets (id, name, public) 
      VALUES ('avatars', 'avatars', true) 
      ON CONFLICT (id) DO UPDATE SET public = true;
    `);
    console.log('✅ Bucket "avatars" creado y configurado como público.');

    console.log('2️⃣  Configurando políticas RLS para el bucket "avatars"...');
    // Política de lectura pública
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access for Avatars' AND tablename = 'objects' AND schemaname = 'storage') THEN
          CREATE POLICY "Public Access for Avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
        END IF;
      END
      $$;
    `);

    // Política de subida para autenticados
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated Uploads' AND tablename = 'objects' AND schemaname = 'storage') THEN
          CREATE POLICY "Authenticated Uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
        END IF;
      END
      $$;
    `);

    // Política de actualización para autenticados
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated Updates' AND tablename = 'objects' AND schemaname = 'storage') THEN
          CREATE POLICY "Authenticated Updates" ON storage.objects FOR UPDATE WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
        END IF;
      END
      $$;
    `);

    console.log('✅ Políticas RLS de Storage configuradas con éxito.');
    console.log('🎉 ¡Todo listo! Intenta subir una foto en la app ahora.');

  } catch (err) {
    console.error('❌ Error de base de datos:', err);
  } finally {
    await client.end();
  }
}

run();
