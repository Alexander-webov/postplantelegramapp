import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/helpers';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { findCpMatches } from '@/app/actions/crosspromo';
import { topicLabel } from '@/lib/crosspromo/topics';
import { MatchList } from '@/components/dashboard/crosspromo/match-list';

export const metadata = { title: 'Подбор партнёров' };

export default async function MatchPage({ params }: { params: { listingId: string } }) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: listing } = await supabase
    .from('cp_listings')
    .select('id, topic, avg_reach, channels(title)')
    .eq('id', params.listingId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!listing) notFound();

  const channel = Array.isArray(listing.channels) ? listing.channels[0] : listing.channels;
  const { matches, error } = await findCpMatches(params.listingId);

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/crosspromo"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-base hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Назад к взаимопиару
      </Link>

      <PageHeader
        eyebrow={`${(channel as { title?: string })?.title ?? 'Канал'} · ${topicLabel(listing.topic)}`}
        title="Подбор партнёров"
        description={`Каналы той же тематики со схожим охватом (твой ≈ ${listing.avg_reach.toLocaleString('ru-RU')}). Сначала — проверенные.`}
      />

      {error ? (
        <EmptyState icon={ShieldCheck} title="Не удалось загрузить" description={error} />
      ) : !matches || matches.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Пока нет подходящих партнёров"
          description="В твоей тематике и диапазоне охвата ещё нет активных каналов. Загляни позже — биржа растёт. Или измени тематику/мин. охват партнёра в настройках листинга."
        />
      ) : (
        <MatchList myListingId={params.listingId} matches={matches} />
      )}
    </div>
  );
}
