import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/helpers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AddChannelForm } from '@/components/dashboard/add-channel-form';

export const metadata = { title: 'Добавить канал' };

interface PageProps {
  searchParams: Promise<{ bot_id?: string }>;
}

export default async function AddChannelPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const supabase = await createClient();
  const { bot_id: defaultBotId } = await searchParams;

  const { data: bots } = await supabase
    .from('bots')
    .select('id, username')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (!bots || bots.length === 0) {
    redirect('/dashboard/channels/connect');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Добавить канал</h1>
        <p className="mt-2 text-muted-foreground">
          Шаг 2 из 2. Подключи канал, в котором твой бот уже стоит администратором.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Канал</CardTitle>
          <CardDescription>
            Постплан проверит что бот действительно админ и сможет публиковать.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddChannelForm bots={bots} defaultBotId={defaultBotId} />
        </CardContent>
      </Card>
    </div>
  );
}
