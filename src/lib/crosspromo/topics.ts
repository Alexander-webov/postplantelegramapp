/**
 * Crosspromo topic catalogue.
 *
 * A FIXED enum (not free text) is deliberate: matching only works if two
 * channels in the same niche resolve to the same key. Free text would split
 * "бизнес" / "про деньги" / "бизнес и финансы" into non-matching buckets.
 *
 * Keep this list in sync with the cp_topic enum in 011_crosspromo.sql.
 */

export const CP_TOPICS = [
  'business','crypto','tech','news','entertainment','lifestyle',
  'education','health','sports','gaming','beauty','travel',
  'finance','marketing','design','memes','music','food','other',
] as const;

export type CpTopic = (typeof CP_TOPICS)[number];

export const CP_TOPIC_LABELS: Record<CpTopic, string> = {
  business:      'Бизнес',
  crypto:        'Криптовалюта',
  tech:          'Технологии / IT',
  news:          'Новости',
  entertainment: 'Развлечения',
  lifestyle:     'Лайфстайл',
  education:     'Образование',
  health:        'Здоровье',
  sports:        'Спорт',
  gaming:        'Игры',
  beauty:        'Красота',
  travel:        'Путешествия',
  finance:       'Финансы / Инвестиции',
  marketing:     'Маркетинг / SMM',
  design:        'Дизайн',
  memes:         'Мемы / Юмор',
  music:         'Музыка',
  food:          'Еда / Кулинария',
  other:         'Другое',
};

export function isCpTopic(value: string): value is CpTopic {
  return (CP_TOPICS as readonly string[]).includes(value);
}

export function topicLabel(topic: string): string {
  return isCpTopic(topic) ? CP_TOPIC_LABELS[topic] : topic;
}

/** Human label for a deal status (used in the UI). */
export type CpDealStatus =
  | 'proposed' | 'accepted' | 'scheduled' | 'live'
  | 'completed' | 'failed' | 'cancelled' | 'declined';

export const CP_DEAL_STATUS_LABELS: Record<CpDealStatus, string> = {
  proposed:  'Ожидает ответа',
  accepted:  'Принято',
  scheduled: 'Запланировано',
  live:      'Опубликовано',
  completed: 'Завершено ✅',
  failed:    'Нарушено ❌',
  cancelled: 'Отменено',
  declined:  'Отклонено',
};

export function dealStatusLabel(status: string): string {
  return (CP_DEAL_STATUS_LABELS as Record<string, string>)[status] ?? status;
}
