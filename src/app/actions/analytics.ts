'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/helpers';
import { decrypt } from '@/lib/crypto';
import { telegram } from '@/lib/telegram/client';

type ChannelWithBot = {
  id: string;
  telegram_chat_id: string;
  title: string;
  bots: { token_encrypted: string } | { token_encrypted: string }[] | null;
};

function single<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function refreshChannelStatsAction(): Promise<{ error?: string; updated?: number }> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('channels')
    .select('id, telegram_chat_id, title, bots(token_encrypted)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(50);

  if (error) return { error: error.message };

  const rows = (data ?? []) as ChannelWithBot[];
  const today = new Date().toISOString().slice(0, 10);
  let updated = 0;

  for (const row of rows) {
    const bot = single(row.bots);
    if (!bot?.token_encrypted) continue;

    let token: string;
    try {
      token = decrypt(bot.token_encrypted);
    } catch {
      continue;
    }

    try {
      const subscriberCount = await telegram.getChatMemberCount(token, row.telegram_chat_id);

      await supabase
        .from('channels')
        .update({ subscriber_count: subscriberCount, last_synced_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('user_id', user.id);

      await supabase
        .from('channel_analytics')
        .upsert(
          { channel_id: row.id, subscriber_count: subscriberCount, snapshot_date: today },
          { onConflict: 'channel_id,snapshot_date' }
        );

      updated++;
    } catch {
      // Keep one broken channel from blocking the rest.
    }
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/analytics');
  revalidatePath('/dashboard/channels');
  return { updated };
}
