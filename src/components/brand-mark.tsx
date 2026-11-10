import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <Link to="/" className={cn("flex min-w-0 items-center gap-2", className)}>
      <img
        src="/icon-192.png"
        alt="AIVF Logo"
        className="h-5 w-5 shrink-0 rounded-md object-cover shadow-xs ring-1 ring-border/50"
      />
      {showWordmark && (
        <span className="min-w-0 leading-tight">
          <span className="flex items-center gap-2 whitespace-nowrap text-lg sm:text-display-patient font-semibold tracking-tight text-foreground">
            <span>AIVF</span>
            <span className="shrink-0 text-label font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
              v3.1
            </span>
          </span>
          <span className="hidden sm:block truncate text-caption text-muted-foreground font-medium">
            Clinical Decision Support
          </span>
        </span>
      )}
    </Link>
  );
}
