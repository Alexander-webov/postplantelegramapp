import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { ConnectBotForm } from '@/components/dashboard/connect-bot-form';

export const metadata = { title: 'Подключить бота' };

export default function ConnectBotPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href="/dashboard/channels">
          <ArrowLeft className="h-3.5 w-3.5" />
          К каналам
        </Link>
      </Button>

      <PageHeader
        eyebrow="Шаг 1 из 2"
        title="Подключить бота"
        description="Постплан публикует через твоего собственного бота в Telegram. Один бот может управлять несколькими каналами."
      />

      <Card>
        <CardContent className="pt-5">
          <ConnectBotForm />
        </CardContent>
      </Card>
    </div>
  );
}
