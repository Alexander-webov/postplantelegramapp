import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  cn(
    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
    'whitespace-nowrap transition-base',
    '[&_svg]:size-3 [&_svg]:shrink-0'
  ),
  {
    variants: {
      variant: {
        default: 'bg-secondary text-secondary-foreground',
        primary: 'pill-soft-primary',
        success: 'pill-soft-success',
        warning: 'pill-soft-warning',
        destructive: 'pill-soft-destructive',
        outline: 'border border-border text-foreground bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant, className }))} {...props} />
  )
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
