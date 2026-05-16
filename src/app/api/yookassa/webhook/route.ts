/**
 * YooKassa webhook receiver.
 *
 * YooKassa POSTs here on these events (configurable in the dashboard):
 *   payment.succeeded     — user paid, money captured. THIS IS THE ONE THAT MATTERS.
 *   payment.canceled      — user cancelled or auth failed
 *   payment.waiting_for_capture — only relevant if we don't auto-capture (we do)
 *   refund.succeeded      — refund completed (we don't auto-handle this yet)
 *
 * Auth: HTTP Basic — set in YooKassa dashboard, matched against
 *       env YOOKASSA_WEBHOOK_BASIC_AUTH ("user:pass").
 *
 * Idempotence: each event has `object.id` (the payment id). If we've already
 * processed a webhook for this payment with the same status, we no-op.
 *
 * Use service-role client because RLS would block the webhook from updating
 * other users' rows. The webhook is server-only and authenticated via Basic.
 */

import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { verifyWebhookAuth } from '@/lib/yookassa';
import type { SubscriptionTier } from '@/lib/tiers';

interface YooKassaEvent {
  type: 'notification';
  event: 'payment.succeeded' | 'payment.canceled' | 'payment.waiting_for_capture' | 'refund.succeeded';
  object: {
    id: string;
    status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';
    amount: { value: string; currency: string };
    paid: boolean;
    payment_method?: { type: string; id: string; saved: boolean };
    cancellation_details?: { party: string; reason: string };
    metadata?: Record<string, string>;
  };
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env not configured');
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: Request) {
  // 1. Verify webhook authentication
  const authHeader = request.headers.get('authorization');
  if (!verifyWebhookAuth(authHeader)) {
    console.warn('YooKassa webhook: auth failed');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse body
  let body: YooKassaEvent;
  try {
    body = (await request.json()) as YooKassaEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body.type !== 'notification') {
    return NextResponse.json({ error: 'Unexpected type' }, { status: 400 });
  }

  console.log(`YooKassa webhook received: ${body.event} for payment ${body.object.id}`);

  const supabase = getServiceClient();

  // 3. Find our payment row by yookassa_payment_id
  const { data: payment, error: findErr } = await supabase
    .from('payments')
    .select('id, user_id, tier, period_days, status, webhook_received_at')
    .eq('yookassa_payment_id', body.object.id)
    .single();

  if (findErr || !payment) {
    // We didn't create this payment, OR there's a race between create and webhook.
    // Try the metadata fallback (we put our payment id there during creation).
    const ourPaymentId = body.object.metadata?.postplan_payment_id;
    if (ourPaymentId) {
      const { data: byMeta } = await supabase
        .from('payments')
        .select('id, user_id, tier, period_days, status, webhook_received_at')
        .eq('id', ourPaymentId)
        .single();
      if (!byMeta) {
        console.error(`YooKassa webhook: payment ${body.object.id} not found in DB`);
        return NextResponse.json({ ok: true }); // ack so YooKassa stops retrying
      }
      // Use byMeta and continue — backfill yookassa_payment_id
      await supabase
        .from('payments')
        .update({ yookassa_payment_id: body.object.id })
        .eq('id', byMeta.id);
      return await handleEvent(supabase, byMeta, body);
    }
    console.error(`YooKassa webhook: payment ${body.object.id} not found and no metadata`);
    return NextResponse.json({ ok: true });
  }

  return await handleEvent(supabase, payment, body);
}

async function handleEvent(
  supabase: ReturnType<typeof getServiceClient>,
  payment: {
    id: string;
    user_id: string;
    tier: SubscriptionTier;
    period_days: number;
    status: string;
    webhook_received_at: string | null;
  },
  body: YooKassaEvent
) {
  // Idempotence: if already processed at this status, skip side effects but ack
  if (payment.status === body.object.status && payment.webhook_received_at) {
    console.log(`YooKassa webhook: payment ${body.object.id} already at status ${body.object.status}`);
    return NextResponse.json({ ok: true });
  }

  const now = new Date().toISOString();

  // Update payment row regardless of event type
  await supabase
    .from('payments')
    .update({
      status: body.object.status,
      paid: body.object.paid,
      payment_method_type: body.object.payment_method?.type ?? null,
      cancellation_reason: body.object.cancellation_details?.reason ?? null,
      webhook_received_at: now,
    })
    .eq('id', payment.id);

  // The only event that grants subscription access is payment.succeeded
  if (body.event !== 'payment.succeeded') {
    return NextResponse.json({ ok: true });
  }

  // 4. Activate / extend subscription
  // Strategy:
  //   - If user has an active paid sub, extend its expiry by period_days from CURRENT expiry
  //     (so they don't lose unused days when paying early to renew)
  //   - Otherwise, set expiry = now + period_days
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier, subscription_expires_at')
    .eq('id', payment.user_id)
    .single();

  const newExpiryStart =
    profile?.subscription_expires_at &&
    new Date(profile.subscription_expires_at).getTime() > Date.now()
      ? new Date(profile.subscription_expires_at)
      : new Date();
  const newExpiry = new Date(newExpiryStart.getTime() + payment.period_days * 24 * 60 * 60 * 1000);

  const { error: profErr } = await supabase
    .from('profiles')
    .update({
      subscription_tier: payment.tier,
      subscription_expires_at: newExpiry.toISOString(),
    })
    .eq('id', payment.user_id);

  if (profErr) {
    console.error('YooKassa webhook: failed to update profile', profErr);
    // Return 500 so YooKassa retries — our DB had a transient issue
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  console.log(
    `Subscription activated: user ${payment.user_id} → ${payment.tier} until ${newExpiry.toISOString()}`
  );

  return NextResponse.json({ ok: true });
}

// YooKassa expects 2xx within ~10s. Non-2xx triggers retries (up to 24h).
// We always return 200 except on auth failure, even on internal errors that
// aren't worth retrying (missing payment row → 200 to drop it).
export async function GET() {
  // Health check / debug — useful when configuring the webhook in dashboard
  return NextResponse.json({ ok: true, message: 'Postplan YooKassa webhook' });
}
