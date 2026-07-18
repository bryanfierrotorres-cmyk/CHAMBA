require('dotenv').config();
const { Client } = require('pg');

async function readRPC() {
  let dbUrl = process.env.SUPABASE_DB_URL;
  if (dbUrl && dbUrl.includes('[PASSWORD]')) {
    console.error("ERROR: SUPABASE_DB_URL tiene '[PASSWORD]' en .env, por lo que no puedo conectar.");
    process.exit(1);
  }
  
  const client = new Client({ connectionString: dbUrl });
  
  try {
    await client.connect();
    const res = await client.query(`
      SELECT pg_get_functiondef(p.oid) AS prosrc
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE p.proname = 'get_client_orders_panel' AND n.nspname = 'public';
    `);
    
    if (res.rows.length > 0) {
      console.log(res.rows[0].prosrc);
    } else {
      console.log("No se encontró la función get_client_orders_panel.");
    }
  } catch (err) {
    console.error("Error connecting to db:", err);
  } finally {
    await client.end();
  }
}

readRPC();
