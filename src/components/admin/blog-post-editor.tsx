'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createBlogPostAction,
  updateBlogPostAction,
} from '@/app/actions/blog';
import { renderMarkdown, slugify } from '@/lib/blog/markdown';

/**
 * Blog post editor — used by /admin/posts/new and /admin/posts/[id]/edit.
 *
 * Server actions handle persistence. This component just collects form
 * data, shows a live Markdown preview, and surfaces errors. No new
 * dependencies — preview uses our in-repo Markdown renderer.
 */

type EditorPost = {
  id?: string;
  slug?: string;
  title?: string;
  excerpt?: string | null;
  content_md?: string;
  cover_image_url?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  og_image_url?: string | null;
  is_published?: boolean;
  author_name?: string | null;
};

export function BlogPostEditor({ initial }: { initial?: EditorPost }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? '');
  const [content, setContent] = useState(initial?.content_md ?? '');
  const [coverImage, setCoverImage] = useState(initial?.cover_image_url ?? '');
  const [metaTitle, setMetaTitle] = useState(initial?.meta_title ?? '');
  const [metaDescription, setMetaDescription] = useState(initial?.meta_description ?? '');
  const [ogImage, setOgImage] = useState(initial?.og_image_url ?? '');
  const [isPublished, setIsPublished] = useState(initial?.is_published ?? false);
  const [authorName, setAuthorName] = useState(initial?.author_name ?? '');

  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleTitleBlur() {
    if (!slug && title) setSlug(slugify(title));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const fd = new FormData();
    fd.set('title', title);
    fd.set('slug', slug);
    fd.set('excerpt', excerpt ?? '');
    fd.set('content_md', content);
    fd.set('cover_image_url', coverImage ?? '');
    fd.set('meta_title', metaTitle ?? '');
    fd.set('meta_description', metaDescription ?? '');
    fd.set('og_image_url', ogImage ?? '');
    fd.set('is_published', isPublished ? '1' : '0');
    fd.set('author_name', authorName ?? '');

    const result = initial?.id
      ? await updateBlogPostAction(initial.id, fd)
      : await createBlogPostAction(fd);

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    startTransition(() => {
      if (initial?.id) {
        // Stay on edit page after update
        router.refresh();
      } else {
        router.push(`/admin/posts/${result.id}/edit`);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {initial?.id ? 'Редактировать статью' : 'Новая статья'}
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface-sunken/40"
          >
            {showPreview ? 'Редактор' : 'Превью'}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main fields */}
        <div className="space-y-4 lg:col-span-2">
          <Field label="Заголовок *">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              placeholder="Например: Маркировка рекламы в Telegram в 2026"
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-lg focus:border-primary focus:outline-none"
              required
            />
          </Field>

          <Field label="Slug" hint="URL статьи: /blog/<slug>. Латиница и дефисы. Заполнится сам из заголовка.">
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="markirovka-reklamy-telegram-2026"
              className="w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none"
            />
          </Field>

          <Field label="Краткое описание (для списка)">
            <textarea
              value={excerpt ?? ''}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={2}
              className="w-full resize-y rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="1-2 предложения о чём статья. Показывается в списке статей и в поисковой выдаче."
            />
          </Field>

          <Field
            label="Контент"
            hint="Markdown: ## H2, ### H3, **жирный**, *курсив*, - списки, > цитаты, [ссылки](url), ![картинка](url)"
          >
            {showPreview ? (
              <div className="min-h-[400px] rounded-md border border-border bg-card px-5 py-4">
                <div className="text-base text-foreground/90">{renderMarkdown(content)}</div>
              </div>
            ) : (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={22}
                className="w-full resize-y rounded-md border border-border bg-card px-3 py-2 font-mono text-sm leading-relaxed focus:border-primary focus:outline-none"
                placeholder="## Введение&#10;&#10;Текст первого абзаца…"
              />
            )}
          </Field>
        </div>

        {/* Sidebar — publishing + SEO */}
        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="font-semibold">Публикация</h3>
            <label className="mt-3 flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span>
                Опубликовать
                <p className="text-xs text-muted-foreground">
                  Если выключено — статья сохранится как черновик и не появится в /blog.
                </p>
              </span>
            </label>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <h3 className="font-semibold">Обложка</h3>
            <Field label="URL обложки" compact>
              <input
                type="url"
                value={coverImage ?? ''}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-md border border-border bg-surface-sunken/30 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </Field>
            <Field label="Автор" compact>
              <input
                type="text"
                value={authorName ?? ''}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Команда Постплан"
                className="w-full rounded-md border border-border bg-surface-sunken/30 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </Field>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <h3 className="font-semibold">SEO</h3>
            <Field label="Meta title (для поиска)" compact hint="Если пусто — берётся заголовок.">
              <input
                type="text"
                value={metaTitle ?? ''}
                onChange={(e) => setMetaTitle(e.target.value)}
                maxLength={60}
                className="w-full rounded-md border border-border bg-surface-sunken/30 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </Field>
            <Field label="Meta description" compact hint="До 160 символов. Видно в выдаче.">
              <textarea
                value={metaDescription ?? ''}
                onChange={(e) => setMetaDescription(e.target.value)}
                maxLength={160}
                rows={3}
                className="w-full resize-y rounded-md border border-border bg-surface-sunken/30 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
              <p className="mt-1 text-xs text-muted-foreground">{(metaDescription ?? '').length}/160</p>
            </Field>
            <Field label="OG image (для соцсетей)" compact hint="Если пусто — берётся обложка.">
              <input
                type="url"
                value={ogImage ?? ''}
                onChange={(e) => setOgImage(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-md border border-border bg-surface-sunken/30 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </Field>
          </div>
        </aside>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  compact,
  children,
}: {
  label: string;
  hint?: string;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={`block text-sm font-medium ${compact ? 'mb-1' : 'mb-1.5'}`}>{label}</label>
      {hint ? <p className="mb-1.5 text-xs text-muted-foreground">{hint}</p> : null}
      {children}
    </div>
  );
}
