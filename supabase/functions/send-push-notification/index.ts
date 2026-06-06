import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.1';
import type { ExpoPushMessage, SendPushPayload } from '../_shared/jobNotifyTypes.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ProfileTokenRow {
  id: string;
  fcm_token: string | null;
}

interface ExpoPushTicket {
  status?: string;
  message?: string;
  details?: unknown;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const payload = (await req.json()) as SendPushPayload;
    const { user_ids, title, body, data = {}, type } = payload;

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      throw new Error('No user_ids provided');
    }
    if (!title?.trim() || !body?.trim()) {
      throw new Error('title and body are required');
    }

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, fcm_token')
      .in('id', user_ids)
      .not('fcm_token', 'is', null);

    if (profilesError) {
      throw new Error(profilesError.message);
    }

    const expoPushTokens = (profiles ?? [])
      .map((profile: ProfileTokenRow) => profile.fcm_token?.trim())
      .filter((token): token is string => Boolean(token));

    if (expoPushTokens.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: 'No tokens found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const messages: ExpoPushMessage[] = expoPushTokens.map((token) => ({
      to: token,
      title: title.trim(),
      body: body.trim(),
      data,
      sound: 'default',
      badge: 1,
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = (await response.json()) as { data?: ExpoPushTicket[] } | ExpoPushTicket[];

    if (!response.ok) {
      throw new Error(`Expo push API error: ${response.status}`);
    }

    const notifications = user_ids.map((userId) => ({
      user_id: userId,
      title: title.trim(),
      body: body.trim(),
      type,
      data,
      read: false,
    }));

    const { error: insertError } = await supabase.from('notifications').insert(notifications);
    if (insertError) {
      console.warn('[send-push-notification] notifications insert:', insertError.message);
    }

    return new Response(
      JSON.stringify({ sent: expoPushTokens.length, result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
