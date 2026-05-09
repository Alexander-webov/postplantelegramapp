import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  /** When true, only show the mark without the wordmark */
  markOnly?: boolean;
}

/**
 * Postplan logo. Wordmark is set in Geist semibold, italicized "п" gives it
 * subtle character. The mark is a calendar-tick — schedule + completion.
 *
 * Colors come from CSS vars so it inverts cleanly on dark themes.
 */
export function Logo({ className, markOnly = false }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)} aria-label="Постплан">
      <Mark className="h-5 w-5" />
      {!markOnly && (
        <span className="text-[17px] font-semibold tracking-tight">
          Постплан
        </span>
      )}
    </span>
  );
}

function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {/* Soft squircle background */}
      <rect
        x="1"
        y="1"
        width="22"
        height="22"
        rx="6"
        fill="hsl(var(--primary))"
      />
      {/* Inset highlight (top edge) */}
      <rect
        x="1.5"
        y="1.5"
        width="21"
        height="21"
        rx="5.5"
        stroke="hsl(0 0% 100% / 0.12)"
        strokeWidth="1"
      />
      {/* Calendar-tick: small horizontal scheduler dots + check */}
      <circle cx="7" cy="9" r="1.25" fill="hsl(var(--primary-foreground) / 0.55)" />
      <rect x="9.5" y="8" width="8" height="2" rx="1" fill="hsl(var(--primary-foreground) / 0.55)" />
      <circle cx="7" cy="13" r="1.25" fill="hsl(var(--primary-foreground) / 0.85)" />
      <path
        d="M9.5 13 L11.5 15 L17 9.5"
        stroke="hsl(var(--primary-foreground))"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
