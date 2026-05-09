'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  FileText, Copy, Check, Send, ExternalLink, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  generateReportLinkAction,
  revokeReportLinkAction,
  updatePlacementStatusAction,
} from '@/app/actions/advertisers';

interface Props {
  placementId: string;
  /** Existing slug if already generated, null otherwise */
  initialSlug: string | null;
  /** Telegram username of the advertiser — for "Send to Telegram" deep link */
  advertiserTelegram: string | null;
  /** Channel title to put in the share message */
  channelTitle: string | null;
}

/**
 * Inline action: generate a public report URL for an ad placement and either
 * copy it or open Telegram with a pre-filled message to the advertiser.
 *
 * After successful share, we offer to mark placement status as 'reported'
 * so the user doesn't have to do that manually.
 */
export function ReportLinkButton({
  placementId, initialSlug, advertiserTelegram, channelTitle,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [slug, setSlug] = useState<string | null>(initialSlug);
  const [copied, setCopied] = useState(false);
  const [showActions, setShowActions] = useState(!!initialSlug);

  function handleGenerate() {
    const fd = new FormData();
    fd.append('placement_id', placementId);
    startTransition(async () => {
      const r = await generateReportLinkAction(fd);
      if (r.error) {
        toast.error(r.error);
      } else if (r.slug) {
        setSlug(r.slug);
        setShowActions(true);
        toast.success('Ссылка готова');
      }
    });
  }

  function handleRevoke() {
    if (!confirm('Отозвать ссылку? Текущий URL перестанет работать.')) return;
    const fd = new FormData();
    fd.append('placement_id', placementId);
    startTransition(async () => {
      const r = await revokeReportLinkAction(fd);
      if (r.error) {
        toast.error(r.error);
      } else {
        setSlug(null);
        setShowActions(false);
        toast.success('Ссылка отозвана');
      }
    });
  }

  function reportUrl(): string {
    if (!slug) return '';
    // Use window.location.origin client-side so the link works in dev too.
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/r/${slug}`;
    }
    return `/r/${slug}`;
  }

  async function copyLink() {
    const url = reportUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Ссылка скопирована');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Не удалось скопировать — выдели и скопируй вручную');
    }
  }

  function sendToTelegram() {
    const url = reportUrl();
    const text = channelTitle
      ? `Привет! Отчёт по размещению в канале «${channelTitle}»: ${url}`
      : `Привет! Отчёт по размещению: ${url}`;

    // If we know the advertiser's Telegram username — open direct chat
    // with prefilled message via Telegram's share URL scheme.
    // If not — generic share dialog.
    const tgUrl = advertiserTelegram
      ? `https://t.me/${advertiserTelegram}?text=${encodeURIComponent(text)}`
      : `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

    window.open(tgUrl, '_blank', 'noopener');

    // Offer to mark placement as reported
    const fd = new FormData();
    fd.append('placement_id', placementId);
    fd.append('status', 'reported');
    startTransition(async () => {
      const r = await updatePlacementStatusAction(fd);
      if (!r.error) {
        toast.success('Статус: отчёт отправлен');
      }
    });
  }

  // Initial state — no slug yet
  if (!showActions || !slug) {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={handleGenerate}
        disabled={pending}
      >
        {pending ? (
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileText className="h-3.5 w-3.5" />
        )}
        {pending ? 'Создаю…' : 'Получить отчёт'}
      </Button>
    );
  }

  // Active state — slug exists, show full toolbar
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button type="button" size="sm" variant="outline" onClick={copyLink} disabled={pending}>
        {copied ? (
          <Check className="h-3.5 w-3.5 text-success" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
        {copied ? 'Скопировано' : 'Копировать ссылку'}
      </Button>
      <Button type="button" size="sm" variant="default" onClick={sendToTelegram} disabled={pending}>
        <Send className="h-3.5 w-3.5" />
        В Telegram
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        asChild
      >
        <a href={reportUrl()} target="_blank" rel="noreferrer">
          <ExternalLink className="h-3.5 w-3.5" />
          Открыть
        </a>
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={handleRevoke}
        disabled={pending}
        className="text-muted-foreground hover:text-destructive"
        title="Отозвать ссылку — после этого URL перестанет работать"
      >
        Отозвать
      </Button>
    </div>
  );
}
