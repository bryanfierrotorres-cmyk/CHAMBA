import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.1';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushPayload {
  user_ids: string[];
  title:    string;
  body:     string;
  data?:    Record<string, string>;
  type:     'new_job' | 'job_taken' | 'job_completed' | 'payment_sent';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const payload: PushPayload = await req.json();
    const { user_ids, title, body, data = {}, type } = payload;

    if (!user_ids?.length) throw new Error('No user_ids provided');

    // Get FCM tokens for all target users
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, fcm_token')
      .in('id', user_ids)
      .not('fcm_token', 'is', null);

    if (error) throw new Error(error.message);

    const expoPushTokens = (profiles ?? [])
      .map((p: any) => p.fcm_token)
      .filter(Boolean);

    if (!expoPushTokens.length) {
      return new Response(
        JSON.stringify({ sent: 0, message: 'No tokens found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Send via Expo Push Notification API
    const messages = expoPushTokens.map((token: string) => ({
      to:    token,
      title,
      body,
      data,
      sound: 'default',
      badge: 1,
    }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify(messages),
    });

    const result = await response.json();

    // Store notifications in DB
    const notifications = user_ids.map((userId) => ({
      user_id: userId,
      title,
      body,
      type,
      data,
      read: false,
    }));

    await supabase.from('notifications').insert(notifications);

    return new Response(
      JSON.stringify({ sent: expoPushTokens.length, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
