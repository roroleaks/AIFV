import { useState, useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Users,
  Search,
  Plus,
  Filter,
  AlertCircle,
  Clock,
  CheckCircle2,
  Bookmark,
  ChevronRight,
  Shield,
} from "lucide-react";
import type { PatientRecord } from "@/lib/assessment/patients";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface LeftRailProps {
  patients: PatientRecord[];
  activeCaseId?: string | undefined;
  onSelectCase?: (caseId: string) => void;
  onNewCase?: () => void;
}

type FilterTab = "today" | "active" | "flagged" | "signed" | "all";

export function LeftRail({ patients, activeCaseId, onSelectCase, onNewCase }: LeftRailProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterTab>("today");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPatients = useMemo(() => {
    let list = patients;

    // Filter logic
    if (filter === "flagged") {
      list = list.filter((p) => p.alerts > 0);
    } else if (filter === "signed") {
      list = list.filter((p) => p.completion >= 100);
    } else if (filter === "active" || filter === "today") {
      list = list.filter((p) => p.completion < 100 || p.pinned);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.fileNumber.toLowerCase().includes(q) ||
          p.causes?.some((c) => c.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [patients, filter, searchQuery]);

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-e border-border/80 bg-sidebar/50">
      {/* Worklist Header */}
      <div className="flex flex-col gap-2.5 border-b border-border/70 p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-primary" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
              {t("leftRail.dailyWorklist")}
            </h2>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-semibold">
              {filteredPatients.length}
            </Badge>
          </div>
          <Button
            size="sm"
            onClick={onNewCase ?? (() => navigate({ to: "/assessment" }))}
            className="h-7 gap-1 px-2 text-xs font-semibold shadow-xs"
          >
            <Plus className="size-3.5" />
            <span>{t("leftRail.newCase")}</span>
          </Button>
        </div>

        {/* Encrypted indicator */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-medium leading-tight">
          <Shield className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{t("topbar.encryptedBadge")}</span>
        </div>

        {/* Quick Search */}
        <div className="relative">
          <Search className="absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("leftRail.searchCases")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7.5 rounded-md bg-background/80 ps-7 text-xs"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto text-xs pb-0.5 scrollbar-none">
          {(
            [
              { id: "today", label: t("leftRail.filterActive"), icon: Clock },
              { id: "active", label: t("leftRail.filterActive"), icon: Filter },
              { id: "flagged", label: t("leftRail.filterTrigger"), icon: AlertCircle },
              { id: "signed", label: t("report.statusSigned"), icon: CheckCircle2 },
              { id: "all", label: t("leftRail.filterAll"), icon: Bookmark },
            ] as const
          ).map((tabItem) => (
            <button
              key={tabItem.id}
              onClick={() => setFilter(tabItem.id)}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors shrink-0",
                filter === tabItem.id
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <tabItem.icon className="size-3" />
              <span>{tabItem.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Patient Case Rows */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
        {filteredPatients.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground">
            <Users className="mb-2 size-8 opacity-30" />
            <p className="font-medium">{t("leftRail.emptyWorklist")}</p>
          </div>
        ) : (
          filteredPatients.map((p) => {
            const isSelected = activeCaseId === p.id || activeCaseId === p.fileNumber;
            const hasAlerts = p.alerts > 0;

            return (
              <div
                key={p.id}
                onClick={() => {
                  onSelectCase?.(p.id);
                  navigate({ to: "/case/$caseId", params: { caseId: p.id } });
                }}
                className={cn(
                  "group relative flex flex-col gap-1.5 rounded-lg border p-2.5 text-xs transition-all cursor-pointer",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30"
                    : "border-border/60 bg-card hover:border-border hover:bg-accent/40",
                )}
              >
                {/* Row Header: Name, MRN & Alert Badge (Icon + Text, Never Color Alone §2.4) */}
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {p.name}
                    </span>
                    {hasAlerts && (
                      <span
                        className="flex items-center gap-0.5 rounded px-1 py-0.2 bg-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold text-[9px] shrink-0"
                        title={`${p.alerts} clinical alerts`}
                      >
                        <AlertCircle className="size-2.5" />
                        <span>{p.alerts}</span>
                      </span>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className="h-4.5 px-1 text-[10px] font-mono text-muted-foreground shrink-0"
                  >
                    {p.fileNumber || "MRN-—"}
                  </Badge>
                </div>

                {/* Sub row: Age, Infertility Type, Cycle count */}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    {p.age} {t("leftRail.yearsOld")} · {p.infertilityType || "Primary"}
                  </span>
                  <span className="font-mono text-[10px]">Cycle #{p.cycles || 1}</span>
                </div>

                {/* Tags row: Cause & Completion */}
                <div className="flex items-center justify-between gap-1 pt-0.5">
                  <div className="flex items-center gap-1 truncate">
                    {p.causes?.[0] && (
                      <Badge
                        variant="secondary"
                        className="h-4 max-w-[150px] truncate px-1 text-[9px] font-medium"
                      >
                        {p.causes[0]}
                      </Badge>
                    )}
                  </div>
                  <ChevronRight
                    className={cn(
                      "size-3.5 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5",
                      isSelected && "text-primary",
                    )}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer info */}
      <div className="border-t border-border/70 p-2.5 text-[11px] text-muted-foreground text-center">
        <span>Ward Mode · </span>
        <Link to="/patients" className="text-primary hover:underline font-medium">
          Registry
        </Link>
      </div>
    </aside>
  );
}
