'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';
import { Plus, Search, Pause, Play, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { CP_TOPICS, CP_TOPIC_LABELS, topicLabel } from '@/lib/crosspromo/topics';
import { upsertCpListingAction, toggleCpListingAction } from '@/app/actions/crosspromo';

interface ChannelOpt {
  id: string;
  title: string;
  username: string | null;
  subscriber_count: number;
  is_active: boolean;
}
interface Listing {
  id: string;
  channel_id: string;
  topic: string;
  avg_reach: number;
  subscriber_count: number;
  weekly_slots: number;
  min_partner_reach_pct: number;
  description: string | null;
  status: 'active' | 'paused';
}

export function CpListingManager({ channels, listings }: { channels: ChannelOpt[]; listings: Listing[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Listing | null>(null);

  // Channels not yet listed (for the "add" dropdown)
  const listedChannelIds = new Set(listings.map((l) => l.channel_id));
  const availableChannels = channels.filter((c) => !listedChannelIds.has(c.id));

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }
  function openEdit(l: Listing) {
    setEditing(l);
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await upsertCpListingAction(fd);
      if (r.error) {
        toast.error(r.error);
      } else {
        toast.success(editing ? 'Листинг обновлён' : 'Канал добавлен в биржу');
        setShowForm(false);
        setEditing(null);
        router.refresh();
      }
    });
  }

  function handleToggle(l: Listing) {
    const fd = new FormData();
    fd.append('listing_id', l.id);
    startTransition(async () => {
      const r = await toggleCpListingAction(fd);
      if (r.error) toast.error(r.error);
      else {
        toast.success(l.status === 'active' ? 'Листинг на паузе' : 'Листинг активен');
        router.refresh();
      }
    });
  }

  const channelById = (id: string) => channels.find((c) => c.id === id);

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Мои каналы в бирже</h2>
        {availableChannels.length > 0 && !showForm && (
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Выставить канал
          </Button>
        )}
      </div>

      {/* Add / edit form */}
      {showForm && (
        <Card>
          <CardContent className="py-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="channel_id">Канал</Label>
                  {editing ? (
                    <>
                      <Input value={channelById(editing.channel_id)?.title ?? '—'} disabled />
                      <input type="hidden" name="channel_id" value={editing.channel_id} />
                    </>
                  ) : (
                    <Select id="channel_id" name="channel_id" required defaultValue="">
                      <option value="" disabled>
                        Выберите канал
                      </option>
                      {availableChannels.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title} {c.username ? `(@${c.username})` : ''}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="topic">Тематика</Label>
                  <Select id="topic" name="topic" required defaultValue={editing?.topic ?? ''}>
                    <option value="" disabled>
                      Выберите тематику
                    </option>
                    {CP_TOPICS.map((t) => (
                      <option key={t} value={t}>
                        {CP_TOPIC_LABELS[t]}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="weekly_slots">Сделок в неделю</Label>
                  <Input
                    id="weekly_slots"
                    name="weekly_slots"
                    type="number"
                    min={1}
                    max={50}
                    defaultValue={editing?.weekly_slots ?? 3}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="min_partner_reach_pct">Мин. охват партнёра (% от моего)</Label>
                  <Input
                    id="min_partner_reach_pct"
                    name="min_partner_reach_pct"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={editing?.min_partner_reach_pct ?? 50}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Описание канала (необязательно)</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={2}
                  maxLength={500}
                  placeholder="О чём канал, какая аудитория — поможет партнёрам выбрать вас"
                  defaultValue={editing?.description ?? ''}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button type="submit" disabled={pending}>
                  {pending ? 'Сохранение…' : editing ? 'Сохранить' : 'Выставить в биржу'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setEditing(null);
                  }}
                  disabled={pending}
                >
                  Отмена
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Existing listings */}
      {listings.length === 0 && !showForm ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Ни один канал ещё не выставлен в биржу взаимопиара. Нажмите «Выставить канал».
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {listings.map((l) => {
            const ch = channelById(l.channel_id);
            return (
              <Card key={l.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{ch?.title ?? '(канал)'}</span>
                      <Badge variant={l.status === 'active' ? 'success' : 'default'}>
                        {l.status === 'active' ? 'Активен' : 'Пауза'}
                      </Badge>
                      <Badge variant="outline">{topicLabel(l.topic)}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Охват ≈ {l.avg_reach.toLocaleString('ru-RU')} · {l.subscriber_count.toLocaleString('ru-RU')} подписчиков ·{' '}
                      {l.weekly_slots} ВП/нед · мин. партнёр {l.min_partner_reach_pct}%
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/dashboard/crosspromo/match/${l.id}`}>
                      <Button type="button" size="sm" disabled={l.status !== 'active'}>
                        <Search className="h-4 w-4" /> Найти партнёров
                      </Button>
                    </Link>
                    <Button type="button" variant="outline" size="sm" onClick={() => openEdit(l)} disabled={pending}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => handleToggle(l)} disabled={pending}>
                      {l.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
