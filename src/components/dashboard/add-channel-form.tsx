'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { addChannelAction } from '@/app/actions/channels';

interface BotOption {
  id: string;
  username: string;
}

interface AddChannelFormProps {
  bots: BotOption[];
  defaultBotId?: string;
}

export function AddChannelForm({ bots, defaultBotId }: AddChannelFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          const result = await addChannelAction(formData);
          if (result.error) {
            setError(result.error);
            toast.error(result.error);
          } else if (result.channel_id) {
            toast.success(`Канал «${result.channel_title}» подключён`);
            router.push('/dashboard/channels');
          }
        })
      }
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="bot_id">Бот</Label>
        <Select id="bot_id" name="bot_id" defaultValue={defaultBotId} required>
          <option value="">Выбери бота</option>
          {bots.map((bot) => (
            <option key={bot.id} value={bot.id}>
              @{bot.username}
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground">
          Через этого бота Постплан будет публиковать в канал.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="username_or_id">Username канала или chat_id</Label>
        <Input
          id="username_or_id"
          name="username_or_id"
          type="text"
          required
          placeholder="@my_channel или -1001234567890"
          autoComplete="off"
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground">
          Для публичных каналов проще вписать <code className="rounded bg-muted px-1 py-0.5">@username</code>. Для приватных — числовой chat_id (можно получить через @userinfobot).
        </p>
      </div>

      <div className="space-y-2 rounded-md border bg-muted/30 p-4 text-sm">
        <p className="font-medium">Перед добавлением убедись:</p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>Бот добавлен в канал как администратор</li>
          <li>У бота включено право «Публикация сообщений»</li>
        </ul>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Проверяю…' : 'Подключить канал'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/channels">Отмена</Link>
        </Button>
      </div>
    </form>
  );
}
