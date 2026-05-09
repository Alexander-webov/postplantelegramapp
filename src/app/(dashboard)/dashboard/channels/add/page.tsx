import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/helpers';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { AddChannelForm } from '@/components/dashboard/add-channel-form';

export const metadata = { title: 'Добавить канал' };

export default async function AddChannelPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: bots } = await supabase
    .from('bots')
    .select('id, username, first_name')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (!bots || bots.length === 0) {
    redirect('/dashboard/channels/connect');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href="/dashboard/channels">
          <ArrowLeft className="h-3.5 w-3.5" />
          К каналам
        </Link>
      </Button>

      <PageHeader
        eyebrow="Шаг 2 из 2"
        title="Добавить канал"
        description="Добавь подключённого бота в свой Telegram-канал как администратора, потом введи @username канала здесь."
      />

      <Card>
        <CardContent className="pt-5">
          <AddChannelForm bots={bots} />
        </CardContent>
      </Card>
    </div>
  );
}
