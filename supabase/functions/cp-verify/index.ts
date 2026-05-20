// =============================================================================
// Postplan — cp-verify Edge Function (crosspromo verification)
// =============================================================================
// Runs on a schedule (every 15-30 min via cron-job.org). Two jobs:
//
//   1. PROMOTE scheduled → live:
//      For deals in 'scheduled' whose two scheduled_posts have both been sent
//      (telegram_message_id set), flip the deal to 'live' and record reach
//      baseline. If publish time passed but a side never sent → it's a breach.
//
//   2. VERIFY live → completed/failed:
//      For deals in 'live' whose min_hold_hours have elapsed, check that BOTH
//      posts are still present on t.me (not deleted early) and read final reach
//      via the public embed (un-fakeable). Then recompute both channels'
//      reputation via the cp_recompute_reputation RPC.
//
// Deploy:
//   supabase functions deploy cp-verify --no-verify-jwt
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';

const TME_BASE = 'https://t.me';
const USER_AGENT = 'Mozilla/5.0 (compatible; PostplanBot/1.0; +https://postplan-tg.ru)';
const BATCH = 40;

function getSupabaseEnv() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('POSTPLAN_SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('POSTPLAN_SERVICE_ROLE_KEY');
  return { supabaseUrl, serviceKey };
}

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function parseViewsString(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s+/g, '').replace(',', '.');
  const m = cleaned.match(/^([\d.]+)\s*([KMB])?$/i);
  if (!m) return null;
  const base = parseFloat(m[1]);
  if (!Number.isFinite(base)) return null;
  const suffix = m[2]?.toUpperCase();
  const mult = suffix === 'K' ? 1e3 : suffix === 'M' ? 1e6 : suffix === 'B' ? 1e9 : 1;
  return Math.round(base * mult);
}

// Returns { exists, views }. exists=false means the post is gone (deleted early).
async function checkPost(
  username: string | null,
  messageId: number | null,
): Promise<{ exists: boolean; views: number | null }> {
  if (!username || !messageId) return { exists: false, views: null };
  const cleaned = username.replace(/^@/, '');
  const url = `${TME_BASE}/${cleaned}/${messageId}?embed=1&mode=tme`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return { exists: false, views: null };
    if (!res.ok) return { exists: true, views: null }; // transient; treat as still present
    const html = await res.text();
    // A deleted post's embed page typically lacks the message body wrapper.
    const present = /tgme_widget_message(\s|_|")/.test(html);
    const vm = html.match(/<span[^>]*class="[^"]*tgme_widget_message_views[^"]*"[^>]*>([^<]+)<\/span>/i);
    const views = vm ? parseViewsString(vm[1]) : null;
    return { exists: present, views };
  } catch {
    return { exists: true, views: null }; // network error → don't punish, retry later
  }
}

interface SchedRef {
  telegram_message_id: number | null;
  status: string;
  sent_at: string | null;
  channels: { username: string | null } | { username: string | null }[] | null;
}
interface DealRow {
  id: string;
  status: string;
  publish_at: string | null;
  min_hold_hours: number;
  initiator_channel_id: string;
  partner_channel_id: string;
  initiator_scheduled_post_id: string | null;
  partner_scheduled_post_id: string | null;
  init_sched: SchedRef | SchedRef[] | null;
  partner_sched: SchedRef | SchedRef[] | null;
}

Deno.serve(async (_req) => {
  const startedAt = Date.now();
  const { supabaseUrl, serviceKey } = getSupabaseEnv();
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing Supabase env' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: deals, error } = await supabase
    .from('cp_deals')
    .select(`
      id, status, publish_at, min_hold_hours,
      initiator_channel_id, partner_channel_id,
      initiator_scheduled_post_id, partner_scheduled_post_id,
      init_sched:scheduled_posts!cp_deals_initiator_scheduled_post_id_fkey (
        telegram_message_id, status, sent_at, channels ( username )
      ),
      partner_sched:scheduled_posts!cp_deals_partner_scheduled_post_id_fkey (
        telegram_message_id, status, sent_at, channels ( username )
      )
    `)
    .in('status', ['scheduled', 'live'])
    .limit(BATCH);

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let promoted = 0;
  let completed = 0;
  let failed = 0;
  const channelsToRecompute = new Set<string>();

  for (const d of (deals ?? []) as unknown as DealRow[]) {
    const initSched = pickOne(d.init_sched);
    const partnerSched = pickOne(d.partner_sched);
    const initSent = initSched?.status === 'sent' && initSched?.telegram_message_id != null;
    const partnerSent = partnerSched?.status === 'sent' && partnerSched?.telegram_message_id != null;
    const publishPassed = d.publish_at ? new Date(d.publish_at).getTime() < Date.now() : false;

    // ---- scheduled → live / failed ----
    if (d.status === 'scheduled') {
      if (initSent && partnerSent) {
        await supabase.from('cp_deals').update({ status: 'live' }).eq('id', d.id);
        promoted++;
      } else if (publishPassed) {
        // Give a 2h grace after publish_at before declaring a breach
        const graceMs = 2 * 60 * 60 * 1000;
        if (Date.now() - new Date(d.publish_at!).getTime() > graceMs) {
          await supabase
            .from('cp_deals')
            .update({
              status: 'failed',
              initiator_delivered: initSent,
              partner_delivered: partnerSent,
              verified_at: new Date().toISOString(),
            })
            .eq('id', d.id);
          channelsToRecompute.add(d.initiator_channel_id);
          channelsToRecompute.add(d.partner_channel_id);
          failed++;
        }
      }
      continue;
    }

    // ---- live → completed / failed ----
    if (d.status === 'live') {
      // Has the hold window elapsed? Measure from the later of the two sent_at.
      const sentTimes = [initSched?.sent_at, partnerSched?.sent_at]
        .filter(Boolean)
        .map((s) => new Date(s as string).getTime());
      const liveSince = sentTimes.length ? Math.max(...sentTimes) : Date.now();
      const holdMs = d.min_hold_hours * 60 * 60 * 1000;
      if (Date.now() - liveSince < holdMs) continue; // not yet time to verify

      const initChannel = pickOne(initSched?.channels);
      const partnerChannel = pickOne(partnerSched?.channels);

      const initCheck = await checkPost(initChannel?.username ?? null, initSched?.telegram_message_id ?? null);
      const partnerCheck = await checkPost(partnerChannel?.username ?? null, partnerSched?.telegram_message_id ?? null);

      const bothHeld = initCheck.exists && partnerCheck.exists;
      const status = bothHeld ? 'completed' : 'failed';

      await supabase
        .from('cp_deals')
        .update({
          status,
          initiator_delivered: true,
          partner_delivered: true,
          initiator_held_full: initCheck.exists,
          partner_held_full: partnerCheck.exists,
          initiator_reach: initCheck.views,
          partner_reach: partnerCheck.views,
          verified_at: new Date().toISOString(),
        })
        .eq('id', d.id);

      channelsToRecompute.add(d.initiator_channel_id);
      channelsToRecompute.add(d.partner_channel_id);
      if (bothHeld) completed++;
      else failed++;
    }
  }

  // Recompute reputation for every affected channel
  for (const channelId of channelsToRecompute) {
    await supabase.rpc('cp_recompute_reputation', { p_channel_id: channelId });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      promoted,
      completed,
      failed,
      recomputed: channelsToRecompute.size,
      ms: Date.now() - startedAt,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
