const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://xvolxgonpjzjkytpsmil.supabase.co';
const supabaseKey = 'sb_publishable_uhhzt2htaTjd2BmCOJn80g__R-_shQZ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('--- ÚLTIMOS 3 TRABAJOS ---');
  const { data: jobs, error: errJobs } = await supabase.from('jobs').select('id, title, category, status, created_at').order('created_at', { ascending: false }).limit(3);
  if(errJobs) console.error(errJobs);
  else console.table(jobs);

  console.log('\n--- ÚLTIMOS PERFILES ---');
  const { data: profiles, error: errProfiles } = await supabase.from('profiles').select('id, full_name, phone, role, is_approved, category_1, category_2, category_1_approved').order('created_at', { ascending: false }).limit(5);
  if(errProfiles) console.error(errProfiles);
  else console.table(profiles);
}
check();
