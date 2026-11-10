import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const customTwMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        "text-display-patient",
        "text-section-title",
        "text-card-title",
        "text-body",
        "text-body-emphasis",
        "text-label",
        "text-caption",
        "text-metric-value",
        "text-metric-unit",
        "text-alert-critical",
        "text-alert-context",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return customTwMerge(clsx(inputs));
}
