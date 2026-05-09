'use client';

import { useState } from 'react';
import { Briefcase } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AdvertiserSelect, type AdvertiserOption } from '@/components/dashboard/advertiser-select';

interface Props {
  advertisers: AdvertiserOption[];
  /** Initial values — for edit form */
  initial?: {
    advertiserId: string | null;
    priceRub: number | null;
    format: string | null;
  };
}

const FORMAT_PRESETS = ['1/24', '2/48', '3/72', 'нативка', 'закреп 24ч', 'без удаления'];

/**
 * "Реклама" block in the composer / edit form.
 * Always visible — selecting an advertiser turns the post into an ad post.
 * Emits hidden form fields:
 *   - advertiser_id (uuid or empty)
 *   - ad_price_rub (number)
 *   - ad_format (string)
 *
 * Server action reads these via readPlacementFields() and creates/updates
 * the ad_placements row linked to scheduled_post.
 */
export function AdPlacementSection({ advertisers, initial }: Props) {
  const [advertiserId, setAdvertiserId] = useState<string | null>(initial?.advertiserId ?? null);
  const [priceRub, setPriceRub] = useState<string>(
    initial?.priceRub != null ? String(initial.priceRub) : ''
  );
  const [format, setFormat] = useState<string>(initial?.format ?? '');
  // Local copy so we can append newly-created advertisers without a refetch
  const [localAdvertisers, setLocalAdvertisers] = useState(advertisers);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-xs">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <Briefcase className="h-4 w-4 text-muted-foreground" />
        Реклама
      </div>
      <p className="text-xs text-muted-foreground">
        Если это рекламный пост — выбери рекламодателя и укажи цену. Постплан запомнит сделку и автоматически добавит её в карточку клиента.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="advertiser_id" className="text-xs">Рекламодатель</Label>
        <AdvertiserSelect
          advertisers={localAdvertisers}
          value={advertiserId}
          onChange={setAdvertiserId}
          onCreated={(adv) => setLocalAdvertisers((prev) => [adv, ...prev])}
        />
        {/* Hidden field for FormData — empty when no advertiser selected */}
        <input type="hidden" name="advertiser_id" value={advertiserId ?? ''} />
      </div>

      {/* Price + format: only shown when an advertiser is selected — otherwise meaningless */}
      {advertiserId && (
        <div className="grid gap-3 sm:grid-cols-2 animate-fade-up">
          <div className="space-y-1.5">
            <Label htmlFor="ad_price_rub" className="text-xs">Цена, ₽</Label>
            <Input
              id="ad_price_rub"
              name="ad_price_rub"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={priceRub}
              onChange={(e) => setPriceRub(e.target.value)}
              placeholder="5000"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ad_format" className="text-xs">Формат</Label>
            <Input
              id="ad_format"
              name="ad_format"
              type="text"
              maxLength={50}
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              placeholder="1/24, нативка..."
              list="ad-format-presets"
              className="h-9"
            />
            <datalist id="ad-format-presets">
              {FORMAT_PRESETS.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
        </div>
      )}
    </div>
  );
}
