import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { BlogPostEditor } from '@/components/admin/blog-post-editor';
import { DeletePostButton } from '@/components/admin/delete-post-button';

export const dynamic = 'force-dynamic';

export default async function EditBlogPostPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServiceClient();
  const { data: post } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!post) notFound();

  return (
    <div className="space-y-8">
      <BlogPostEditor initial={post} />

      <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
        <h3 className="font-semibold text-destructive">Удалить статью</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Удаление необратимо. Обратной кнопки нет — отменить нельзя.
        </p>
        <div className="mt-4">
          <DeletePostButton id={post.id} title={post.title} />
        </div>
      </section>
    </div>
  );
}
