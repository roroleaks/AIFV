import type { ComponentType, SVGProps } from "react";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ClinicalIconSize = "inline" | "feature" | "alert" | "decorative";
export type ClinicalIconTone =
  "inherit" | "critical" | "warning" | "info" | "success" | "decorative";

export interface ClinicalIconProps extends Omit<SVGProps<SVGSVGElement>, "name" | "size"> {
  name: string | LucideIcon | ComponentType<SVGProps<SVGSVGElement>>;
  size?: ClinicalIconSize;
  tone?: ClinicalIconTone;
  className?: string;
}

const SIZE_MAP: Record<ClinicalIconSize, string> = {
  inline: "h-4 w-4 shrink-0",
  feature: "h-5 w-5 shrink-0",
  alert: "h-5 w-5 shrink-0",
  decorative: "h-8 w-8 shrink-0",
};

const TONE_MAP: Record<ClinicalIconTone, string> = {
  inherit: "",
  critical: "text-red-600",
  warning: "text-amber-600",
  info: "text-blue-600",
  success: "text-green-600",
  decorative: "text-slate-300",
};

export function ClinicalIcon({
  name,
  size = "inline",
  tone = "inherit",
  className,
  ...props
}: ClinicalIconProps) {
  let IconComponent: ComponentType<SVGProps<SVGSVGElement>> | undefined;

  if (typeof name === "function" || (typeof name === "object" && name !== null)) {
    IconComponent = name as ComponentType<SVGProps<SVGSVGElement>>;
  } else if (typeof name === "string") {
    const direct = (LucideIcons as Record<string, unknown>)[name];
    if (typeof direct === "function" || (typeof direct === "object" && direct !== null)) {
      IconComponent = direct as ComponentType<SVGProps<SVGSVGElement>>;
    } else {
      const normalized = name.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
      const pascal = normalized.charAt(0).toUpperCase() + normalized.slice(1);
      const found = (LucideIcons as Record<string, unknown>)[pascal];
      if (typeof found === "function" || (typeof found === "object" && found !== null)) {
        IconComponent = found as ComponentType<SVGProps<SVGSVGElement>>;
      }
    }
  }

  if (!IconComponent) {
    IconComponent = LucideIcons.HelpCircle;
  }

  const sizeClass = SIZE_MAP[size] || SIZE_MAP.inline;
  const toneClass = TONE_MAP[tone] || TONE_MAP.inherit;

  return (
    <IconComponent className={cn(sizeClass, toneClass, className)} aria-hidden="true" {...props} />
  );
}
