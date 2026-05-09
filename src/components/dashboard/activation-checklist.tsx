import Link from 'next/link';
import { CheckCircle2, Circle, ArrowRight, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Step {
  /** Whether this step is already completed */
  done: boolean;
  /** Title shown in checklist */
  title: string;
  /** Optional subtitle for context */
  subtitle?: string;
  /** Where to go to complete this step (only shown for incomplete steps) */
  href: string;
  cta: string;
}

interface Props {
  hasChannels: boolean;
  hasPostedAtLeastOnce: boolean;
  hasTemplates: boolean;
  hasFirstAdvertiser: boolean;
}

/**
 * Activation checklist for new users. Walks through 4 milestones that take a
 * user from "just signed up" to "core value extracted":
 *
 * 1. Connect first channel — without this nothing else works
 * 2. Send first post — proves the publish loop end-to-end
 * 3. Create a template/signature — encourages reuse, signals product engagement
 * 4. Add first advertiser — entry point to Revenue OS for monetised channels
 *
 * Hidden entirely once all 4 are done. We don't store dismiss state in DB
 * because the checklist IS the progress — when complete it just disappears.
 */
export function ActivationChecklist({
  hasChannels, hasPostedAtLeastOnce, hasTemplates, hasFirstAdvertiser,
}: Props) {
  const steps: Step[] = [
    {
      done: hasChannels,
      title: 'Подключи Telegram-канал',
      subtitle: 'Создай бота через @BotFather и добавь его в свой канал',
      href: '/dashboard/channels/connect',
      cta: 'Подключить',
    },
    {
      done: hasPostedAtLeastOnce,
      title: 'Опубликуй первый пост',
      subtitle: 'Можно отправить сразу или запланировать на потом',
      href: '/dashboard/posts/new',
      cta: 'Создать пост',
    },
    {
      done: hasTemplates,
      title: 'Сохрани шаблон или подпись',
      subtitle: 'Чтобы не печатать одно и то же каждый раз',
      href: '/dashboard/templates',
      cta: 'Шаблоны',
    },
    {
      done: hasFirstAdvertiser,
      title: 'Добавь рекламодателя',
      subtitle: 'Начни вести историю размещений и считать заработок',
      href: '/dashboard/advertisers/new',
      cta: 'Добавить',
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;

  // Hide entirely once all done — no point showing 4/4 forever
  if (doneCount === total) return null;

  // Find the first incomplete step — that's the "next action" we highlight
  const nextStep = steps.find((s) => !s.done);

  return (
    <Card className="overflow-hidden border-primary/20">
      <div className="relative">
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.4), transparent)' }}
          aria-hidden
        />
        <CardContent className="relative space-y-5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <Badge variant="primary">
                <Sparkles className="h-3 w-3" />
                Начало работы
              </Badge>
              <h2 className="text-lg font-semibold tracking-tight">
                {doneCount === 0
                  ? 'С чего начать в Постплане'
                  : `Готово ${doneCount} из ${total}`}
              </h2>
            </div>
            <ProgressRing progress={doneCount / total} />
          </div>

          <ul className="space-y-2">
            {steps.map((step, i) => (
              <li
                key={i}
                className={cn(
                  'flex items-start gap-3 rounded-sm border px-3 py-2.5 transition-base',
                  step.done
                    ? 'border-success/30 bg-success-soft/30'
                    : step === nextStep
                    ? 'border-primary/40 bg-primary-soft/30'
                    : 'border-border bg-card'
                )}
              >
                {step.done ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
                )}
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      'text-sm font-medium',
                      step.done && 'text-muted-foreground line-through'
                    )}
                  >
                    {step.title}
                  </div>
                  {step.subtitle && !step.done && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{step.subtitle}</p>
                  )}
                </div>
                {!step.done && (
                  <Link
                    href={step.href}
                    className={cn(
                      'inline-flex items-center gap-1 self-center whitespace-nowrap rounded-sm px-2.5 py-1 text-xs font-medium transition-base',
                      step === nextStep
                        ? 'bg-primary text-primary-foreground hover:opacity-90'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    {step.cta}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </div>
    </Card>
  );
}

/** Compact circular progress indicator — pure SVG, no JS state */
function ProgressRing({ progress }: { progress: number }) {
  const size = 48;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(1, progress)));

  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="hsl(var(--border))" strokeWidth={stroke} fill="none"
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="hsl(var(--primary))" strokeWidth={stroke} fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.4s ease-out' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">
        {Math.round(progress * 100)}%
      </span>
    </div>
  );
}
