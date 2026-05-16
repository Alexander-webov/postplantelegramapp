'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/helpers';
import { createServiceClient } from '@/lib/supabase/server';
import { slugify, estimateReadingMinutes } from '@/lib/blog/markdown';

/**
 * Blog post CRUD — admin-only.
 *
 * All writes go through the service-role client because blog_posts has no
 * INSERT/UPDATE/DELETE RLS policies (the SELECT one is open to anon for
 * published posts). Authorization is enforced by requireAdmin() at the top
 * of every action.
 */

type SaveResult = { ok: true; id: string; slug: string } | { ok: false; error: string };

function pullField(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v : '';
}

/**
 * Create a new blog post. Slug is auto-generated from the title if not
 * provided; if the auto-slug collides with an existing row, a numeric
 * suffix is appended.
 */
export async function createBlogPostAction(formData: FormData): Promise<SaveResult> {
  const profile = await requireAdmin();
  const supabase = createServiceClient();

  const title = pullField(formData, 'title').trim();
  if (!title) return { ok: false, error: 'Заголовок обязателен' };

  const customSlug = pullField(formData, 'slug').trim();
  let slug = customSlug ? slugify(customSlug) : slugify(title);
  if (!slug) slug = `post-${Date.now()}`;

  // Resolve slug collision by appending -2, -3, ...
  for (let attempt = 1; attempt < 50; attempt++) {
    const { data: existing } = await supabase
      .from('blog_posts')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!existing) break;
    slug = (customSlug ? slugify(customSlug) : slugify(title)) + '-' + (attempt + 1);
  }

  const content_md = pullField(formData, 'content_md');
  const is_published = pullField(formData, 'is_published') === '1';

  const { data, error } = await supabase
    .from('blog_posts')
    .insert({
      slug,
      title,
      excerpt: pullField(formData, 'excerpt') || null,
      content_md,
      cover_image_url: pullField(formData, 'cover_image_url') || null,
      meta_title: pullField(formData, 'meta_title') || null,
      meta_description: pullField(formData, 'meta_description') || null,
      og_image_url: pullField(formData, 'og_image_url') || null,
      is_published,
      published_at: is_published ? new Date().toISOString() : null,
      author_name: pullField(formData, 'author_name') || profile.full_name || 'Команда Постплан',
      author_id: profile.id,
      reading_minutes: estimateReadingMinutes(content_md),
    })
    .select('id, slug')
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath('/blog');
  revalidatePath(`/blog/${data.slug}`);
  revalidatePath('/admin/posts');
  return { ok: true, id: data.id, slug: data.slug };
}

export async function updateBlogPostAction(
  id: string,
  formData: FormData,
): Promise<SaveResult> {
  await requireAdmin();
  const supabase = createServiceClient();

  const title = pullField(formData, 'title').trim();
  if (!title) return { ok: false, error: 'Заголовок обязателен' };

  // Need the existing row to decide whether to set published_at now
  const { data: existing } = await supabase
    .from('blog_posts')
    .select('slug, is_published, published_at')
    .eq('id', id)
    .single();

  if (!existing) return { ok: false, error: 'Статья не найдена' };

  const customSlug = pullField(formData, 'slug').trim();
  let slug = customSlug ? slugify(customSlug) : existing.slug;
  if (!slug) slug = existing.slug;

  // Slug changed → check for collision (excluding this row)
  if (slug !== existing.slug) {
    const { data: clash } = await supabase
      .from('blog_posts')
      .select('id')
      .eq('slug', slug)
      .neq('id', id)
      .maybeSingle();
    if (clash) return { ok: false, error: `Slug «${slug}» уже занят` };
  }

  const content_md = pullField(formData, 'content_md');
  const is_published = pullField(formData, 'is_published') === '1';
  // Set published_at the first time the post is published; keep the original
  // value if it was already published before.
  const published_at =
    is_published && !existing.is_published
      ? new Date().toISOString()
      : is_published
        ? existing.published_at
        : null;

  const { error } = await supabase
    .from('blog_posts')
    .update({
      slug,
      title,
      excerpt: pullField(formData, 'excerpt') || null,
      content_md,
      cover_image_url: pullField(formData, 'cover_image_url') || null,
      meta_title: pullField(formData, 'meta_title') || null,
      meta_description: pullField(formData, 'meta_description') || null,
      og_image_url: pullField(formData, 'og_image_url') || null,
      is_published,
      published_at,
      author_name: pullField(formData, 'author_name') || null,
      reading_minutes: estimateReadingMinutes(content_md),
    })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/blog');
  revalidatePath(`/blog/${slug}`);
  revalidatePath(`/blog/${existing.slug}`);
  revalidatePath('/admin/posts');
  return { ok: true, id, slug };
}

export async function deleteBlogPostAction(formData: FormData) {
  await requireAdmin();
  const id = pullField(formData, 'id');
  if (!id) return;

  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from('blog_posts')
    .select('slug')
    .eq('id', id)
    .single();

  await supabase.from('blog_posts').delete().eq('id', id);

  revalidatePath('/blog');
  if (existing?.slug) revalidatePath(`/blog/${existing.slug}`);
  revalidatePath('/admin/posts');
  redirect('/admin/posts');
}
