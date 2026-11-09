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
    <Link to="/" className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <img
        src="/icon-192.png"
        alt="AIVF Logo"
        className="size-9 shrink-0 rounded-xl object-cover shadow-soft ring-1 ring-border/50"
      />
      {showWordmark && (
        <span className="min-w-0 leading-tight">
          <span className="flex items-center gap-1.5 font-display text-sm font-extrabold tracking-tight">
            <span>AIVF</span>
            <span className="text-[10px] font-bold px-1 py-0.2 rounded bg-primary/10 text-primary border border-primary/20">
              v3.1
            </span>
          </span>
          <span className="block truncate text-[11px] text-muted-foreground font-medium">
            Clinical Decision Support
          </span>
        </span>
      )}
    </Link>
  );
}
