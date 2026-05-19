import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
}

/**
 * Kairo logo lockup. Two-line layout: mark + product name + subtitle.
 * The mark is a circuit-node — a filled emerald circle with three short
 * traces branching off, representing the leash between agent and wallet.
 */
export function Logo({ className, showWordmark = true }: LogoProps) {
  return (
    <div className={cn("group flex items-center gap-2.5", className)}>
      <LogoMark className="h-9 w-9" />
      {showWordmark && (
        <div className="flex flex-col">
          <span className="text-base font-bold leading-none tracking-tight text-foreground">
            Kairo
          </span>
          <span className="mt-0.5 text-[10px] font-medium leading-none text-muted-foreground">
            Aerodrome LP Agent
          </span>
        </div>
      )}
    </div>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-xl bg-gradient-card",
        className,
      )}
    >
      <svg
        viewBox="0 0 32 32"
        className="h-full w-full text-primary"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        {/* outer faint orbit */}
        <circle
          cx="16"
          cy="16"
          r="11"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.25"
          fill="none"
        />
        {/* circuit traces */}
        <path
          d="M16 5 L16 11"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.6"
        />
        <path
          d="M7 23 L12 20"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.6"
        />
        <path
          d="M25 23 L20 20"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.6"
        />
        {/* core node */}
        <circle cx="16" cy="16" r="5.5" fill="currentColor" />
      </svg>
    </div>
  );
}
