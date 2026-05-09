'use client';

import { useState, useTransition, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Send, Calendar, ExternalLink, Globe, FileText, Hash, Signature,
  Sparkles, Lock, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MediaUploader, type UploadedMedia } from '@/components/dashboard/media-uploader';
import { EmojiPicker } from '@/components/dashboard/emoji-picker';
import { MultiChannelSelect } from '@/components/dashboard/multi-channel-select';
import { AutoDeleteSelect } from '@/components/dashboard/auto-delete-select';
import { AdPlacementSection } from '@/components/dashboard/ad-placement-section';
import type { AdvertiserOption } from '@/components/dashboard/advertiser-select';
import { sendQuickPostAction, schedulePostAction } from '@/app/actions/posts';
import { getTierLimits, isUnlimited, type SubscriptionTier } from '@/lib/tiers';
import {
  TIMEZONES, detectBrowserTimezone, formatForDatetimeLocal,
  formatScheduledPreview, wallTimeToUTC,
} from '@/lib/timezones';
import { cn } from '@/lib/utils';

interface ChannelOption {
  id: string;
  title: string;
  username: string | null;
}

interface TemplateOption {
  id: string;
  kind: 'signature' | 'post' | 'hashtags';
  name: string;
  content: string;
  is_signature: boolean | null;
}

const TG_LIMIT = 4096;
const CAPTION_LIMIT = 1024;
type Mode = 'now' | 'schedule';

export function QuickPostForm({
  channels,
  templates = [],
  tier = 'free',
  advertisers = [],
}: {
  channels: ChannelOption[];
  templates?: TemplateOption[];
  tier?: SubscriptionTier;
  advertisers?: AdvertiserOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [mode, setMode] = useState<Mode>('now');
  const [media, setMedia] = useState<UploadedMedia[]>([]);

  const tierLimits = useMemo(() => getTierLimits(tier), [tier]);

  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>(() =>
    channels.length > 0 ? [channels[0].id] : []
  );
  const [customContents, setCustomContents] = useState<Record<string, string>>({});
  const [autoDeleteHours, setAutoDeleteHours] = useState<number | null>(null);

  const postTemplates = templates.filter((t) => t.kind === 'post');
  const hashtagTemplates = templates.filter((t) => t.kind === 'hashtags');
  const activeSignature = templates.find((t) => t.kind === 'signature' && t.is_signature) ?? null;
  const [signatureOn, setSignatureOn] = useState<boolean>(!!activeSignature);

  const [browserTz, setBrowserTz] = useState('Europe/Moscow');
  const [selectedTz, setSelectedTz] = useState('Europe/Moscow');
  const [scheduledWall, setScheduledWall] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const detected = detectBrowserTimezone();
    setBrowserTz(detected);
    setSelectedTz(detected);
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    setScheduledWall(formatForDatetimeLocal(d, detected));
  }, []);

  const minScheduledWall = useMemo(
    () => formatForDatetimeLocal(new Date(), selectedTz),
    [selectedTz]
  );
  const maxScheduledWall = useMemo(
    () => formatForDatetimeLocal(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), selectedTz),
    [selectedTz]
  );

  const previewText = useMemo(() => {
    if (mode !== 'schedule' || !scheduledWall) return '';
    return formatScheduledPreview(scheduledWall, selectedTz, browserTz);
  }, [mode, scheduledWall, selectedTz, browserTz]);

  const limit = media.length > 0 ? CAPTION_LIMIT : TG_LIMIT;
  const overLimit = text.length > limit;
  const isEmpty = !text.trim() && media.length === 0;
  const noChannels = selectedChannelIds.length === 0;
  const submitDisabled = pending || overLimit || isEmpty || noChannels;

  const channelSuffix = selectedChannelIds.length > 1 ? ` в ${selectedChannelIds.length} каналов` : '';

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          if (mode === 'schedule') {
            try {
              const utc = wallTimeToUTC(scheduledWall, selectedTz);
              formData.set('scheduled_at', utc);
            } catch {
              setError('Неверная дата');
              toast.error('Неверная дата');
              return;
            }
          }

          if (mode === 'now') {
            const result = await sendQuickPostAction(formData);
            if (result.error) {
              setError(result.error);
              toast.error(result.error);
            } else if (result.success) {
              const sent = result.sent ?? 0;
              const failed = result.failed ?? 0;
              toast[failed > 0 && sent === 0 ? 'error' : 'success'](
                failed === 0
                  ? sent === 1 ? 'Пост отправлен' : `Пост отправлен в ${sent} каналов`
                  : `Отправлено ${sent}, ошибок ${failed}`,
                {
                  action: { label: 'К очереди', onClick: () => router.push('/dashboard/queue') },
                }
              );
              if (failed > 0 && result.results) {
                for (const r of result.results) {
                  if (!r.success) toast.error(`${r.channel_title}: ${r.error}`, { duration: 8000 });
                }
              }
              setText('');
              setMedia([]);
            }
          } else {
            const result = await schedulePostAction(formData);
            if (result.error) {
              setError(result.error);
              toast.error(result.error);
            } else if (result.success) {
              const n = result.scheduled ?? 0;
              toast.success(
                n === 1 ? 'В очереди — добавь ещё' : `Запланировано в ${n} каналов`,
                {
                  action: { label: 'К очереди', onClick: () => router.push('/dashboard/queue') },
                  duration: 6000,
                }
              );
              setText('');
              setMedia([]);
              if (scheduledWall) {
                const d = new Date(scheduledWall);
                if (!Number.isNaN(d.getTime())) {
                  d.setHours(d.getHours() + 1);
                  setScheduledWall(formatForDatetimeLocal(d, selectedTz));
                }
              }
            }
          }
        })
      }
      className="grid gap-6 lg:grid-cols-[1fr_320px]"
    >
      {/* MAIN COLUMN — content authoring */}
      <div className="space-y-5">
        {/* Mode switcher: tabs at top */}
        <div className="inline-flex items-center gap-1 rounded-sm border border-border bg-card p-0.5 shadow-xs">
          <ModeTab active={mode === 'now'} onClick={() => setMode('now')} icon={Send}>
            Отправить сейчас
          </ModeTab>
          <ModeTab active={mode === 'schedule'} onClick={() => setMode('schedule')} icon={Calendar}>
            Запланировать
          </ModeTab>
        </div>

        {/* Toolbar above textarea */}
        {(postTemplates.length > 0 || hashtagTemplates.length > 0 || activeSignature) && (
          <div className="flex flex-wrap items-center gap-2 rounded-sm border border-border bg-surface-sunken/40 p-2">
            {postTemplates.length > 0 && (
              <Select
                className="h-8 w-auto min-w-[160px] text-xs"
                defaultValue=""
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) return;
                  const tpl = postTemplates.find((t) => t.id === id);
                  if (!tpl) return;
                  if (text.trim() && !confirm('Заменить текущий текст шаблоном?')) {
                    e.target.value = '';
                    return;
                  }
                  setText(tpl.content);
                  e.target.value = '';
                  toast.success(`Шаблон «${tpl.name}» применён`);
                }}
              >
                <option value="">📄 Шаблон поста…</option>
                {postTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            )}

            {hashtagTemplates.length > 0 && (
              <Select
                className="h-8 w-auto min-w-[140px] text-xs"
                defaultValue=""
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) return;
                  const tpl = hashtagTemplates.find((t) => t.id === id);
                  if (!tpl) return;
                  setText((c) => (c.trim() ? `${c}\n\n${tpl.content}` : tpl.content));
                  e.target.value = '';
                  toast.success('Хештеги добавлены');
                }}
              >
                <option value="">＃ Хештеги…</option>
                {hashtagTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            )}

            {activeSignature && (
              <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  name="apply_signature"
                  checked={signatureOn}
                  onChange={(e) => setSignatureOn(e.target.checked)}
                  className="rounded"
                />
                <Signature className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Подпись: <strong>{activeSignature.name}</strong></span>
              </label>
            )}

            <Link
              href="/dashboard/templates"
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              управление →
            </Link>
          </div>
        )}

        {/* Textarea */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="content">
              {media.length > 0 ? 'Подпись к медиа' : 'Текст поста'}
            </Label>
            <div className="flex items-center gap-1.5">
              <EmojiPicker targetRef={textareaRef} onInsert={(v) => setText(v)} />
              <span
                className={cn(
                  'text-xs tabular-nums',
                  overLimit ? 'text-destructive' : 'text-muted-foreground'
                )}
              >
                {text.length} / {limit}
              </span>
            </div>
          </div>
          <Textarea
            id="content"
            name="content"
            ref={textareaRef}
            rows={media.length > 0 ? 5 : 12}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              media.length > 0
                ? 'Подпись (можно оставить пустой)…'
                : 'Что нового? Пиши сюда — поддерживается HTML и эмодзи 🎉'
            }
            className="font-sans text-[15px] leading-relaxed"
          />

          <details className="group">
            <summary className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <span className="group-open:hidden">Как форматировать (HTML-теги Telegram) →</span>
              <span className="hidden group-open:inline">Свернуть ↑</span>
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground sm:grid-cols-3">
              <code className="rounded-sm bg-muted px-1.5 py-0.5">&lt;b&gt;жирный&lt;/b&gt;</code>
              <code className="rounded-sm bg-muted px-1.5 py-0.5">&lt;i&gt;курсив&lt;/i&gt;</code>
              <code className="rounded-sm bg-muted px-1.5 py-0.5">&lt;u&gt;подчёрк&lt;/u&gt;</code>
              <code className="rounded-sm bg-muted px-1.5 py-0.5">&lt;s&gt;зачёрк&lt;/s&gt;</code>
              <code className="rounded-sm bg-muted px-1.5 py-0.5">&lt;code&gt;моно&lt;/code&gt;</code>
              <code className="rounded-sm bg-muted px-1.5 py-0.5">&lt;a href="…"&gt;</code>
              <code className="rounded-sm bg-muted px-1.5 py-0.5">&lt;blockquote&gt;</code>
              <code className="rounded-sm bg-muted px-1.5 py-0.5">&lt;tg-spoiler&gt;</code>
            </div>
            {media.length > 0 && (
              <p className="mt-2 text-xs text-warning">
                ⚠ С медиа подпись ограничена 1024 символами Telegram'а.
              </p>
            )}
          </details>

          {/* Signature preview */}
          {activeSignature && signatureOn && (
            <div className="rounded-sm border border-dashed border-border bg-surface-sunken/40 p-2.5 text-xs">
              <div className="mb-1 flex items-center gap-1 font-medium text-muted-foreground">
                <Signature className="h-3 w-3" />
                При отправке добавится:
              </div>
              <pre className="whitespace-pre-wrap break-all font-sans text-muted-foreground">
                {activeSignature.content}
              </pre>
            </div>
          )}

          {activeSignature && signatureOn && (
            <input type="hidden" name="signature_id" value={activeSignature.id} />
          )}
        </div>

        {/* Media uploader */}
        <div className="space-y-2">
          <Label>Медиа</Label>
          <MediaUploader value={media} onChange={setMedia} maxItems={10} />
        </div>

        {/* Submit area */}
        {error && (
          <div className="rounded-sm border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" size="lg" disabled={submitDisabled}>
            {mode === 'now' ? <Send className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
            {pending
              ? mode === 'now' ? 'Отправляю…' : 'Сохраняю…'
              : mode === 'now' ? `Отправить сейчас${channelSuffix}` : `Поставить в очередь${channelSuffix}`}
          </Button>
          <Button type="button" variant="ghost" asChild>
            <Link href="/dashboard">Отмена</Link>
          </Button>
          {noChannels && (
            <span className="text-xs text-muted-foreground">Выбери канал →</span>
          )}
          {!noChannels && isEmpty && (
            <span className="text-xs text-muted-foreground">Добавь текст или медиа</span>
          )}
        </div>
      </div>

      {/* SIDE COLUMN — channels + scheduling */}
      <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
        {/* Channels block */}
        <div className="space-y-2">
          <Label>Куда публиковать</Label>
          <MultiChannelSelect
            channels={channels}
            value={selectedChannelIds}
            onChange={setSelectedChannelIds}
            customContents={customContents}
            onCustomContentsChange={setCustomContents}
            maxSelected={isUnlimited(tierLimits.maxCrosspostChannels) ? 0 : tierLimits.maxCrosspostChannels}
            defaultContent={text}
          />
          {tierLimits.maxCrosspostChannels === 1 && channels.length > 1 && (
            <Link
              href="/dashboard/billing"
              className="flex items-start gap-2 rounded-sm border border-primary/20 bg-primary-soft/50 p-2.5 text-xs transition-base hover:bg-primary-soft"
            >
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>
                <strong>Кросспостинг</strong> — на тарифе Базовый (299 ₽) пост уходит сразу в 3 канала, на Профи — в 50.
              </span>
            </Link>
          )}
        </div>

        {/* Schedule block (only when mode=schedule) */}
        {mode === 'schedule' && (
          <div className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-xs animate-fade-up">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Когда публиковать
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduled_wall" className="text-xs">Дата и время</Label>
              <Input
                id="scheduled_wall"
                type="datetime-local"
                required
                value={scheduledWall}
                onChange={(e) => setScheduledWall(e.target.value)}
                min={minScheduledWall}
                max={maxScheduledWall}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tz" className="flex items-center gap-1.5 text-xs">
                <Globe className="h-3 w-3" />
                Часовой пояс
              </Label>
              <Select id="tz" value={selectedTz} onChange={(e) => setSelectedTz(e.target.value)}>
                {!TIMEZONES.find((t) => t.id === browserTz) && (
                  <option value={browserTz}>{browserTz} (твой)</option>
                )}
                {TIMEZONES.map((tz) => (
                  <option key={tz.id} value={tz.id}>
                    {tz.label}{tz.id === browserTz ? ' — твой' : ''}
                  </option>
                ))}
              </Select>
            </div>

            <input type="hidden" name="scheduled_at" />

            {previewText && (
              <div className="rounded-sm bg-surface-sunken/40 px-2.5 py-2 text-xs leading-relaxed text-muted-foreground">
                {previewText}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              До 3 месяцев вперёд. В БД хранится UTC, в очереди показываем в твоём часовом поясе.
            </p>
          </div>
        )}

        {/* Ad placement */}
        <AdPlacementSection advertisers={advertisers} />

        {/* Auto-delete */}
        <div className="space-y-2 rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Trash2 className="h-4 w-4 text-muted-foreground" />
            Авто-удаление
          </div>
          <p className="text-xs text-muted-foreground">
            Полезно для рекламы — пост уйдёт из канала автоматически после оговорённого срока.
          </p>
          <AutoDeleteSelect value={autoDeleteHours} onChange={setAutoDeleteHours} />
        </div>

        {/* Options */}
        <div className="space-y-2 rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="text-sm font-medium">Дополнительно</div>
          <CheckboxOption
            name="disable_preview"
            label="Не показывать превью ссылок"
            description="Telegram скрывает карточку статьи — приходит только текст."
          />
          <CheckboxOption
            name="silent"
            label="Без звука уведомления"
            description="Push без звука. Полезно для ночных постов."
          />
        </div>
      </aside>
    </form>
  );
}

/* ----------------------------- helpers ----------------------------------- */

function ModeTab({
  active, onClick, icon: Icon, children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-sm px-3.5 py-1.5 text-sm font-medium transition-base',
        active
          ? 'bg-primary text-primary-foreground shadow-xs'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function CheckboxOption({
  name, label, description,
}: { name: string; label: string; description: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-sm p-1.5 -m-1.5 transition-base hover:bg-accent/50">
      <input type="checkbox" name={name} className="mt-0.5 rounded" />
      <div className="flex-1">
        <div className="text-sm">{label}</div>
        <p className="text-[11px] leading-snug text-muted-foreground">{description}</p>
      </div>
    </label>
  );
}
