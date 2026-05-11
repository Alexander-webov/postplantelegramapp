'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { createPaymentAction } from '@/app/actions/billing';
import type { SubscriptionTier } from '@/lib/tiers';

interface Props {
  tier: SubscriptionTier;
  priceRub: number;
  tierName: string;
}

/**
 * Calls createPaymentAction(tier), receives a YooKassa confirmation_url,
 * and redirects the user there. After payment, YooKassa sends a webhook
 * to our /api/yookassa/webhook which activates the subscription.
 */
export function UpgradeButton({ tier, priceRub, tierName }: Props) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await createPaymentAction(tier);

      if (!result) {
        toast.error('Не удалось создать платёж: пустой ответ сервера', { duration: 8000 });
        return;
      }

      if ('error' in result) {
        toast.error(result.error, { duration: 8000 });
        return;
      }

      // Redirect to YooKassa — full page navigation, not router.push
      window.location.href = result.confirmation_url;
    });
  }

  return (
    <Button onClick={handleClick} disabled={pending} className="w-full">
      {pending ? 'Готовлю оплату…' : `Перейти на ${tierName} · ${priceRub} ₽`}
    </Button>
  );
}
