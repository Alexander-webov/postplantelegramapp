import Link from 'next/link';
import { Radio, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireUser, getProfile } from '@/lib/auth/helpers';
import { getEffectiveTier } from '@/lib/usage';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { QuickPostForm } from '@/components/dashboard/quick-post-form';

export const metadata = { title: 'Создать пост' };

export default async function NewPostPage() {
  const user = await requireUser();
  const profile = await getProfile();
  const supabase = await createClient();

  const [channelsRes, templatesRes, advertisersRes] = await Promise.all([
    supabase
      .from('channels')
      .select('id, title, username')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('title'),
    supabase
      .from('templates')
      .select('id, kind, name, content, is_signature')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('advertisers')
      .select('id, name, telegram_username')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .order('name'),
  ]);

  const channels = channelsRes.data ?? [];
  const templates = templatesRes.data ?? [];
  const advertisers = advertisersRes.data ?? [];
  const tier = getEffectiveTier(profile);

  if (channels.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Создать пост" />
        <EmptyState
          icon={Radio}
          title="Сначала подключи канал"
          description="Без подключённого канала постить некуда. Это займёт минуту: добавь бота из @BotFather → подключи свой канал."
          action={
            <Button asChild>
              <Link href="/dashboard/channels/connect">
                <Plus className="h-4 w-4" />
                Подключить канал
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Создать пост"
        description="Отправь сразу или поставь в расписание. Можно в один канал, можно сразу в несколько."
      />
      <QuickPostForm
        channels={channels}
        templates={templates}
        tier={tier}
        advertisers={advertisers}
      />
    </div>
  );
}
