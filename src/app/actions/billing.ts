'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireUser, getProfile } from '@/lib/auth/helpers';
import { createYooKassaPayment } from '@/lib/yookassa';
import { TIERS, getEffectivePrice, type SubscriptionTier } from '@/lib/tiers';

export type CreatePaymentResult =
  | { error: string }
  | { confirmation_url: string; payment_id: string };

/**
 * Create a YooKassa payment for the requested tier upgrade and return the
 * confirmation URL. The client redirects the user there to complete payment.
 *
 * Flow:
 *   1. User clicks "Перейти на Базовый" on /dashboard/billing
 *   2. Server creates a YooKassa payment + a row in `payments` (status='pending')
 *   3. Server returns confirmation_url
 *   4. Client redirects user to YooKassa
 *   5. User pays → YooKassa sends webhook to /api/yookassa/webhook
 *   6. Webhook handler upgrades the user's profile and marks payment 'succeeded'
 *   7. YooKassa redirects user back to /dashboard/billing/success
 */
export async function createPaymentAction(
  tier: SubscriptionTier
): Promise<CreatePaymentResult> {
  const user = await requireUser();
  const profile = await getProfile();

  // Disallow paying for Free
  if (tier === 'free') {
    return { error: 'Free тариф не оплачивается' };
  }

  const tierConfig = TIERS[tier];
  if (!tierConfig || tierConfig.priceRub <= 0) {
    return { error: 'Неверный тариф' };
  }

  // Charge the regular tariff price. Promo is disabled.
  const effective = getEffectivePrice(tier, profile.created_at);
  const chargeAmount = effective.priceRub;

  const supabase = await createClient();

  // Insert a `payments` row first — gives us idempotence key + persistent record
  // even if YooKassa call fails midway.
  const { data: paymentRow, error: insertErr } = await supabase
    .from('payments')
    .insert({
      user_id: user.id,
      tier,
      period_days: 30,
      amount_rub: chargeAmount,
      currency: 'RUB',
      status: 'pending',
    })
    .select('id, idempotence_key')
    .single();

  if (insertErr || !paymentRow) {
    return { error: insertErr?.message ?? 'Не удалось создать платёж' };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const returnUrl = `${appUrl}/dashboard/billing/success?payment_id=${paymentRow.id}`;
  const description = `Постплан · тариф ${tierConfig.name} · 30 дней`;

  let yk;
  try {
    yk = await createYooKassaPayment({
      amountRub: chargeAmount,
      description,
      returnUrl,
      idempotenceKey: paymentRow.idempotence_key,
      customerEmail: profile.email ?? undefined,
      metadata: {
        // Echoed back in webhook — lets us match payment without DB lookup
        postplan_payment_id: paymentRow.id,
        postplan_user_id: user.id,
        postplan_tier: tier,
        postplan_is_promo: '0',
      },
    });
  } catch (e) {
    // Mark the payment row failed so user can retry
    const errMsg = e instanceof Error ? e.message : 'unknown error';
    await supabase
      .from('payments')
      .update({ status: 'canceled', error_message: errMsg })
      .eq('id', paymentRow.id);
    return { error: `Не удалось создать платёж: ${errMsg}` };
  }

  // Save the YooKassa payment id and confirmation_url
  await supabase
    .from('payments')
    .update({
      yookassa_payment_id: yk.id,
      confirmation_url: yk.confirmation?.confirmation_url ?? null,
      status: yk.status,
    })
    .eq('id', paymentRow.id);

  if (!yk.confirmation?.confirmation_url) {
    return { error: 'YooKassa не вернула URL для оплаты' };
  }

  return {
    confirmation_url: yk.confirmation.confirmation_url,
    payment_id: paymentRow.id,
  };
}
