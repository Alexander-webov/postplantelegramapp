/**
 * Temporary hand-written Supabase types generated from the migrations in this repo.
 * Replace with `npx supabase gen types typescript ...` after the project is linked.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type SubscriptionTier = 'free' | 'start' | 'pro' | 'network';
type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'trialing';
type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed' | 'archived';
type ScheduleStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
type MediaType = 'photo' | 'video' | 'animation' | 'document' | 'audio';
type TgParseMode = 'HTML' | 'MarkdownV2' | 'plain';
type PaymentProvider = 'yookassa' | 'stripe';
type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';
type TemplateKind = 'signature' | 'post' | 'hashtags';
type PlacementStatus = 'draft' | 'awaiting_payment' | 'paid' | 'published' | 'reported' | 'cancelled';

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row & Record<string, unknown>;
  Insert: Insert & Record<string, unknown>;
  Update: Update & Record<string, unknown>;
  Relationships: [];
};

type AnyTable = Table<Record<string, any>, Record<string, any>, Record<string, any>>;

export interface Database {
  public: {
    Tables: {
      profiles: Table<{
        id: string;
        email: string;
        full_name: string | null;
        avatar_url: string | null;
        subscription_tier: SubscriptionTier;
        subscription_expires_at: string | null;
        yookassa_customer_id: string | null;
        is_admin: boolean;
        created_at: string;
        updated_at: string;
      }>;
      blog_posts: Table<{
        id: string;
        slug: string;
        title: string;
        excerpt: string | null;
        content_md: string;
        cover_image_url: string | null;
        meta_title: string | null;
        meta_description: string | null;
        og_image_url: string | null;
        is_published: boolean;
        published_at: string | null;
        author_name: string | null;
        author_id: string | null;
        reading_minutes: number | null;
        view_count: number;
        created_at: string;
        updated_at: string;
      }>;
      bots: Table<{
        id: string;
        user_id: string;
        token_encrypted: string;
        username: string;
        first_name: string | null;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>;
      channels: Table<{
        id: string;
        user_id: string;
        bot_id: string;
        telegram_chat_id: string;
        title: string;
        username: string | null;
        photo_url: string | null;
        subscriber_count: number | null;
        is_active: boolean;
        last_synced_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      templates: Table<{
        id: string;
        user_id: string;
        name: string;
        content: string;
        default_buttons: Json;
        default_hashtags: string[];
        is_signature: boolean;
        kind: TemplateKind;
        created_at: string;
        updated_at: string;
      }>;
      posts: Table<{
        id: string;
        user_id: string;
        title: string | null;
        content: string;
        parse_mode: TgParseMode;
        disable_preview: boolean;
        silent: boolean;
        status: PostStatus;
        template_id: string | null;
        applied_signature_id: string | null;
        created_at: string;
        updated_at: string;
      }>;
      post_media: Table<{
        id: string;
        post_id: string;
        type: MediaType;
        storage_path: string;
        storage_url: string | null;
        caption: string | null;
        position: number;
        width: number | null;
        height: number | null;
        duration_seconds: number | null;
        file_size_bytes: number | null;
        created_at: string;
      }>;
      'post-media': AnyTable;
      post_buttons: Table<{
        id: string;
        post_id: string;
        row: number;
        col: number;
        text: string;
        url: string;
        created_at: string;
      }>;
      post_polls: Table<{
        post_id: string;
        question: string;
        options: Json;
        is_anonymous: boolean;
        allows_multiple_answers: boolean;
        is_quiz: boolean;
        correct_option_id: number | null;
        created_at: string;
      }>;
      scheduled_posts: Table<{
        id: string;
        user_id: string;
        post_id: string;
        channel_id: string;
        scheduled_at: string;
        status: ScheduleStatus;
        telegram_message_id: number | null;
        telegram_message_ids: number[] | null;
        error_message: string | null;
        retry_count: number;
        next_retry_at: string | null;
        sent_at: string | null;
        custom_content: string | null;
        custom_disable_preview: boolean | null;
        custom_silent: boolean | null;
        auto_delete_after_hours: number | null;
        auto_delete_at: string | null;
        auto_deleted_at: string | null;
        auto_delete_error: string | null;
        deleted_at: string | null;
        last_edited_at: string | null;
        views_latest: number | null;
        views_latest_at: string | null;
        views_1h: number | null;
        views_6h: number | null;
        views_24h: number | null;
        views_48h: number | null;
        views_error: string | null;
        created_at: string;
        updated_at: string;
      }>;
      post_analytics: Table<{
        id: string;
        scheduled_post_id: string;
        views: number | null;
        reactions: Json;
        forwards: number | null;
        replies: number | null;
        snapshot_at: string;
      }>;
      channel_analytics: Table<{
        id: string;
        channel_id: string;
        subscriber_count: number;
        snapshot_date: string;
      }>;
      subscriptions: Table<{
        id: string;
        user_id: string;
        tier: SubscriptionTier;
        status: SubscriptionStatus;
        provider: PaymentProvider;
        provider_subscription_id: string | null;
        current_period_start: string;
        current_period_end: string;
        cancel_at_period_end: boolean;
        created_at: string;
        updated_at: string;
      }>;
      payment_history: Table<{
        id: string;
        user_id: string;
        subscription_id: string | null;
        amount: number | string;
        currency: string;
        status: PaymentStatus;
        provider: PaymentProvider;
        provider_payment_id: string;
        metadata: Json;
        created_at: string;
      }>;
      payments: Table<{
        id: string;
        user_id: string;
        yookassa_payment_id: string | null;
        idempotence_key: string;
        tier: SubscriptionTier;
        period_days: number;
        amount_rub: number | string;
        currency: string;
        status: PaymentStatus;
        confirmation_url: string | null;
        payment_method_type: string | null;
        paid: boolean | null;
        cancellation_reason: string | null;
        error_message: string | null;
        webhook_received_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      advertisers: Table<{
        id: string;
        user_id: string;
        name: string;
        telegram_username: string | null;
        contact: string | null;
        notes: string | null;
        total_placements: number;
        total_revenue_rub: number | string;
        archived_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      ad_placements: Table<{
        id: string;
        user_id: string;
        advertiser_id: string;
        scheduled_post_id: string;
        price_rub: number | string;
        format: string | null;
        status: PlacementStatus;
        notes: string | null;
        paid_at: string | null;
        report_slug: string | null;
        report_generated_at: string | null;
        report_first_viewed_at: string | null;
        report_last_viewed_at: string | null;
        report_view_count: number;
        created_at: string;
        updated_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      generate_placement_slug: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
    };
    Enums: {
      subscription_tier: SubscriptionTier;
      subscription_status: SubscriptionStatus;
      post_status: PostStatus;
      schedule_status: ScheduleStatus;
      media_type: MediaType;
      tg_parse_mode: TgParseMode;
      payment_provider: PaymentProvider;
      payment_status: PaymentStatus;
      template_kind: TemplateKind;
      placement_status: PlacementStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
