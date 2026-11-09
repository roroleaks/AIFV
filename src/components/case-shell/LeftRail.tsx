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
  Printer,
  Flag,
  Archive,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { usePatients, type PatientRecord } from "@/lib/assessment/patients";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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
  const { togglePin, remove } = usePatients();
  const [filter, setFilter] = useState<FilterTab>("today");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Filter counts
  const counts = useMemo(() => {
    return {
      today: patients.filter((p) => p.completion < 100 || p.pinned).length,
      active: patients.filter((p) => p.completion < 100).length,
      flagged: patients.filter((p) => p.alerts > 0).length,
      signed: patients.filter((p) => p.completion >= 100).length,
      all: patients.length,
    };
  }, [patients]);

  const filteredPatients = useMemo(() => {
    let list = patients;

    // Filter logic
    if (filter === "flagged") {
      list = list.filter((p) => p.alerts > 0);
    } else if (filter === "signed") {
      list = list.filter((p) => p.completion >= 100);
    } else if (filter === "active") {
      list = list.filter((p) => p.completion < 100);
    } else if (filter === "today") {
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

  const handleSelectPatient = (patientId: string) => {
    onSelectCase?.(patientId);
    navigate({ to: "/case/$caseId", params: { caseId: patientId } });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && filteredPatients.length > 0) {
      e.preventDefault();
      const topPatient = filteredPatients[0];
      if (topPatient) {
        handleSelectPatient(topPatient.id);
      }
    }
  };

  const handlePrintSummary = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    window.print();
  };

  const handleToggleFlag = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    togglePin(id);
  };

  const handleArchive = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    remove(id);
  };

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-e border-border-subtle bg-bg-surface transition-all duration-200",
        isCollapsed ? "w-16" : "w-72 lg:w-80",
      )}
    >
      {/* Worklist Header */}
      <div className="flex flex-col gap-2.5 border-b border-border-subtle p-3">
        <div className="flex items-center justify-between">
          {!isCollapsed ? (
            <div className="flex items-center gap-2 truncate">
              <Users className="size-4 text-accent-primary shrink-0" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-text-primary truncate">
                {t("leftRail.dailyWorklist")}
              </h2>
              <Badge
                variant="secondary"
                className="h-5 px-1.5 text-[10px] font-semibold bg-bg-surface-muted text-text-secondary"
              >
                {filteredPatients.length}
              </Badge>
            </div>
          ) : (
            <div className="flex w-full justify-center">
              <Users className="size-4 text-accent-primary" />
            </div>
          )}

          <div className="flex items-center gap-1">
            {!isCollapsed && (
              <Button
                size="sm"
                onClick={onNewCase ?? (() => navigate({ to: "/assessment" }))}
                className="h-7 gap-1 px-2 text-xs font-semibold bg-accent-primary text-text-on-accent hover:bg-accent-primary-hover shadow-xs"
                title="Create New Clinical Case (+ New Case)"
              >
                <Plus className="size-3.5" />
                <span className="hidden sm:inline">{t("leftRail.newCase")}</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="size-7 text-text-muted hover:text-text-primary hover:bg-bg-surface-muted"
              title={isCollapsed ? "Expand Worklist" : "Collapse to icon rail"}
              aria-label={isCollapsed ? "Expand Worklist" : "Collapse to icon rail"}
            >
              {isCollapsed ? (
                <PanelLeftOpen className="size-3.5 rtl:rotate-180" />
              ) : (
                <PanelLeftClose className="size-3.5 rtl:rotate-180" />
              )}
            </Button>
          </div>
        </div>

        {!isCollapsed && (
          <>
            {/* Encrypted Session indicator */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-safety-success-bg border border-safety-success/20 text-safety-success text-[10px] font-medium leading-tight">
              <Shield className="size-3 shrink-0" />
              <span>{t("topbar.encryptedBadge")}</span>
            </div>

            {/* Quick Search */}
            <div className="relative">
              <Search className="absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" />
              <Input
                type="search"
                placeholder={t("leftRail.searchCases")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="h-8 rounded-md bg-bg-surface-muted/60 ps-8 text-xs border-border-subtle focus-visible:bg-bg-surface focus-visible:border-accent-primary"
              />
            </div>

            {/* Filter Tabs with Navy Active State & Count Badges */}
            <div className="flex items-center gap-1 overflow-x-auto text-xs pb-0.5 scrollbar-none">
              {(
                [
                  {
                    id: "today",
                    label: t("leftRail.filterActive"),
                    icon: Clock,
                    count: counts.today,
                  },
                  {
                    id: "active",
                    label: t("leftRail.filterActive"),
                    icon: Filter,
                    count: counts.active,
                  },
                  {
                    id: "flagged",
                    label: t("leftRail.filterTrigger"),
                    icon: AlertCircle,
                    count: counts.flagged,
                  },
                  {
                    id: "signed",
                    label: t("report.statusSigned"),
                    icon: CheckCircle2,
                    count: counts.signed,
                  },
                  { id: "all", label: t("leftRail.filterAll"), icon: Bookmark, count: counts.all },
                ] as const
              ).map((tabItem) => (
                <button
                  key={tabItem.id}
                  onClick={() => setFilter(tabItem.id)}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors shrink-0",
                    filter === tabItem.id
                      ? "bg-accent-primary text-text-on-accent font-semibold shadow-xs"
                      : "text-text-muted hover:bg-bg-surface-muted hover:text-text-primary",
                  )}
                  title={`${tabItem.label} (${tabItem.count})`}
                >
                  <tabItem.icon className="size-3 shrink-0" />
                  <span>{tabItem.label}</span>
                  <span
                    className={cn(
                      "rounded-full px-1 text-[9px] font-mono",
                      filter === tabItem.id
                        ? "bg-accent-primary-hover text-text-on-accent"
                        : "bg-bg-surface-muted text-text-muted",
                    )}
                  >
                    {tabItem.count}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Patient Case Rows */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
        {filteredPatients.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-text-muted">
            <Users className="mb-2 size-8 opacity-30" />
            <p className="font-medium">{t("leftRail.emptyWorklist")}</p>
          </div>
        ) : (
          filteredPatients.map((p) => {
            const isSelected = activeCaseId === p.id || activeCaseId === p.fileNumber;
            const hasAlerts = p.alerts > 0;
            const initials =
              p.name
                .split(" ")
                .map((n) => n[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase() || "PT";

            if (isCollapsed) {
              return (
                <button
                  key={p.id}
                  onClick={() => handleSelectPatient(p.id)}
                  title={`${p.name} (${p.fileNumber})${hasAlerts ? ` — ${p.alerts} alerts` : ""}`}
                  className={cn(
                    "relative flex size-12 w-full items-center justify-center rounded-lg border text-xs font-semibold transition-all",
                    isSelected
                      ? "border-accent-primary bg-accent-primary/10 text-accent-primary ring-1 ring-accent-primary/30"
                      : "border-border-subtle bg-bg-surface text-text-secondary hover:border-border-default hover:bg-bg-surface-muted",
                  )}
                >
                  <span>{initials}</span>
                  {hasAlerts && (
                    <span className="absolute top-1 end-1 size-2 rounded-full bg-safety-warning" />
                  )}
                </button>
              );
            }

            return (
              <ContextMenu key={p.id}>
                <ContextMenuTrigger asChild>
                  <div
                    onClick={() => handleSelectPatient(p.id)}
                    className={cn(
                      "group relative flex flex-col gap-1.5 rounded-lg border p-2.5 text-xs transition-all cursor-pointer",
                      isSelected
                        ? "border-accent-primary bg-accent-primary/5 shadow-xs ring-1 ring-accent-primary/20"
                        : "border-border-subtle bg-bg-surface hover:border-border-default hover:bg-bg-surface-muted/40",
                    )}
                  >
                    {/* Primary Row: Name + MRN Monospace Badge */}
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-semibold text-text-primary group-hover:text-accent-primary transition-colors truncate">
                          {p.name}
                        </span>
                        {p.pinned && (
                          <Flag className="size-3 text-accent-primary fill-accent-primary shrink-0" />
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className="h-4.5 px-1 font-mono text-[10px] text-text-muted border-border-default shrink-0"
                      >
                        {p.fileNumber || "MRN-—"}
                      </Badge>
                    </div>

                    {/* Secondary Row: Cycle # · Day · Cause/Type */}
                    <div className="flex items-center justify-between text-[11px] text-text-secondary">
                      <span className="truncate">
                        Cycle #{p.cycles || 1} · {p.causes?.[0] || p.infertilityType || "Primary"}
                      </span>
                      <span className="font-mono text-[10px] text-text-muted shrink-0">
                        {p.age}y
                      </span>
                    </div>

                    {/* Tertiary Row: Alert Indicator (Only When Flagged) & Directional Navigation */}
                    <div className="flex items-center justify-between gap-1 pt-0.5">
                      <div className="flex items-center gap-1.5 truncate">
                        {hasAlerts ? (
                          <span
                            className="flex items-center gap-1 rounded px-1.5 py-0.5 bg-safety-warning-bg text-safety-warning font-semibold text-[10px] shrink-0"
                            title={`${p.alerts} clinical alerts`}
                          >
                            <AlertCircle className="size-2.5" />
                            <span>
                              {p.alerts} alert{p.alerts > 1 ? "s" : ""}
                            </span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-text-muted">
                            {p.completion >= 100 ? "Ready for sign-off" : "Active stimulation"}
                          </span>
                        )}
                      </div>
                      <ChevronRight
                        className={cn(
                          "size-3.5 text-text-muted/60 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5",
                          isSelected && "text-accent-primary",
                        )}
                      />
                    </div>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-48 bg-bg-surface border-border-subtle shadow-md">
                  <ContextMenuItem
                    onClick={(e) => handlePrintSummary(e)}
                    className="gap-2 text-xs text-text-primary cursor-pointer hover:bg-bg-surface-muted"
                  >
                    <Printer className="size-3.5" />
                    <span>Print Summary</span>
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={(e) => handleToggleFlag(e, p.id)}
                    className="gap-2 text-xs text-text-primary cursor-pointer hover:bg-bg-surface-muted"
                  >
                    <Flag className="size-3.5 text-accent-primary" />
                    <span>{p.pinned ? "Unflag Case" : "Flag Case"}</span>
                  </ContextMenuItem>
                  <ContextMenuSeparator className="bg-border-subtle" />
                  <ContextMenuItem
                    onClick={(e) => handleArchive(e, p.id)}
                    className="gap-2 text-xs text-safety-danger cursor-pointer hover:bg-safety-danger-bg"
                  >
                    <Archive className="size-3.5" />
                    <span>Archive Case</span>
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })
        )}
      </div>

      {/* Footer info */}
      <div className="border-t border-border-subtle p-2.5 text-[11px] text-text-muted text-center">
        {!isCollapsed ? (
          <>
            <span>Ward Mode · </span>
            <Link to="/patients" className="text-accent-primary hover:underline font-medium">
              Registry
            </Link>
          </>
        ) : (
          <Users className="mx-auto size-3.5 text-text-muted" />
        )}
      </div>
    </aside>
  );
}
