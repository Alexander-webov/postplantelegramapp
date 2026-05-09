import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/helpers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QuickPostForm } from '@/components/dashboard/quick-post-form';

export const metadata = { title: 'Создать пост' };

export default async function NewPostPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: channels } = await supabase
    .from('channels')
    .select('id, title, username')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('title');

  if (!channels || channels.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Сначала подключи канал</CardTitle>
            <CardDescription>Без подключённого канала постить некуда.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard/channels/connect">Подключить бота и канал</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Создать пост</h1>
        <p className="mt-2 text-muted-foreground">Отправь сразу или поставь в расписание.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <QuickPostForm channels={channels} />
        </CardContent>
      </Card>
    </div>
  );
}
