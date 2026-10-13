import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section
      className={cn(
        "animate-rise rounded-2xl border border-border/70 bg-card shadow-soft",
        className,
      )}
    >
      {(title || action) && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 px-5 py-4 sm:flex sm:justify-between">
          <div className="min-w-0">
            {title && <h2 className="truncate text-base font-semibold">{title}</h2>}
            {description && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn("p-5", contentClassName)}>{children}</div>
    </section>
  );
}

export function EmptyPlaceholder({
  label,
  hint,
  className,
}: {
  label: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid min-h-28 place-items-center rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center",
        className,
      )}
    >
      <div>
        <p className="text-sm font-medium text-foreground/80">{label}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
