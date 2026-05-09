import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/helpers';
import { EditScheduledForm } from '@/components/dashboard/edit-scheduled-form';
import type { UploadedMedia } from '@/components/dashboard/media-uploader';

export const metadata = { title: 'Редактирование' };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditScheduledPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  // Load the scheduled post + its post + media
  const { data: row } = await supabase
    .from('scheduled_posts')
    .select(`
      id, scheduled_at, status, channel_id, auto_delete_after_hours,
      posts (
        id, content, disable_preview, silent, applied_signature_id,
        post_media (id, type, storage_path, position)
      )
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!row) notFound();
  if (row.status !== 'pending') {
    notFound(); // redirect could be friendlier — but for now: only pending is editable
  }

  const post = Array.isArray(row.posts) ? row.posts[0] : row.posts;
  if (!post) notFound();

  // Load active channels for the dropdown
  const [channelsRes, advertisersRes, placementRes] = await Promise.all([
    supabase
      .from('channels')
      .select('id, title, username')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('title'),
    supabase
      .from('advertisers')
      .select('id, name, telegram_username')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .order('name'),
    supabase
      .from('ad_placements')
      .select('advertiser_id, price_rub, format')
      .eq('scheduled_post_id', id)
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  const channels = channelsRes.data;
  const advertisers = advertisersRes.data ?? [];
  const placement = placementRes.data;

  // Build initial media list with signed URLs for previews
  const mediaRows = (post.post_media ?? [])
    .slice()
    .sort((a, b) => a.position - b.position);

  const media: UploadedMedia[] = await Promise.all(
    mediaRows.map(async (m) => {
      const { data: signed } = await supabase.storage
        .from('post-media')
        .createSignedUrl(m.storage_path, 60 * 60);
      // We don't have stored mime/filename for old rows — derive from path
      const filename = m.storage_path.split('/').pop() ?? 'file';
      const ext = filename.split('.').pop()?.toLowerCase() ?? '';
      let mime = 'application/octet-stream';
      if (['jpg', 'jpeg'].includes(ext)) mime = 'image/jpeg';
      else if (ext === 'png') mime = 'image/png';
      else if (ext === 'webp') mime = 'image/webp';
      else if (ext === 'gif') mime = 'image/gif';
      else if (ext === 'mp4') mime = 'video/mp4';
      else if (ext === 'mov') mime = 'video/quicktime';
      else if (ext === 'webm') mime = 'video/webm';
      return {
        path: m.storage_path,
        kind: m.type as 'photo' | 'video' | 'animation',
        mime,
        size: 0,
        filename,
        preview_url: signed?.signedUrl ?? null,
      };
    })
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href="/dashboard/queue">
          <ArrowLeft className="h-3.5 w-3.5" />
          К очереди
        </Link>
      </Button>

      <PageHeader
        title="Редактировать пост"
        description="Изменения применятся к запланированной отправке. Оригинал в Telegram пока не опубликован."
      />

      <Card>
        <CardContent className="pt-5">
          <EditScheduledForm
            scheduledId={id}
            channels={channels ?? []}
            advertisers={advertisers}
            initial={{
              channel_id: row.channel_id,
              content: post.content ?? '',
              disable_preview: post.disable_preview ?? false,
              silent: post.silent ?? false,
              scheduled_at_utc: row.scheduled_at,
              media,
              applied_signature_id: post.applied_signature_id ?? null,
              auto_delete_after_hours: row.auto_delete_after_hours ?? null,
              placement: {
                advertiserId: placement?.advertiser_id ?? null,
                priceRub: placement?.price_rub != null ? Number(placement.price_rub) : null,
                format: placement?.format ?? null,
              },
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
