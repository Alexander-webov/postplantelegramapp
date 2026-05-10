import Link from 'next/link';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/helpers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TIERS, type SubscriptionTier } from '@/lib/tiers';
import { LocalTimeLabel } from '@/components/dashboard/local-time-label';

export const metadata = { title: 'Оплата' };

interface PageProps {
  searchParams: Promise<{ payment_id?: string }>;
}

export default async function SuccessPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const paymentId = params.payment_id;

  const user = await requireUser();
  const supabase = await createClient();

  // Look up our payment row. Note: the webhook may not have arrived yet — that's
  // common because the user is redirected back almost instantly after paying,
  // while the webhook is async. We show different UI for each state.
  const { data: payment } = paymentId
    ? await supabase
        .from('payments')
        .select('id, tier, amount_rub, status, paid, created_at, webhook_received_at')
        .eq('id', paymentId)
        .eq('user_id', user.id)
        .single()
    : { data: null };

  // Also fetch fresh profile state — webhook may have already activated
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier, subscription_expires_at')
    .eq('id', user.id)
    .single();

  const isSucceeded = payment?.status === 'succeeded' && payment.paid;
  const isPending = payment?.status === 'pending' || payment?.status === 'waiting_for_capture';
  const isCanceled = payment?.status === 'canceled';

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Card>
        <CardHeader>
          {isSucceeded ? (
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              <div>
                <CardTitle>Оплачено!</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Подписка <strong>{payment ? TIERS[payment.tier as SubscriptionTier].name : ''}</strong> активирована
                  {profile?.subscription_expires_at && (
                    <>
                      {' '}до{' '}
                      <LocalTimeLabel utcIso={profile.subscription_expires_at} />
                    </>
                  )}
                </p>
              </div>
            </div>
          ) : isPending ? (
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 animate-pulse text-amber-600 dark:text-amber-400" />
              <div>
                <CardTitle>Подтверждаем платёж…</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Обычно это занимает несколько секунд. Если статус не изменится через минуту —
                  обнови страницу.
                </p>
              </div>
            </div>
          ) : isCanceled ? (
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <div>
                <CardTitle>Платёж не прошёл</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Оплата отменена или отклонена банком. Можно попробовать снова.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
              <div>
                <CardTitle>Платёж не найден</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Не удалось найти платёж по этой ссылке. Проверь свою историю платежей.
                </p>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {payment && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Тариф</span>
                <span className="font-medium">{TIERS[payment.tier as SubscriptionTier].name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Сумма</span>
                <span className="font-medium">{payment.amount_rub} ₽</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Создан</span>
                <span><LocalTimeLabel utcIso={payment.created_at} /></span>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button asChild className="flex-1">
              <Link href="/dashboard">На главную</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/dashboard/billing">К биллингу</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
