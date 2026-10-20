import { Link } from "@tanstack/react-router";
import { Activity } from "lucide-react";
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
        alt="AiFV Logo"
        className="size-9 shrink-0 rounded-xl object-cover shadow-soft ring-1 ring-border/50"
      />
      {showWordmark && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate font-display text-sm font-extrabold tracking-tight">
            AiFV Precision
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            Clinical Decision Support
          </span>
        </span>
      )}
    </Link>
  );
}
