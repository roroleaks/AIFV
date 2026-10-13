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
      <span className="grid size-9 shrink-0 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-soft">
        <Activity className="size-4.5" strokeWidth={2.4} />
      </span>
      {showWordmark && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate font-display text-sm font-extrabold tracking-tight">
            IVF Ai Calc
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            Clinical Decision Support
          </span>
        </span>
      )}
    </Link>
  );
}
