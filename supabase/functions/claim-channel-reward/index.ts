import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type TelegramUser = {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

const REWARD_STARS = 5;

const parseChannelUsername = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Channel is required');

  if (trimmed.startsWith('https://t.me/')) {
    const username = trimmed.replace('https://t.me/', '').split('/')[0];
    return username.startsWith('@') ? username : `@${username}`;
  }

  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
};

const parseTelegramUserFromInitData = (rawInitData: string | null): TelegramUser => {
  if (!rawInitData) return {};
  const params = new URLSearchParams(rawInitData);
  const userRaw = params.get('user');
  if (!userRaw) return {};

  try {
    return JSON.parse(userRaw) as TelegramUser;
  } catch {
    return {};
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!botToken || !supabaseUrl || !supabaseKey) {
      throw new Error('Server env is not configured');
    }

    const body = await req.json();
    const channel = parseChannelUsername(body.channel_url || body.channel || '');

    const headerInitData = req.headers.get('x-telegram-init-data');
    const parsedUser = parseTelegramUserFromInitData(headerInitData);
    const telegramId = String(body.telegram_id || parsedUser.id || '');
    if (!telegramId) throw new Error('telegram_id is required');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Ensure user exists and telegram_id is always stored in DB
    const { data: upsertUser, error: upsertErr } = await supabase
      .from('users')
      .upsert({
        telegram_id: telegramId,
        username: body.username || parsedUser.username || null,
        first_name: body.first_name || parsedUser.first_name || null,
        last_name: body.last_name || parsedUser.last_name || null,
      }, { onConflict: 'telegram_id' })
      .select('id, stars')
      .single();

    if (upsertErr || !upsertUser) {
      throw new Error(`User upsert failed: ${upsertErr?.message || 'unknown'}`);
    }

    // Verify channel subscription via Telegram Bot API
    const chatMemberResponse = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: channel,
        user_id: Number(telegramId),
      }),
    });

    const chatMemberResult = await chatMemberResponse.json();
    if (!chatMemberResult.ok) {
      throw new Error(
        `Cannot verify subscription for ${channel}. Add bot to channel admin list. Telegram says: ${chatMemberResult.description || 'unknown error'}`
      );
    }

    const status: string = chatMemberResult.result?.status || '';
    const allowedStatuses = new Set(['member', 'administrator', 'creator']);
    if (!allowedStatuses.has(status)) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: 'not_subscribed',
          message: `Подпишитесь на ${channel}, затем повторите`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: existingClaim } = await supabase
      .from('channel_reward_claims')
      .select('id')
      .eq('user_id', upsertUser.id)
      .eq('channel_username', channel)
      .maybeSingle();

    if (existingClaim) {
      return new Response(
        JSON.stringify({
          success: true,
          already_claimed: true,
          stars_added: 0,
          message: `Награда за ${channel} уже получена`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: claimErr } = await supabase
      .from('channel_reward_claims')
      .insert({
        user_id: upsertUser.id,
        channel_username: channel,
        stars_awarded: REWARD_STARS,
      });

    if (claimErr) {
      throw new Error(`Claim insert failed: ${claimErr.message}`);
    }

    const nextStars = (upsertUser.stars || 0) + REWARD_STARS;
    const { error: starsErr } = await supabase
      .from('users')
      .update({ stars: nextStars })
      .eq('id', upsertUser.id);

    if (starsErr) {
      throw new Error(`Stars update failed: ${starsErr.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        already_claimed: false,
        stars_added: REWARD_STARS,
        stars_balance: nextStars,
        message: `+${REWARD_STARS} ⭐ за подписку на ${channel}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
