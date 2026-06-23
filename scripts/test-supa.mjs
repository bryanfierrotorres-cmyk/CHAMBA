import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function loadEnv() {
  const envPath = join(process.cwd(), '.env');
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
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, anonKey);

async function test() {
  // Login as worker
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: '84888888@phone.chamba.local',
    password: 'ChambaTest123!',
  });

  if (authError) {
    console.error('Auth Error:', authError.message);
    return;
  }
  console.log('Logged in as:', authData.user?.id);

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', authData.user.id).single();
  console.log('Profile:', profile);

  // Try to read jobs
  const { data: jobs, error: jobsError } = await supabase.from('jobs').select('*').eq('status', 'taken');
  if (jobsError) {
    console.error('Jobs Error:', jobsError.message);
  } else {
    console.log('Jobs fetched:', jobs);
  }

  // Try the RPC that fetches the job directly if needed
  if (jobs && jobs.length > 0) {
    const jobId = jobs[0].id;
    console.log('Testing RPC for job:', jobId);
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_job_chat_messages', {
      p_servicio_id: jobId,
      p_caller_id: authData.user.id,
    });
    console.log('RPC Error:', rpcError?.message);
    console.log('RPC Data:', rpcData);
  }
}

test();
