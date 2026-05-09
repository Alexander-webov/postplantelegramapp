import Link from 'next/link';
import { Plus, FileText, Hash, Signature, Lock, Sparkles, ArrowRight, Star } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireUser, getProfile } from '@/lib/auth/helpers';
import { getEffectiveTier } from '@/lib/usage';
import { tierAllowsTemplates } from '@/lib/tiers';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { TemplateRowActions } from '@/components/dashboard/template-row-actions';

export const metadata = { title: 'Шаблоны' };

const kindConfig = {
  signature: {
    label: 'Подписи',
    icon: Signature,
    help: 'Авто-добавляются в конец каждого поста, если подпись активна.',
    placeholder: 'Создай свою первую подпись — например, ссылку на канал или дисклеймер.',
  },
  post: {
    label: 'Шаблоны постов',
    icon: FileText,
    help: 'Готовые посты с переменными — вставляются в композер одним кликом.',
    placeholder: 'Сохрани часто используемые посты как шаблоны — анонсы, рубрики, утренние подборки.',
  },
  hashtags: {
    label: 'Наборы хештегов',
    icon: Hash,
    help: 'Группы хештегов, которые добавляются в конец поста кнопкой.',
    placeholder: 'Создай набор хештегов для разных тем твоего канала.',
  },
} as const;

type Kind = keyof typeof kindConfig;

export default async function TemplatesPage() {
  const user = await requireUser();
  const profile = await getProfile();
  const tier = getEffectiveTier(profile);
  const canUseTemplates = tierAllowsTemplates(tier);
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from('templates')
    .select('id, kind, name, content, is_signature, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const all = templates ?? [];
  const byKind: Record<Kind, typeof all> = {
    signature: all.filter((t) => t.kind === 'signature'),
    post: all.filter((t) => t.kind === 'post'),
    hashtags: all.filter((t) => t.kind === 'hashtags'),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Шаблоны"
        description="Подписи, готовые посты и наборы хештегов — экономят минуты на каждом посте."
        action={
          canUseTemplates ? (
            <Button asChild>
              <Link href="/dashboard/templates/new">
                <Plus className="h-4 w-4" />
                Новый шаблон
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href="/dashboard/billing">
                <Lock className="h-4 w-4" />
                Доступно на платных
              </Link>
            </Button>
          )
        }
      />

      {/* Free-tier upgrade banner */}
      {!canUseTemplates && (
        <Card className="border-primary/30 bg-primary-soft/40">
          <CardContent className="flex items-start gap-4 p-5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-card shadow-xs">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h3 className="font-medium">Шаблоны — на платных тарифах</h3>
              <p className="text-sm text-muted-foreground">
                Подписи к каналу, готовые посты с переменными ({'{{date}}'}, {'{{day_of_week}}'}, {'{{channel_username}}'}), наборы хештегов. Доступно на тарифах <strong className="text-foreground">Базовый</strong> (299 ₽) и <strong className="text-foreground">Профи</strong> (690 ₽).
              </p>
            </div>
            <Button asChild>
              <Link href="/dashboard/billing">
                Тарифы
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Three sections */}
      {(['signature', 'post', 'hashtags'] as const).map((kind) => {
        const cfg = kindConfig[kind];
        const Icon = cfg.icon;
        const items = byKind[kind];
        return (
          <section key={kind} className="space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  {cfg.label} ({items.length})
                </h2>
                {canUseTemplates && (
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/dashboard/templates/new?kind=${kind}`}>
                      <Plus className="h-3.5 w-3.5" />
                      Создать
                    </Link>
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{cfg.help}</p>
            </div>

            {items.length === 0 ? (
              <Card className="border-dashed bg-card/50">
                <CardContent className="px-5 py-6 text-center">
                  <p className="text-sm text-muted-foreground">{cfg.placeholder}</p>
                  {canUseTemplates && (
                    <Button asChild size="sm" variant="ghost" className="mt-2">
                      <Link href={`/dashboard/templates/new?kind=${kind}`}>
                        <Plus className="h-3.5 w-3.5" />
                        Создать первый
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-2">
                  {items.map((t, i) => (
                    <div key={t.id}>
                      {i > 0 && <div className="h-px bg-border/60" />}
                      <div className="group flex items-start gap-3 rounded-sm px-3 py-3 transition-base hover:bg-accent/50">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-secondary">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{t.name}</span>
                            {kind === 'signature' && t.is_signature && (
                              <Badge variant="success" className="shrink-0">
                                <Star className="h-3 w-3 fill-current" />
                                активна
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap break-all text-sm text-muted-foreground">
                            {t.content || '(пусто)'}
                          </p>
                        </div>
                        <div className="opacity-0 transition-base group-hover:opacity-100">
                          <TemplateRowActions
                            id={t.id}
                            kind={t.kind}
                            isActiveSignature={!!t.is_signature}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </section>
        );
      })}
    </div>
  );
}
