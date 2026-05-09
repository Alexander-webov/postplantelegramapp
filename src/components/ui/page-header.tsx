import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** Eyebrow text shown above title in small caps */
  eyebrow?: string;
}

/**
 * Consistent page header. Use at the top of every dashboard page to anchor
 * the layout and give the user a clear "where am I" signal.
 *
 *   <PageHeader title="Каналы" description="…" action={<Button>Add</Button>} />
 */
export function PageHeader({ title, description, action, className, eyebrow }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {description && (
          <p className="mt-1.5 text-[15px] text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
