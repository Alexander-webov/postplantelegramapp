import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Postplan Button.
 *
 * Variants:
 *  - default     — filled primary, layered shadow, hover-darken
 *  - secondary   — soft surface, subtle border
 *  - outline     — bg paper, hairline border, hover tint
 *  - ghost       — transparent, hover tint
 *  - destructive — red filled
 *  - destructive-outline — red border, transparent
 *  - link        — text only with underline
 *
 * All variants share consistent radii, focus rings, and transition.
 */
const buttonVariants = cva(
  cn(
    // Base
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium',
    'transition-base select-none',
    'focus-visible:outline-none',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:size-4 [&_svg]:shrink-0',
    // Active state — slight press feel
    'active:translate-y-px'
  ),
  {
    variants: {
      variant: {
        default: cn(
          'bg-primary text-primary-foreground shadow-xs',
          'hover:bg-primary/92',
          'active:bg-primary/95'
        ),
        secondary: cn(
          'bg-secondary text-secondary-foreground border border-border shadow-xs',
          'hover:bg-secondary/70 hover:border-border-strong'
        ),
        outline: cn(
          'border border-border bg-background text-foreground shadow-xs',
          'hover:bg-accent hover:border-border-strong'
        ),
        ghost: cn(
          'text-foreground',
          'hover:bg-accent'
        ),
        destructive: cn(
          'bg-destructive text-destructive-foreground shadow-xs',
          'hover:bg-destructive/92'
        ),
        'destructive-outline': cn(
          'border border-destructive/30 bg-background text-destructive shadow-xs',
          'hover:bg-destructive-soft hover:border-destructive/50'
        ),
        link: cn(
          'text-primary underline-offset-4 hover:underline px-0 py-0 h-auto'
        ),
      },
      size: {
        default: 'h-9 px-3.5',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-5 text-base',
        icon: 'h-9 w-9',
        'icon-sm': 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
