import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConnectBotForm } from '@/components/dashboard/connect-bot-form';

export const metadata = { title: 'Подключить бота' };

export default function ConnectBotPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Подключить бота</h1>
        <p className="mt-2 text-muted-foreground">
          Постплан публикует через твоего собственного бота в Telegram. Один бот может управлять несколькими каналами.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Шаг 1 из 2</CardTitle>
          <CardDescription>Создай бота в @BotFather и вставь токен сюда</CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectBotForm />
        </CardContent>
      </Card>
    </div>
  );
}
