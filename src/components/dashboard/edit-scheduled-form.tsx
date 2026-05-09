'use client';

import { useState, useTransition, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Save, Globe, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { MediaUploader, type UploadedMedia } from '@/components/dashboard/media-uploader';
import { EmojiPicker } from '@/components/dashboard/emoji-picker';
import { AutoDeleteSelect } from '@/components/dashboard/auto-delete-select';
import { AdPlacementSection } from '@/components/dashboard/ad-placement-section';
import type { AdvertiserOption } from '@/components/dashboard/advertiser-select';
import { updateScheduledPostAction } from '@/app/actions/posts';
import {
  TIMEZONES,
  detectBrowserTimezone,
  formatForDatetimeLocal,
  formatScheduledPreview,
  wallTimeToUTC,
} from '@/lib/timezones';

interface ChannelOption {
  id: string;
  title: string;
  username: string | null;
}

interface Props {
  scheduledId: string;
  channels: ChannelOption[];
  advertisers: AdvertiserOption[];
  initial: {
    channel_id: string;
    content: string;
    disable_preview: boolean;
    silent: boolean;
    scheduled_at_utc: string;
    media: UploadedMedia[];
    applied_signature_id: string | null;
    auto_delete_after_hours: number | null;
    placement: {
      advertiserId: string | null;
      priceRub: number | null;
      format: string | null;
    };
  };
}

const TG_LIMIT = 4096;
const CAPTION_LIMIT = 1024;

export function EditScheduledForm({ scheduledId, channels, advertisers, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState(initial.content);
  const [channelId, setChannelId] = useState(initial.channel_id);
  const [media, setMedia] = useState<UploadedMedia[]>(initial.media);
  const [disablePreview, setDisablePreview] = useState(initial.disable_preview);
  const [silent, setSilent] = useState(initial.silent);
  const [autoDeleteHours, setAutoDeleteHours] = useState<number | null>(
    initial.auto_delete_after_hours
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [browserTz, setBrowserTz] = useState('Europe/Moscow');
  const [selectedTz, setSelectedTz] = useState('Europe/Moscow');
  const [scheduledWall, setScheduledWall] = useState('');

  useEffect(() => {
    const detected = detectBrowserTimezone();
    setBrowserTz(detected);
    setSelectedTz(detected);
    // Render the existing UTC timestamp as wall-clock in the detected timezone
    setScheduledWall(formatForDatetimeLocal(new Date(initial.scheduled_at_utc), detected));
  }, [initial.scheduled_at_utc]);

  const minScheduledWall = useMemo(
    () => formatForDatetimeLocal(new Date(), selectedTz),
    [selectedTz]
  );
  const maxScheduledWall = useMemo(
    () => formatForDatetimeLocal(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), selectedTz),
    [selectedTz]
  );

  const previewText = useMemo(() => {
    if (!scheduledWall) return '';
    return formatScheduledPreview(scheduledWall, selectedTz, browserTz);
  }, [scheduledWall, selectedTz, browserTz]);

  const limit = media.length > 0 ? CAPTION_LIMIT : TG_LIMIT;
  const overLimit = text.length > limit;
  const isEmpty = !text.trim() && media.length === 0;

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          try {
            const utc = wallTimeToUTC(scheduledWall, selectedTz);
            formData.set('scheduled_at', utc);
          } catch {
            setError('Неверная дата');
            return;
          }
          formData.set('scheduled_post_id', scheduledId);
          if (initial.applied_signature_id) {
            formData.set('signature_id', initial.applied_signature_id);
          }
          const result = await updateScheduledPostAction(formData);
          if (result.error) {
            setError(result.error);
            toast.error(result.error);
          } else if (result.success) {
            toast.success('Изменения сохранены');
            router.push('/dashboard/queue');
          }
        })
      }
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="channel_id">Канал</Label>
        <Select
          id="channel_id"
          name="channel_id"
          required
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
        >
          {channels.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.title} {ch.username ? `(@${ch.username})` : ''}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="content">
            {media.length > 0 ? 'Подпись к медиа' : 'Текст поста'}
          </Label>
          <div className="flex items-center gap-1">
            <EmojiPicker targetRef={textareaRef} onInsert={(v) => setText(v)} />
            <span
              className={`text-xs ${overLimit ? 'text-destructive' : 'text-muted-foreground'}`}
            >
              {text.length} / {limit}
            </span>
          </div>
        </div>
        <Textarea
          id="content"
          name="content"
          ref={textareaRef}
          rows={media.length > 0 ? 4 : 8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="font-mono text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label>Медиа</Label>
        <MediaUploader value={media} onChange={setMedia} maxItems={10} />
      </div>

      <AdPlacementSection advertisers={advertisers} initial={initial.placement} />

      <div className="space-y-2 rounded-md border p-4">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Trash2 className="h-4 w-4 text-muted-foreground" />
          Авто-удаление
        </div>
        <p className="text-xs text-muted-foreground">
          Через сколько часов удалить пост из канала после публикации.
        </p>
        <AutoDeleteSelect value={autoDeleteHours} onChange={setAutoDeleteHours} />
      </div>

      <div className="space-y-2 rounded-md border p-4">
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="disable_preview"
            checked={disablePreview}
            onChange={(e) => setDisablePreview(e.target.checked)}
            className="mt-0.5 rounded"
          />
          <div className="flex-1">
            <div>Не показывать превью ссылок</div>
            <p className="text-xs text-muted-foreground">
              Telegram скрывает карточку статьи — приходит только текст.
            </p>
          </div>
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="silent"
            checked={silent}
            onChange={(e) => setSilent(e.target.checked)}
            className="mt-0.5 rounded"
          />
          <div className="flex-1">
            <div>Без звука уведомления</div>
            <p className="text-xs text-muted-foreground">
              Пост придёт без push-уведомления со звуком.
            </p>
          </div>
        </label>
      </div>

      <div className="space-y-3 rounded-md border p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="scheduled_wall">Дата и время</Label>
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
          <div className="space-y-2 sm:min-w-[220px]">
            <Label htmlFor="tz" className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              Часовой пояс
            </Label>
            <Select id="tz" value={selectedTz} onChange={(e) => setSelectedTz(e.target.value)}>
              {!TIMEZONES.find((t) => t.id === browserTz) && (
                <option value={browserTz}>{browserTz} (твой)</option>
              )}
              {TIMEZONES.map((tz) => (
                <option key={tz.id} value={tz.id}>
                  {tz.label}
                  {tz.id === browserTz ? ' — твой' : ''}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {previewText && (
          <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            {previewText}
          </p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending || overLimit || isEmpty}>
          <Save className="h-4 w-4" />
          {pending ? 'Сохраняю…' : 'Сохранить изменения'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/queue">Отмена</Link>
        </Button>
      </div>
    </form>
  );
}
