'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { MoreHorizontal, Trash2, Edit2, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  toggleChannelActiveAction,
  renameChannelAction,
  deleteChannelAction,
  deleteBotAction,
} from '@/app/actions/channels';

interface ChannelActionsProps {
  id: string;
  title: string;
  isActive: boolean;
}

export function ChannelActions({ id, title, isActive }: ChannelActionsProps) {
  const [pending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newTitle, setNewTitle] = useState(title);

  function close() {
    setMenuOpen(false);
  }

  function handleToggle() {
    const fd = new FormData();
    fd.append('id', id);
    startTransition(async () => {
      const r = await toggleChannelActiveAction(fd);
      if (r.error) toast.error(r.error);
      else toast.success(isActive ? 'Канал выключен' : 'Канал включён');
      close();
    });
  }

  function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || newTitle === title) {
      setRenameOpen(false);
      return;
    }
    const fd = new FormData();
    fd.append('id', id);
    fd.append('title', newTitle.trim());
    startTransition(async () => {
      const r = await renameChannelAction(fd);
      if (r.error) toast.error(r.error);
      else {
        toast.success('Переименовано');
        setRenameOpen(false);
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Удалить канал «${title}»? Все запланированные посты будут отменены.`)) return;
    const fd = new FormData();
    fd.append('id', id);
    startTransition(async () => {
      const r = await deleteChannelAction(fd);
      if (r.error) toast.error(r.error);
      else toast.success('Канал удалён');
      close();
    });
  }

  if (renameOpen) {
    return (
      <form onSubmit={handleRename} className="flex items-center gap-1">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="h-8 w-48 text-sm"
          autoFocus
          maxLength={200}
        />
        <Button type="submit" size="sm" disabled={pending}>
          OK
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => { setNewTitle(title); setRenameOpen(false); }}>
          ✕
        </Button>
      </form>
    );
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setMenuOpen((v) => !v)}
        disabled={pending}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className="absolute right-0 z-50 mt-1 w-48 rounded-md border bg-popover py-1 shadow-md">
            <button
              type="button"
              onClick={() => { setRenameOpen(true); close(); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
            >
              <Edit2 className="h-3.5 w-3.5" />
              Переименовать
            </button>
            <button
              type="button"
              onClick={handleToggle}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
            >
              {isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {isActive ? 'Выключить' : 'Включить'}
            </button>
            <div className="my-1 border-t" />
            <button
              type="button"
              onClick={handleDelete}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Удалить
            </button>
          </div>
        </>
      )}
    </div>
  );
}

interface BotActionsProps {
  id: string;
  username: string;
  channelCount: number;
}

export function BotActions({ id, username, channelCount }: BotActionsProps) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    const msg = channelCount > 0
      ? `Бот @${username} управляет ${channelCount} канал(ами). Удалить вместе с каналами? Все запланированные посты будут отменены.`
      : `Удалить бота @${username}?`;
    if (!confirm(msg)) return;

    const fd = new FormData();
    fd.append('id', id);
    if (channelCount > 0) fd.append('force', 'true');
    startTransition(async () => {
      const r = await deleteBotAction(fd);
      if (r.error) toast.error(r.error);
      else toast.success('Бот удалён');
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleDelete} disabled={pending}>
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}
