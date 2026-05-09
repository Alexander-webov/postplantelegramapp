'use client';

import { useState, useEffect } from 'react';
import { Trash2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const PRESETS: { value: number | null; label: string }[] = [
  { value: null, label: 'Никогда' },
  { value: 1, label: '1ч' },
  { value: 6, label: '6ч' },
  { value: 12, label: '12ч' },
  { value: 24, label: '24ч' },
  { value: 48, label: '48ч' },
];

interface Props {
  /** null = no auto-delete, number = hours after publication */
  value: number | null;
  onChange: (next: number | null) => void;
  /** Form field name — emitted as hidden input so server reads from FormData */
  name?: string;
}

/**
 * Auto-delete selector. Preset chips for common values + collapsible custom
 * input. Emits a hidden input under `name` so existing form pipelines work.
 *
 * Use case: rebrand/promo posts that should be removed after the contracted
 * window expires. Telegram bot deletes via deleteMessage API, must be admin
 * to delete messages older than 48h (which all our bots are by design).
 */
export function AutoDeleteSelect({ value, onChange, name = 'auto_delete_after_hours' }: Props) {
  // Custom mode is active when value is set but doesn't match any preset
  const [showCustom, setShowCustom] = useState(
    value !== null && !PRESETS.some((p) => p.value === value)
  );
  const [customValue, setCustomValue] = useState<string>(
    value !== null && !PRESETS.some((p) => p.value === value) ? String(value) : ''
  );

  // Keep custom input in sync if value changes externally (e.g. clear via reset)
  useEffect(() => {
    if (value === null) setCustomValue('');
    else if (!PRESETS.some((p) => p.value === value)) setCustomValue(String(value));
  }, [value]);

  function selectPreset(v: number | null) {
    setShowCustom(false);
    setCustomValue('');
    onChange(v);
  }

  function handleCustomChange(raw: string) {
    setCustomValue(raw);
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n) && n > 0 && n <= 720) {
      onChange(n);
    } else if (raw === '') {
      onChange(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((p) => {
          const isActive = !showCustom && value === p.value;
          return (
            <button
              key={String(p.value)}
              type="button"
              onClick={() => selectPreset(p.value)}
              className={cn(
                'rounded-sm border px-2.5 py-1 text-xs font-medium transition-base',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:border-border-strong hover:bg-accent'
              )}
            >
              {p.value === null && <Clock className="mr-1 inline h-3 w-3" />}
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setShowCustom(true);
            if (customValue) handleCustomChange(customValue);
          }}
          className={cn(
            'rounded-sm border px-2.5 py-1 text-xs font-medium transition-base',
            showCustom
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card text-foreground hover:border-border-strong hover:bg-accent'
          )}
        >
          Свой
        </button>
      </div>

      {showCustom && (
        <div className="flex items-center gap-2 animate-fade-up">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={720}
            placeholder="Часов"
            value={customValue}
            onChange={(e) => handleCustomChange(e.target.value)}
            className="h-8 w-24 rounded-sm border border-input bg-card px-2 text-sm shadow-xs focus-visible:border-primary focus-visible:outline-none focus-visible:shadow-focus"
          />
          <span className="text-xs text-muted-foreground">часов после публикации (макс. 720 = 30 дней)</span>
        </div>
      )}

      {/* Hidden input — server-action reads this via FormData */}
      {value !== null && (
        <input type="hidden" name={name} value={String(value)} />
      )}

      {value !== null && (
        <div className="flex items-start gap-2 rounded-sm border border-warning/30 bg-warning-soft px-2.5 py-2 text-xs">
          <Trash2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          <span className="text-foreground">
            Пост автоматически удалится через{' '}
            <strong>
              {value} {value === 1 ? 'час' : value < 5 ? 'часа' : 'часов'}
            </strong>{' '}
            после публикации. Из канала уйдут все элементы (текст и медиа).
          </span>
        </div>
      )}
    </div>
  );
}
