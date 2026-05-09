'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { connectBotAction } from '@/app/actions/bots';

export function ConnectBotForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; username: string } | null>(null);

  if (success) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-md border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600 dark:text-green-400" />
          <div className="flex-1">
            <p className="font-medium">
              Бот @{success.username} подключён
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Теперь добавь его администратором в свой канал.
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-md border p-4">
          <p className="font-medium">Как добавить бота в канал:</p>
          <ol className="list-inside list-decimal space-y-1.5 text-sm text-muted-foreground">
            <li>Открой свой канал в Telegram</li>
            <li>Нажми на название канала → «Управление каналом»</li>
            <li>«Администраторы» → «Добавить администратора»</li>
            <li>
              Найди <strong>@{success.username}</strong> и добавь
            </li>
            <li>
              Включи право <strong>«Публикация сообщений»</strong>
            </li>
          </ol>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => router.push(`/dashboard/channels/add?bot_id=${success.id}`)}
          >
            Подключить канал →
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/channels">Назад к списку</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          const result = await connectBotAction(formData);
          if (result.error) {
            setError(result.error);
            toast.error(result.error);
          } else if (result.bot_id && result.bot_username) {
            toast.success(`@${result.bot_username} подключён`);
            setSuccess({ id: result.bot_id, username: result.bot_username });
          }
        })
      }
      className="space-y-4"
    >
      <div className="space-y-3 rounded-md border bg-muted/30 p-4 text-sm">
        <p className="font-medium">Где взять токен:</p>
        <ol className="list-inside list-decimal space-y-1.5 text-muted-foreground">
          <li>
            Открой{' '}
            <a
              href="https://t.me/BotFather"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              @BotFather <ExternalLink className="h-3 w-3" />
            </a>{' '}
            в Telegram
          </li>
          <li>
            Отправь команду <code className="rounded bg-muted px-1.5 py-0.5">/newbot</code>
          </li>
          <li>Введи имя и username бота (должен заканчиваться на bot)</li>
          <li>Скопируй токен из ответа BotFather и вставь сюда</li>
        </ol>
      </div>

      <div className="space-y-2">
        <Label htmlFor="token">Токен бота</Label>
        <Input
          id="token"
          name="token"
          type="text"
          required
          placeholder="1234567890:AAH-XXXXXXXXXXXXXXXXXXXXXX"
          className="font-mono text-sm"
          autoComplete="off"
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground">
          Шифруется AES-256-GCM перед сохранением. В чистом виде в БД не лежит.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Проверяю токен…' : 'Подключить'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/channels">Отмена</Link>
        </Button>
      </div>
    </form>
  );
}
