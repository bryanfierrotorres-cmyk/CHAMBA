import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
// We need the service role key to bypass RLS for quick seeding
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, serviceKey);

async function seed() {
  console.log('🌱 Starting Trust Ecosystem Seed...');

  // 1. Create client and technician profiles directly in 'profiles'
  // Using gen_random_uuid() is tricky from JS, let's let postgres do it or use specific ids.
  // Actually, we'll insert and return the rows.
  
  const { data: profiles, error: pErr } = await supabase.from('profiles').insert([
    { full_name: 'Cliente Prueba 123', phone: '12340001', role: 'client' },
    { full_name: 'Técnico Prueba 123', phone: '12340002', role: 'worker', is_approved: true, avatar_url: 'https://i.pravatar.cc/300?img=11' }
  ]).select();

  if (pErr) throw new Error(`Profiles Error: ${pErr.message}`);
  
  const client = profiles.find(p => p.role === 'client');
  const worker = profiles.find(p => p.role === 'worker');

  console.log('✅ Created Profiles:', { client: client.id, worker: worker.id });

  // 2. Insert into worker_profiles with last_location_at = NOW() and id_verified = true
  const { error: wpErr } = await supabase.from('worker_profiles').insert({
    worker_id: worker.id,
    id_verified: true, // Sello Chamba
    last_location_at: new Date().toISOString() // 🟢 Disponible ahora
  });

  if (wpErr) throw new Error(`Worker Profiles Error: ${wpErr.message}`);

  console.log('✅ Created Worker Profile');

  // 3. Create 3 completed jobs
  const jobsToInsert = [1, 2, 3].map(i => ({
    title: `Trabajo Completo ${i}`,
    description: 'Reparación completa en casa',
    category: 'limpieza',
    status: 'completed',
    operational_phase: 'completed',
    pay_amount: 500,
    created_by: client.id,
    assigned_worker_id: worker.id
  }));

  const { data: jobs, error: jErr } = await supabase.from('jobs').insert(jobsToInsert).select();
  if (jErr) throw new Error(`Jobs Error: ${jErr.message}`);

  console.log('✅ Created 3 Completed Jobs');

  // 4. Create 3 job_assignments
  const assignmentsToInsert = jobs.map(j => ({
    job_id: j.id,
    worker_id: worker.id,
    selection_status: 'approved',
    completed_at: new Date().toISOString()
  }));

  const { error: aErr } = await supabase.from('job_assignments').insert(assignmentsToInsert);
  if (aErr) throw new Error(`Assignments Error: ${aErr.message}`);

  console.log('✅ Created 3 Job Assignments (This should trigger total_jobs_done recalc)');

  // 5. Create 2 worker_reviews
  const reviewsToInsert = [
    {
      worker_id: worker.id,
      reviewer_id: client.id,
      reviewer_role: 'client',
      rating: 5,
      comment: '¡Excelente trabajo! Muy puntual y profesional. Totalmente recomendado.'
    },
    // We need a second reviewer because of UNIQUE(worker_id, reviewer_id)
    // We will create another client just for this
  ];

  const { data: client2, error: c2Err } = await supabase.from('profiles').insert({
    full_name: 'Cliente Prueba 456', phone: '12340003', role: 'client'
  }).select().single();

  if (c2Err) throw new Error(`Client 2 Error: ${c2Err.message}`);

  reviewsToInsert.push({
    worker_id: worker.id,
    reviewer_id: client2.id,
    reviewer_role: 'client',
    rating: 4,
    comment: 'Buen trabajo, pero llegó 10 minutos tarde. De todos modos lo volvería a contratar.'
  });

  const { error: rErr } = await supabase.from('worker_reviews').insert(reviewsToInsert);
  if (rErr) throw new Error(`Reviews Error: ${rErr.message}`);

  console.log('✅ Created 2 Reviews (This should trigger rating_avg recalc)');

  // 6. Verify Results
  console.log('🔍 Verifying Results...');
  const { data: wProfile } = await supabase.from('worker_profiles').select('*').eq('worker_id', worker.id).single();
  console.log('   - total_jobs_done:', wProfile.total_jobs_done, '(Expected: 3)');
  console.log('   - rating_avg:', wProfile.rating_avg, '(Expected: 4.50)');
  console.log('   - total_reviews:', wProfile.total_reviews, '(Expected: 2)');
  console.log('   - id_verified:', wProfile.id_verified, '(Expected: true)');

  const { data: stats } = await supabase.rpc('get_worker_reviews_stats', { p_worker_id: worker.id });
  console.log('   - stats RPC:', stats);

  console.log('🎉 Seed Completed Successfully!');
  console.log(`\n👉 USE THIS WORKER ID FOR UI TESTING: ${worker.id}\n`);
}

seed().catch(err => {
  console.error('❌ Seed Failed:', err.message);
  process.exit(1);
});
