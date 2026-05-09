'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { editPublishedPostAction } from '@/app/actions/posts';

interface Props {
  scheduledId: string;
  initialContent: string;
  hasMedia: boolean;
  sentAt: string;
}

export function EditPublishedButton({ scheduledId, initialContent, hasMedia, sentAt }: Props) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(initialContent);

  // Telegram allows editing only within 48 hours
  const ageMs = Date.now() - new Date(sentAt).getTime();
  const editable = ageMs < 48 * 60 * 60 * 1000;

  if (!editable) {
    return (
      <span
        className="text-xs text-muted-foreground"
        title="Telegram запрещает редактировать посты старше 48 часов"
      >
        нельзя править
      </span>
    );
  }

  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" />
        Редактировать
      </Button>
    );
  }

  function handleSave() {
    const fd = new FormData();
    fd.append('scheduled_post_id', scheduledId);
    fd.append('content', content);
    startTransition(async () => {
      const r = await editPublishedPostAction(fd);
      if (r.error) toast.error(r.error);
      else {
        toast.success('Пост обновлён в Telegram');
        setOpen(false);
      }
    });
  }

  return (
    <div className="w-full space-y-2">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={6}
        maxLength={hasMedia ? 1024 : 4096}
        className="font-mono text-sm"
        autoFocus
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {content.length} / {hasMedia ? 1024 : 4096}
          {hasMedia && ' · только подпись (медиа не меняем)'}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setContent(initialContent); setOpen(false); }}>
            <X className="h-3.5 w-3.5" />
            Отмена
          </Button>
          <Button size="sm" onClick={handleSave} disabled={pending}>
            {pending ? 'Сохраняю…' : 'Сохранить в Telegram'}
          </Button>
        </div>
      </div>
    </div>
  );
}
