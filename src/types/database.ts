/**
 * Supabase-generated types live here.
 *
 * After the migration is applied, regenerate this file:
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts
 *
 * Or for local development:
 *   npx supabase gen types typescript --local > src/types/database.ts
 *
 * The placeholder below lets the project compile until you regenerate.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      subscription_tier: 'free' | 'start' | 'pro' | 'network';
      subscription_status: 'active' | 'cancelled' | 'expired' | 'trialing';
      post_status: 'draft' | 'scheduled' | 'published' | 'failed' | 'archived';
      schedule_status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
      media_type: 'photo' | 'video' | 'animation' | 'document' | 'audio';
      tg_parse_mode: 'HTML' | 'MarkdownV2' | 'plain';
      payment_provider: 'yookassa' | 'stripe';
      payment_status: 'pending' | 'succeeded' | 'failed' | 'refunded';
    };
  };
}
