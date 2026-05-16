'use client';

import { deleteBlogPostAction } from '@/app/actions/blog';

/**
 * Confirm-before-delete button for a blog post. We can't use onClick on a
 * <button> inside a Server Action <form>, so the whole form is rendered
 * client-side here and submitted via the action when confirmed.
 */
export function DeletePostButton({ id, title }: { id: string; title: string }) {
  return (
    <form
      action={deleteBlogPostAction}
      onSubmit={(e) => {
        if (!window.confirm(`Удалить статью «${title}»? Действие необратимо.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="rounded-md border border-destructive/40 bg-card px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
      >
        Удалить навсегда
      </button>
    </form>
  );
}
