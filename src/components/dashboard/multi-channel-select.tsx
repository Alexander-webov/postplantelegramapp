'use client';

import { useState, useMemo } from 'react';
import { Check, X, Search, Settings2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export interface ChannelOption {
  id: string;
  title: string;
  username: string | null;
}

interface MultiChannelSelectProps {
  channels: ChannelOption[];
  /** Selected channel IDs */
  value: string[];
  onChange: (next: string[]) => void;
  /** Per-channel content overrides (optional) */
  customContents: Record<string, string>;
  onCustomContentsChange: (next: Record<string, string>) => void;
  /** Tier limit: how many channels can be selected at once. 0 = unlimited. */
  maxSelected?: number;
  /** Default content (used as the placeholder for custom-content fields) */
  defaultContent: string;
}

export function MultiChannelSelect({
  channels,
  value,
  onChange,
  customContents,
  onCustomContentsChange,
  maxSelected = 0,
  defaultContent,
}: MultiChannelSelectProps) {
  const [query, setQuery] = useState('');
  const [showCustomPanel, setShowCustomPanel] = useState(false);
  const [editingChannel, setEditingChannel] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return channels;
    const q = query.toLowerCase();
    return channels.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.username ?? '').toLowerCase().includes(q)
    );
  }, [channels, query]);

  function toggle(id: string) {
    const isSelected = value.includes(id);
    if (isSelected) {
      onChange(value.filter((x) => x !== id));
    } else {
      if (maxSelected > 0 && value.length >= maxSelected) {
        // soft limit handled by parent toast — here we silently no-op
        return;
      }
      onChange([...value, id]);
    }
  }

  function selectAll() {
    const ids = filtered.map((c) => c.id);
    if (maxSelected > 0) {
      onChange(ids.slice(0, maxSelected));
    } else {
      onChange(ids);
    }
  }

  function clearAll() {
    onChange([]);
  }

  function setCustomContent(channelId: string, text: string) {
    const next = { ...customContents };
    if (text.trim().length === 0) delete next[channelId];
    else next[channelId] = text;
    onCustomContentsChange(next);
  }

  const overLimit = maxSelected > 0 && value.length >= maxSelected;
  const selectedChannels = value
    .map((id) => channels.find((c) => c.id === id))
    .filter((c): c is ChannelOption => !!c);

  return (
    <div className="space-y-3">
      {/* Selected pills */}
      {selectedChannels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 rounded-md border bg-muted/30 p-2">
          {selectedChannels.map((ch) => (
            <span
              key={ch.id}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
            >
              {ch.title}
              {customContents[ch.id] && (
                <span className="rounded bg-primary-foreground/20 px-1 text-[9px] uppercase">
                  свой текст
                </span>
              )}
              <button
                type="button"
                onClick={() => toggle(ch.id)}
                className="ml-0.5 rounded hover:bg-primary-foreground/20"
                aria-label={`Убрать ${ch.title}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            Очистить
          </button>
        </div>
      )}

      {/* Search + bulk actions */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск канала…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <button
          type="button"
          onClick={selectAll}
          className="shrink-0 rounded-md border px-3 py-2 text-xs hover:bg-accent"
          disabled={filtered.length === 0}
        >
          Выбрать все
          {maxSelected > 0 && filtered.length > maxSelected
            ? ` (${maxSelected})`
            : ''}
        </button>
      </div>

      {/* Channel list */}
      <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-1">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {query ? 'Нет совпадений' : 'Нет доступных каналов'}
          </p>
        ) : (
          filtered.map((ch) => {
            const isSelected = value.includes(ch.id);
            const disabled = !isSelected && overLimit;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => toggle(ch.id)}
                disabled={disabled}
                className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition ${
                  isSelected
                    ? 'bg-primary/10 hover:bg-primary/15'
                    : disabled
                    ? 'cursor-not-allowed opacity-50'
                    : 'hover:bg-accent'
                }`}
              >
                <div
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    isSelected ? 'border-primary bg-primary' : 'border-input'
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{ch.title}</div>
                  {ch.username && (
                    <div className="truncate text-xs text-muted-foreground">
                      @{ch.username}
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Hidden form fields — server reads channel_ids[] */}
      {value.map((id) => (
        <input key={id} type="hidden" name="channel_ids" value={id} />
      ))}

      {/* Limit hint */}
      {maxSelected > 0 && (
        <p className="text-xs text-muted-foreground">
          Выбрано: {value.length}{maxSelected > 0 ? ` / ${maxSelected}` : ''}
          {overLimit && ' — лимит тарифа'}
        </p>
      )}

      {/* Per-channel custom content (advanced) */}
      {selectedChannels.length >= 2 && (
        <div className="rounded-md border">
          <button
            type="button"
            onClick={() => setShowCustomPanel((v) => !v)}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50"
          >
            <Settings2 className="h-4 w-4" />
            <span className="font-medium">Свой текст для каждого канала</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {Object.keys(customContents).length > 0
                ? `${Object.keys(customContents).length} переопределений`
                : 'необязательно'}
            </span>
          </button>

          {showCustomPanel && (
            <div className="space-y-2 border-t p-3">
              <p className="text-xs text-muted-foreground">
                По умолчанию все каналы получают одинаковый текст.
                Здесь можно задать свой вариант для отдельного канала.
              </p>
              {selectedChannels.map((ch) => (
                <div key={ch.id} className="space-y-1.5 rounded-md border p-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">
                      {ch.title}
                      {customContents[ch.id] && (
                        <span className="ml-1.5 rounded bg-primary/20 px-1.5 text-[10px] text-primary">
                          переопределён
                        </span>
                      )}
                    </Label>
                    {customContents[ch.id] && (
                      <button
                        type="button"
                        onClick={() => setCustomContent(ch.id, '')}
                        className="text-[10px] text-muted-foreground hover:underline"
                      >
                        сбросить
                      </button>
                    )}
                  </div>
                  <Textarea
                    name={`custom_content[${ch.id}]`}
                    value={customContents[ch.id] ?? ''}
                    onChange={(e) => setCustomContent(ch.id, e.target.value)}
                    placeholder={`По умолчанию: ${defaultContent.slice(0, 80) || '(пусто)'}${defaultContent.length > 80 ? '…' : ''}`}
                    rows={3}
                    className="font-mono text-xs"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
