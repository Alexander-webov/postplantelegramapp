'use client';

import { useState, useTransition, useMemo } from 'react';
import { Briefcase, Plus, X, AtSign, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { upsertAdvertiserAction } from '@/app/actions/advertisers';
import { cn } from '@/lib/utils';

export interface AdvertiserOption {
  id: string;
  name: string;
  telegram_username: string | null;
}

interface Props {
  /** All active (non-archived) advertisers for this user */
  advertisers: AdvertiserOption[];
  /** Currently selected advertiser id (null = no ad) */
  value: string | null;
  /** Called when user picks/clears advertiser */
  onChange: (id: string | null) => void;
  /** Called when user creates a new advertiser inline (so parent can refresh list) */
  onCreated?: (advertiser: AdvertiserOption) => void;
}

/**
 * Compact advertiser picker:
 *  - Shows currently selected advertiser as a pill (with X to clear)
 *  - Otherwise: search box + dropdown of matches
 *  - "+ Создать «<query>»" inline button appears if no exact match
 *
 * Why not a regular Select? Three reasons:
 *  1. Lists can be 100+ — search > scrolling
 *  2. Inline creation is critical — adding new ads in composer flow
 *  3. We want compact display when an advertiser is already chosen
 */
export function AdvertiserSelect({ advertisers, value, onChange, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, startCreate] = useTransition();

  const selected = value ? advertisers.find((a) => a.id === value) : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return advertisers.slice(0, 8);
    return advertisers
      .filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.telegram_username && a.telegram_username.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [advertisers, query]);

  // Show "create new" only if user typed something AND no exact name match exists
  const trimmedQuery = query.trim();
  const exactMatch = trimmedQuery
    ? advertisers.some((a) => a.name.toLowerCase() === trimmedQuery.toLowerCase())
    : true;
  const canCreate = !!trimmedQuery && !exactMatch && trimmedQuery.length <= 120;

  function handleCreate() {
    if (!canCreate) return;
    const fd = new FormData();
    fd.append('name', trimmedQuery);
    startCreate(async () => {
      const r = await upsertAdvertiserAction(fd);
      if (r.error) {
        toast.error(r.error);
      } else if (r.id) {
        const newAdv: AdvertiserOption = { id: r.id, name: trimmedQuery, telegram_username: null };
        onCreated?.(newAdv);
        onChange(r.id);
        setQuery('');
        setOpen(false);
        toast.success(`Создан рекламодатель «${trimmedQuery}»`);
      }
    });
  }

  // Selected pill view
  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-sm border border-primary/30 bg-primary-soft/50 px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <Briefcase className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate text-sm font-medium">{selected.name}</span>
          {selected.telegram_username && (
            <span className="inline-flex items-center gap-0.5 truncate text-xs text-muted-foreground">
              <AtSign className="h-3 w-3" />
              {selected.telegram_username}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="rounded-sm p-0.5 text-muted-foreground transition-base hover:bg-accent hover:text-foreground"
          title="Убрать рекламодателя"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // Picker view
  return (
    <div className="relative">
      <Input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay to allow click on dropdown items to register
          setTimeout(() => setOpen(false), 150);
        }}
        placeholder={advertisers.length === 0 ? 'Создать первого рекламодателя…' : 'Поиск или новый…'}
        className="h-9"
      />

      {open && (filtered.length > 0 || canCreate) && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-sm border border-border bg-popover shadow-lg">
          {filtered.map((a) => (
            <button
              key={a.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(a.id);
                setQuery('');
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-base hover:bg-accent"
            >
              <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{a.name}</span>
              {a.telegram_username && (
                <span className="text-xs text-muted-foreground">@{a.telegram_username}</span>
              )}
            </button>
          ))}

          {canCreate && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCreate}
              disabled={creating}
              className={cn(
                'flex w-full items-center gap-2 border-t border-border/60 bg-secondary/50 px-3 py-2 text-left text-sm transition-base hover:bg-accent',
                filtered.length === 0 && 'border-t-0'
              )}
            >
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
              ) : (
                <Plus className="h-3.5 w-3.5 shrink-0 text-primary" />
              )}
              <span>
                Создать <strong>«{trimmedQuery}»</strong>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
