import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Native <select> wrapped with a custom chevron and Input-matching styling.
 * For complex menus (search, multi-select, async loading) use a different
 * component — this one is for simple, accessible dropdowns.
 */
const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            'flex h-9 w-full appearance-none rounded-sm border border-input bg-card pl-3 pr-9 py-1.5',
            'text-sm text-foreground shadow-xs',
            'transition-base cursor-pointer',
            'focus-visible:outline-none focus-visible:border-primary focus-visible:shadow-focus',
            'hover:border-border-strong',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    );
  }
);
Select.displayName = 'Select';

export { Select };
