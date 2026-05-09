'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { EmojiPicker } from '@/components/dashboard/emoji-picker';
import { upsertTemplateAction } from '@/app/actions/templates';
import { TEMPLATE_VARIABLES } from '@/lib/templates';

interface TemplateFormProps {
  initial?: {
    id?: string;
    kind: 'signature' | 'post' | 'hashtags';
    name: string;
    content: string;
    is_signature: boolean;
  };
  defaultKind?: 'signature' | 'post' | 'hashtags';
}

export function TemplateForm({ initial, defaultKind }: TemplateFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<'signature' | 'post' | 'hashtags'>(
    initial?.kind ?? defaultKind ?? 'post'
  );
  const [content, setContent] = useState(initial?.content ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const placeholderByKind: Record<typeof kind, string> = {
    signature:
      '👉 @brooklynjest | Реклама: @ad_manager\n\nПодписка: https://t.me/+abcde',
    post: 'Привет! Сегодня {{date}}, отличный день для нового поста.\n\n#today #news',
    hashtags: '#brooklyn #newyork #news #2026',
  };

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          const result = await upsertTemplateAction(formData);
          if (result.error) {
            setError(result.error);
            toast.error(result.error);
          } else {
            toast.success(initial?.id ? 'Шаблон обновлён' : 'Шаблон создан');
            router.push('/dashboard/templates');
          }
        })
      }
      className="space-y-4"
    >
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="space-y-2">
        <Label htmlFor="kind">Тип шаблона</Label>
        <Select
          id="kind"
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
          required
        >
          <option value="post">Шаблон поста — целиком (с переменными)</option>
          <option value="signature">Подпись — авто-добавление в конец каждого поста</option>
          <option value="hashtags">Набор хештегов — добавляется кнопкой</option>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Название</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={100}
          defaultValue={initial?.name ?? ''}
          placeholder={
            kind === 'signature'
              ? 'Подпись Brooklyn жесть'
              : kind === 'hashtags'
              ? 'Базовые хештеги'
              : 'Утренние новости'
          }
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="content">Содержимое</Label>
          <EmojiPicker targetRef={textareaRef} onInsert={(v) => setContent(v)} />
        </div>
        <Textarea
          id="content"
          name="content"
          ref={textareaRef}
          rows={kind === 'hashtags' ? 3 : 8}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholderByKind[kind]}
          className="font-mono text-sm"
        />
      </div>

      <details className="rounded-md border bg-muted/30 p-3 text-sm">
        <summary className="cursor-pointer font-medium">
          Как форматировать текст и эмодзи →
        </summary>
        <div className="mt-3 space-y-2 text-muted-foreground">
          <p className="text-xs">Telegram поддерживает простую разметку через HTML-теги. Вставляй прямо в текст:</p>
          <ul className="space-y-1 text-xs">
            <li><code className="rounded bg-muted px-1.5 py-0.5">&lt;b&gt;жирный&lt;/b&gt;</code> → <strong>жирный</strong></li>
            <li><code className="rounded bg-muted px-1.5 py-0.5">&lt;i&gt;курсив&lt;/i&gt;</code> → <em>курсив</em></li>
            <li><code className="rounded bg-muted px-1.5 py-0.5">&lt;u&gt;подчёркнутый&lt;/u&gt;</code></li>
            <li><code className="rounded bg-muted px-1.5 py-0.5">&lt;s&gt;зачёркнутый&lt;/s&gt;</code></li>
            <li><code className="rounded bg-muted px-1.5 py-0.5">&lt;code&gt;моноширинный&lt;/code&gt;</code></li>
            <li><code className="rounded bg-muted px-1.5 py-0.5">&lt;a href="https://..."&gt;ссылка&lt;/a&gt;</code></li>
            <li><code className="rounded bg-muted px-1.5 py-0.5">&lt;blockquote&gt;цитата&lt;/blockquote&gt;</code></li>
            <li><code className="rounded bg-muted px-1.5 py-0.5">&lt;tg-spoiler&gt;спойлер&lt;/tg-spoiler&gt;</code></li>
          </ul>
          <p className="text-xs">
            Эмодзи добавляй через кнопку 🙂 рядом с заголовком — она вставит на место курсора.
          </p>
        </div>
      </details>

      {(kind === 'post' || kind === 'signature') && (
        <details className="rounded-md border bg-muted/30 p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            Переменные (автоподстановка) →
          </summary>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {TEMPLATE_VARIABLES.map((v) => (
              <li key={v.key}>
                <code className="rounded bg-muted px-1.5 py-0.5">{v.key}</code> —{' '}
                {v.description}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Подставляются в момент отправки в Telegram, не в момент создания.
            Для запланированных постов это значит что {'{{date}}'} = дата отправки, а не дата создания.
          </p>
        </details>
      )}

      {kind === 'signature' && (
        <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
          <input
            type="checkbox"
            name="is_signature"
            defaultChecked={initial?.is_signature ?? true}
            className="mt-0.5 rounded"
          />
          <div>
            <div className="font-medium">Сделать активной подписью</div>
            <p className="text-xs text-muted-foreground">
              Активная подпись авто-добавляется к каждому новому посту
              (в композере можно отключить тогглом перед отправкой).
              У юзера может быть только одна активная подпись —
              остальные будут автоматически отключены.
            </p>
          </div>
        </label>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Сохраняю…' : initial?.id ? 'Сохранить' : 'Создать'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/templates">Отмена</Link>
        </Button>
      </div>
    </form>
  );
}
