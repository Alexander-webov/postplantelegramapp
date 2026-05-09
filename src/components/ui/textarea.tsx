import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'flex w-full rounded-sm border border-input bg-card px-3 py-2',
          'text-sm text-foreground shadow-xs resize-y min-h-20',
          'transition-base',
          'placeholder:text-muted-foreground/70',
          'focus-visible:outline-none focus-visible:border-primary focus-visible:shadow-focus',
          'hover:border-border-strong',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
