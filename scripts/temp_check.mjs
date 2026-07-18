import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function loadEnv() {
  const p = join(process.cwd(), '.env');
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();
const sbAdmin = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  // Login admin to bypass RLS if there are policies
  const { data: adminAuth } = await sbAdmin.auth.signInWithPassword({
    email: 'admin@chamba.com', password: 'Admin1234!'
  });
  
  const workerA = '12ec6aa9-8a36-406b-a017-a9c3b865230e';
  
  const { data: assignmentsBefore } = await sbAdmin.from('job_assignments').select('id, job_id').eq('worker_id', workerA);
  console.log('Assignments before:', assignmentsBefore);

  const { data: jobsBefore } = await sbAdmin.from('jobs').select('id, status, assigned_worker_id').eq('assigned_worker_id', workerA);
  console.log('Jobs before:', jobsBefore);
  
  // Try deleting them via Supabase API
  if (assignmentsBefore?.length) {
    const { error: asgnErr } = await sbAdmin.from('job_assignments').delete().in('id', assignmentsBefore.map(a => a.id));
    console.log('Delete assignments error:', asgnErr);
  }
  
  if (jobsBefore?.length) {
    const { error: jobsErr } = await sbAdmin.from('jobs').delete().in('id', jobsBefore.map(j => j.id));
    console.log('Delete jobs error:', jobsErr);
  }
  
  const { data: countData } = await sbAdmin.rpc('count_worker_active_commitments', { p_worker_id: workerA });
  console.log('Active count after delete:', countData);
})();
