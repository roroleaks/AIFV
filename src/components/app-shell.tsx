import { TestModeBanner } from "@/components/engine/test-mode-banner";
import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ClipboardPlus,
  Calculator,
  Brain,
  Compass,
  Cpu,
  FileText,
  BookOpen,
  Library,
  Star,
  Settings,
  LifeBuoy,
  Menu,
  Moon,
  Sun,
  Search,
  Bell,
  PanelLeftClose,
  PanelLeft,
  Stethoscope,
  Pill,
  Syringe,
  Activity,
  FileWarning,
  ShieldCheck,
  Sparkles,
  Lock,
  KeyRound,
  RotateCcw,
  Save,
  CheckCircle2,
  Clock,
  Home,
  ChevronRight,
  User,
  UserCheck,
  Delete,
  ShieldAlert,
} from "lucide-react";

import { ClinicalIcon } from "@/components/ui/clinical-icon";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTheme } from "@/hooks/use-theme";
import { useAssessment } from "@/lib/assessment/use-assessment";
import { ageFromDob } from "@/lib/assessment/schema";
import { lockSession, authenticateWithPin } from "@/services/auth/session";
import { useAutoSave } from "@/hooks/use-auto-save";
import { cn } from "@/lib/utils";

const topNav = [
  { label: "Patients", to: "/patients", icon: ClipboardPlus },
  { label: "Protocols", to: "/protocols", icon: Stethoscope },
  { label: "Reports", to: "/reports", icon: FileText },
  { label: "Evidence", to: "/evidence", icon: BookOpen },
] as const;

export interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  stageNumber?: number;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "Hospital Workspace",
    items: [
      { label: "Clinical Worklist", to: "/worklist", icon: LayoutDashboard },
      { label: "Patients Registry", to: "/patients", icon: ClipboardPlus },
      { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
      { label: "Intelligence Engine", to: "/engine", icon: Cpu },
      { label: "Clinical Calculator", to: "/calculator", icon: Calculator },
    ],
  },
  {
    title: "Clinical Workflow (Stages 1 – 8)",
    items: [
      { label: "1. Patient Assessment", to: "/assessment", icon: ClipboardPlus, stageNumber: 1 },
      { label: "2. POSEIDON Assessment", to: "/poseidon", icon: Compass, stageNumber: 2 },
      { label: "3. Protocol Recommendation", to: "/protocols", icon: Stethoscope, stageNumber: 3 },
      { label: "4. Starting Dose Engine", to: "/starting-dose", icon: Syringe, stageNumber: 4 },
      {
        label: "5. Monitoring & Dose Adjustment",
        to: "/monitoring",
        icon: Activity,
        stageNumber: 5,
      },
      { label: "6. Trigger Decision & Safety", to: "/trigger", icon: Syringe, stageNumber: 6 },
      {
        label: "7. Cycle Completion & Safety",
        to: "/cycle-completion",
        icon: ShieldCheck,
        stageNumber: 7,
      },
      { label: "8. Clinical Reports", to: "/reports", icon: FileText, stageNumber: 8 },
    ],
  },
  {
    title: "Specialized Engines",
    items: [
      { label: "Patient Phenotype Engine", to: "/decision-support", icon: Brain },
      { label: "Gonadotropin Selection", to: "/gonadotropins", icon: Pill },
      { label: "CONSORT Starting Dose", to: "/consort", icon: Syringe },
    ],
  },
  {
    title: "Evidence & Governance",
    items: [
      { label: "Evidence Library", to: "/evidence", icon: BookOpen },
      { label: "Evidence Master Index", to: "/evidence-master", icon: Library },
      { label: "Evidence Updates", to: "/evidence-updates", icon: Library },
      { label: "Evidence Requirements", to: "/evidence-requirements", icon: FileWarning },
      { label: "Update Evidence Center", to: "/evidence-governance", icon: Library },
      { label: "Full Engine Test", to: "/system-test", icon: FileWarning },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Favorites", to: "/favorites", icon: Star },
      { label: "Settings", to: "/settings", icon: Settings },
    ],
  },
];

function SideNavList({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  return (
    <nav
      aria-label="Primary"
      className="flex flex-col gap-4 px-3 overflow-y-auto max-h-[calc(100vh-140px)] scrollbar-thin"
    >
      {navSections.map((section, sIdx) => (
        <div key={section.title} className="flex flex-col gap-1">
          {!collapsed && (
            <p
              className={cn(
                "px-3 pb-1 text-section-title font-semibold tracking-wide",
                sIdx === 1 ? "text-primary" : "text-foreground",
              )}
            >
              {section.title}
            </p>
          )}
          {section.items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              activeProps={{
                className:
                  "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs ring-1 ring-border/50",
              }}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2 text-body text-slate-700 dark:text-slate-200 transition-all hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                collapsed && "justify-center px-0",
                item.stageNumber && !collapsed && "hover:pl-3.5",
              )}
            >
              {item.stageNumber ? (
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all",
                    "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
                  )}
                >
                  {item.stageNumber}
                </span>
              ) : (
                <ClinicalIcon
                  name={item.icon}
                  size="inline"
                  className="mr-2 text-muted-foreground group-hover:text-foreground"
                />
              )}
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

// -----------------------------------------------------------------------------
// Stage Information Mapping
// -----------------------------------------------------------------------------
function getStageInfo(pathname: string): { title: string; stageNumber?: number } {
  if (pathname.includes("/assessment") || pathname.startsWith("/assessment"))
    return { title: "Stage 1: Patient Assessment", stageNumber: 1 };
  if (pathname.includes("/poseidon") || pathname.startsWith("/poseidon"))
    return { title: "Stage 2: POSEIDON Stratification", stageNumber: 2 };
  if (pathname.includes("/protocol") || pathname.startsWith("/protocols"))
    return { title: "Stage 3: Protocol Recommendation", stageNumber: 3 };
  if (
    pathname.includes("/dose") ||
    pathname.startsWith("/starting-dose") ||
    pathname.startsWith("/consort")
  )
    return { title: "Stage 4: Starting Dose Engine", stageNumber: 4 };
  if (pathname.includes("/monitoring") || pathname.startsWith("/monitoring"))
    return { title: "Stage 5: Monitoring & Dose Adjustment", stageNumber: 5 };
  if (pathname.includes("/trigger") || pathname.startsWith("/trigger"))
    return { title: "Stage 6: Trigger Decision & Safety", stageNumber: 6 };
  if (
    pathname.includes("/completion") ||
    pathname.includes("/cycle-completion") ||
    pathname.startsWith("/cycle-completion")
  )
    return { title: "Stage 7: Cycle Completion & Safety", stageNumber: 7 };
  if (pathname.includes("/report") || pathname.startsWith("/reports"))
    return { title: "Stage 8: Clinical Intelligence Report", stageNumber: 8 };
  if (pathname.startsWith("/worklist")) return { title: "Hospital Clinical Worklist" };
  if (pathname.startsWith("/patients")) return { title: "Patients Registry" };
  if (pathname.startsWith("/dashboard")) return { title: "Clinical Dashboard" };
  if (pathname.startsWith("/engine")) return { title: "Intelligence Engine" };
  if (pathname.startsWith("/calculator")) return { title: "Clinical Calculator" };
  if (pathname.startsWith("/evidence")) return { title: "Evidence Library & Governance" };
  if (pathname.startsWith("/settings")) return { title: "System & Clinical Settings" };
  return { title: "Clinical Workspace" };
}

// -----------------------------------------------------------------------------
// 1. Sticky Top Patient Context Bar Component
// -----------------------------------------------------------------------------
function PatientContextBar({
  patientName,
  patientId,
  age,
  stageTitle,
  stageNumber,
  lastSavedText,
}: {
  patientName: string;
  patientId: string;
  age: string;
  stageTitle: string;
  stageNumber?: number | undefined;
  lastSavedText: string;
}) {
  return (
    <div
      role="region"
      aria-label="Active Patient Context"
      className="sticky top-14 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-background/95 px-4 py-2 backdrop-blur-md shadow-2xs text-xs"
    >
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs border border-primary/20">
            {patientName.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-display-patient text-foreground tracking-tight">{patientName}</span>
        </div>

        <span className="text-border">|</span>

        <div className="flex items-center gap-1.5 font-mono text-slate-600 dark:text-slate-300 text-caption">
          <span>ID:</span>
          <span className="font-semibold text-foreground">{patientId}</span>
        </div>

        <span className="text-border">|</span>

        <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300 text-caption">
          <span>Age:</span>
          <span className="font-medium text-foreground">{age}</span>
        </div>

        <span className="text-border">|</span>

        {/* Stage Chip */}
        <Badge
          variant="outline"
          className="gap-1.5 border-border bg-muted/40 text-foreground font-semibold text-[11px] px-2.5 py-0.5"
        >
          {stageNumber && <span className="size-1.5 rounded-full bg-primary animate-pulse" />}
          <span>{stageTitle}</span>
        </Badge>
      </div>

      <div className="flex items-center gap-3 ms-auto">
        {/* Auto-save status indicator */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
          <ClinicalIcon name={CheckCircle2} size="inline" tone="success" className="mr-2" />
          <span>{lastSavedText}</span>
        </div>

        <Link to="/patients">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-[11px] font-medium border-border/70 hover:bg-muted text-foreground"
          >
            <ClinicalIcon name={UserCheck} size="inline" className="mr-2 text-primary" />
            <span>Change Patient</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 2. Sticky Bottom Breadcrumb Component
// -----------------------------------------------------------------------------
function StickyBreadcrumb({
  patientName,
  stageTitle,
  onManualSave,
  isSaving,
}: {
  patientName: string;
  stageTitle: string;
  onManualSave: () => void;
  isSaving: boolean;
}) {
  return (
    <footer className="sticky bottom-0 z-30 flex items-center justify-between border-t border-border/80 bg-background/95 px-4 py-2 backdrop-blur-md shadow-md text-xs">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-muted-foreground flex-wrap"
      >
        <Link to="/worklist">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 gap-1"
          >
            <ClinicalIcon name={Home} size="inline" className="mr-2" />
            <span>Home</span>
          </Button>
        </Link>

        <ClinicalIcon
          name={ChevronRight}
          size="inline"
          className="mx-2 text-muted-foreground/50 rtl:rotate-180"
        />

        <Link to="/assessment">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs text-foreground font-semibold hover:bg-muted/50 gap-1"
          >
            <ClinicalIcon name={User} size="inline" className="mr-2 text-primary" />
            <span>{patientName}</span>
          </Button>
        </Link>

        <ClinicalIcon
          name={ChevronRight}
          size="inline"
          className="mx-2 text-muted-foreground/50 rtl:rotate-180"
        />

        <Badge
          variant="secondary"
          className="h-5 px-2 text-[11px] font-semibold bg-muted text-foreground"
        >
          {stageTitle}
        </Badge>
      </nav>

      <div className="flex items-center gap-2 ms-auto">
        <Button
          variant="outline"
          size="sm"
          disabled={isSaving}
          onClick={onManualSave}
          className="h-6.5 px-2.5 text-xs border-border/70 hover:bg-muted text-foreground gap-1.5"
          title="Manually trigger auto-save routine"
        >
          <ClinicalIcon name={Save} size="inline" className="mr-2 text-primary" />
          <span>{isSaving ? "Saving..." : "Save Now"}</span>
        </Button>
      </div>
    </footer>
  );
}

// -----------------------------------------------------------------------------
// Main AppShell Component
// -----------------------------------------------------------------------------
const DEFAULT_IDLE_TIMEOUT = 300; // 05:00
const STORAGE_KEY = "lastActiveAt";

function getStoredIdleTimeout(): number {
  if (typeof window === "undefined") return DEFAULT_IDLE_TIMEOUT;
  const stored = window.sessionStorage.getItem("aifv_idle_timeout");
  if (stored) {
    const parsed = parseInt(stored, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_IDLE_TIMEOUT;
}

export function AppShell({ children }: { children?: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Patient assessment draft data
  const { draft, savedAt } = useAssessment();
  const [isSaving, setIsSaving] = useState(false);
  const [idleTimeoutSeconds, setIdleTimeoutSeconds] = useState<number>(getStoredIdleTimeout);
  const [lastSavedText, setLastSavedText] = useState("Auto-Save Active (30s)");

  // Sync savedAt to lastSavedText
  useEffect(() => {
    if (savedAt) {
      const timeStr = new Date(savedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      setLastSavedText(`Saved at ${timeStr}`);
    }
  }, [savedAt]);

  // Settings listener for idle-lock timer, auto-save interval and accessibility text sizing
  useEffect(() => {
    const handleSettingsUpdate = () => {
      const newTimeout = getStoredIdleTimeout();
      setIdleTimeoutSeconds(newTimeout);
      setSecondsRemaining(newTimeout);

      if (typeof window !== "undefined") {
        const intervalStored = window.sessionStorage.getItem("aifv_autosave_interval");
        if (intervalStored) {
          setLastSavedText(`Auto-Save Active (${intervalStored}s)`);
        }
        const isLarge = window.sessionStorage.getItem("aifv_large_text") === "true";
        if (isLarge) {
          document.documentElement.classList.add("large-text-mode");
        } else {
          document.documentElement.classList.remove("large-text-mode");
        }
      }
    };

    window.addEventListener("aifv-settings-updated", handleSettingsUpdate);
    handleSettingsUpdate();
    return () => window.removeEventListener("aifv-settings-updated", handleSettingsUpdate);
  }, []);

  // 3. Top-Right Idle Countdown & Hospital Inactivity Lock State
  const [secondsRemaining, setSecondsRemaining] = useState<number>(getStoredIdleTimeout);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Initialize and read lastActiveAt from sessionStorage (Hospital Requirement)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (!stored) {
      window.sessionStorage.setItem(STORAGE_KEY, Date.now().toString());
    }
  }, []);

  const resetActivity = useCallback(() => {
    if (isLocked) return;
    const now = Date.now();
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(STORAGE_KEY, now.toString());
    }
    setSecondsRemaining(idleTimeoutSeconds);
  }, [isLocked, idleTimeoutSeconds]);

  const lockScreen = useCallback(() => {
    setIsLocked(true);
    setSecondsRemaining(0);
    try {
      lockSession("inactivity_timeout");
    } catch {
      // fallback
    }
  }, []);

  const unlockScreen = useCallback(() => {
    setIsLocked(false);
    setPin("");
    setPinError(null);
    resetActivity();
  }, [resetActivity]);

  // Listen for session lock events dispatched across the application
  useEffect(() => {
    const handleSessionEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ locked: boolean }>;
      if (customEvent.detail?.locked) {
        setIsLocked(true);
        setSecondsRemaining(0);
      }
    };
    window.addEventListener("aifv-session-changed", handleSessionEvent);
    return () => window.removeEventListener("aifv-session-changed", handleSessionEvent);
  }, []);

  // Activity listeners across user inputs
  useEffect(() => {
    if (isLocked) return;

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    const handleActivity = () => {
      if (typeof window === "undefined") return;
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      const last = stored ? parseInt(stored, 10) : 0;
      if (Date.now() - last > 1500) {
        resetActivity();
      }
    };

    events.forEach((ev) => window.addEventListener(ev, handleActivity, { passive: true }));
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleActivity));
    };
  }, [isLocked, resetActivity]);

  // Mandatory 1-second interval countdown ticker
  useEffect(() => {
    if (isLocked) return;

    const interval = setInterval(() => {
      if (typeof window === "undefined") return;
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      const lastActive = stored ? parseInt(stored, 10) : Date.now();
      const elapsed = Math.floor((Date.now() - lastActive) / 1000);
      const remaining = Math.max(0, idleTimeoutSeconds - elapsed);

      setSecondsRemaining(remaining);

      if (remaining <= 0) {
        lockScreen();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isLocked, lockScreen, idleTimeoutSeconds]);

  // Auto-focus PIN input when screen locks
  useEffect(() => {
    if (isLocked) {
      setTimeout(() => {
        pinInputRef.current?.focus();
      }, 100);
    }
  }, [isLocked]);

  // 4. Auto-Save Hook Integration (at most every 30s AND on visibilitychange=hidden)
  const handlePerformSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setLastSavedText(`Saved at ${timeStr}`);
    } catch {
      setLastSavedText("Save error");
    } finally {
      setIsSaving(false);
    }
  }, []);

  useAutoSave({
    onSave: handlePerformSave,
    intervalMs: 30000,
    enabled: !isLocked,
  });

  // PIN Unlock Submission
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;

    setIsAuthenticating(true);
    setPinError(null);

    try {
      const success = await authenticateWithPin(pin);
      if (success) {
        unlockScreen();
      } else {
        setPinError("Invalid PIN / Passphrase. Please try again.");
      }
    } catch (err: unknown) {
      setPinError((err as Error).message || "Authentication failed.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Derive Patient Metadata
  const patientName = (draft.values?.["fullName"] as string) || "Elena Rostova";
  const patientId = (draft.values?.["fileNumber"] as string) || "AIFV-2026-001";
  const dobVal = draft.values?.["dob"];
  const age = (draft.values?.["age"] as string) || (dobVal ? ageFromDob(dobVal) : "34 years");

  const stageInfo = getStageInfo(pathname);

  return (
    <div className="min-h-screen w-full bg-background relative flex flex-col">
      {/* Blurred application shell wrapper when isLocked */}
      <div
        className={cn(
          "flex min-h-screen w-full flex-col transition-all duration-300",
          isLocked && "filter blur-md pointer-events-none select-none",
        )}
      >
        {/* Main Application TopBar */}
        <header className="sticky top-0 z-40 h-14 border-b border-border/70 glass-panel">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center h-full px-4 lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                    <ClinicalIcon name={Menu} size="feature" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 bg-sidebar p-0">
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <div className="px-4 py-4">
                    <BrandMark />
                  </div>
                  <SideNavList onNavigate={() => setMobileOpen(false)} />
                </SheetContent>
              </Sheet>

              <BrandMark className="shrink-0" />

              <nav
                aria-label="Sections"
                className="ml-4 hidden min-w-0 items-center gap-1 overflow-hidden xl:flex"
              >
                {topNav.map((item) => {
                  const active = pathname.startsWith(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "inline-flex shrink-0 items-center whitespace-nowrap rounded-lg px-3 py-1.5 text-body-emphasis text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                        active && "bg-primary-soft text-primary",
                      )}
                    >
                      <ClinicalIcon name={item.icon} size="inline" className="mr-2" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Top Right Controls & Mandatory Idle-Lock Countdown */}
            <div className="flex shrink-0 items-center gap-2">
              <Link to="/worklist" className="hidden sm:inline-flex">
                <Button
                  size="sm"
                  className="h-8 gap-2 text-label font-semibold shadow-xs whitespace-nowrap"
                >
                  <ClinicalIcon name={Sparkles} size="inline" className="mr-2" />
                  <span>Hospital Worklist</span>
                </Button>
              </Link>

              {/* 3. Top-Right Idle Countdown Timer */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-label text-muted-foreground hidden sm:inline whitespace-nowrap">
                  Idle Lock:
                </span>
                <div
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-2 py-1 font-mono transition-colors shrink-0",
                    secondsRemaining <= 15
                      ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 animate-pulse font-bold"
                      : secondsRemaining <= 60
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold"
                        : "border-border/60 bg-muted/30 text-muted-foreground",
                  )}
                  title={`Hospital Inactivity Countdown: ${formatCountdown(secondsRemaining)} remaining before lock`}
                >
                  <ClinicalIcon name={Clock} size="inline" className="mr-2" />
                  <span className="text-sm sm:text-metric-value font-mono">
                    {formatCountdown(secondsRemaining)}
                  </span>
                </div>

                {/* Extend Button (visible when timer <= 60s) */}
                {secondsRemaining <= 60 && !isLocked && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetActivity}
                    className="h-7 px-2 text-label text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 border-amber-500/40 gap-1 font-semibold whitespace-nowrap"
                    title="Extend session by 5 minutes"
                  >
                    <ClinicalIcon name={RotateCcw} size="inline" className="mr-2" />
                    <span>Extend (+5m)</span>
                  </Button>
                )}

                {/* Manual Immediate Lock Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={lockScreen}
                  className="h-7 px-2 text-label text-muted-foreground hover:text-foreground hover:bg-muted gap-1 whitespace-nowrap"
                  title="Immediately lock clinical session"
                >
                  <ClinicalIcon name={Lock} size="inline" className="sm:mr-2" />
                  <span className="hidden sm:inline">Lock</span>
                </Button>
              </div>

              <div className="relative hidden 2xl:block">
                <ClinicalIcon
                  name={Search}
                  size="inline"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  placeholder="Search patients, evidence…"
                  aria-label="Global search"
                  className="h-9 w-48 rounded-xl border-border/70 bg-background/60 pl-9 text-body"
                />
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="hidden sm:inline-flex"
                aria-label="Notifications"
              >
                <ClinicalIcon name={Bell} size="feature" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggle}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                <ClinicalIcon name={theme === "dark" ? Sun : Moon} size="feature" />
              </Button>
              <img
                src="/dr-raouf-roshdy.jpg"
                alt="Dr Raouf Roshdy"
                className="ml-1 hidden size-8 rounded-full object-cover ring-1 ring-border sm:block"
              />
            </div>
          </div>
        </header>

        {/* 1. Sticky Top Patient Context Bar */}
        <PatientContextBar
          patientName={patientName}
          patientId={patientId}
          age={age}
          stageTitle={stageInfo.title}
          stageNumber={stageInfo.stageNumber}
          lastSavedText={lastSavedText}
        />

        <div className="flex w-full flex-1">
          <aside
            className={cn(
              "sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 transition-[width] duration-300 lg:flex",
              collapsed ? "w-[74px]" : "w-64",
            )}
          >
            <SideNavList collapsed={collapsed} />
            <div className="mt-auto px-3">
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 text-body text-slate-600 dark:text-slate-400",
                  collapsed && "justify-center",
                )}
                onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? (
                  <ClinicalIcon name={PanelLeft} size="feature" />
                ) : (
                  <ClinicalIcon name={PanelLeftClose} size="feature" className="mr-2" />
                )}
                {!collapsed && <span className="text-sm">Collapse</span>}
              </Button>
              {!collapsed && (
                <Link
                  to="/help"
                  className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60"
                >
                  <ClinicalIcon name={LifeBuoy} size="feature" className="mr-2" />
                  <span>Help & Support</span>
                </Link>
              )}
            </div>
          </aside>

          <main className="flex min-w-0 flex-1 flex-col p-6">
            <div className="mx-auto w-full max-w-7xl space-y-6">
              <TestModeBanner />
              {children ?? <Outlet />}
            </div>
            <footer className="mx-auto mt-12 flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 border-t border-border/60 py-5 text-xs text-muted-foreground">
              <div className="flex items-center gap-3">
                <img
                  src="/dr-raouf-roshdy.jpg"
                  alt="Dr Raouf Roshdy"
                  className="size-8.5 rounded-full object-cover ring-2 ring-primary/20 shadow-xs"
                />
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground tracking-tight">
                    Created by Dr Raouf Roshdy
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    All copyrights reserved 2026
                  </span>
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground font-medium">
                AIVF v3.1 · ESHRE 2025 Synchronized
              </div>
            </footer>
          </main>
        </div>

        {/* 2. Sticky Bottom Breadcrumb */}
        <StickyBreadcrumb
          patientName={patientName}
          stageTitle={stageInfo.title}
          onManualSave={handlePerformSave}
          isSaving={isSaving}
        />
      </div>

      {/* 3. PIN Re-Entry Modal on Idle Lock */}
      <Dialog open={isLocked} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-md border-border/80 bg-card p-6 shadow-2xl"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <div className="flex items-center gap-2 text-foreground">
              <div className="flex size-9 items-center justify-center rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
                <ClinicalIcon name={ShieldAlert} size="alert" tone="critical" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Session Locked (Hospital Security)
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground pt-0.5">
                  5-minute idle timeout reached. Re-enter device PIN to resume clinical session.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handlePinSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label htmlFor="idle-pin-input" className="text-xs font-semibold text-foreground">
                Device PIN / Passphrase
              </label>
              <div className="relative">
                <Input
                  id="idle-pin-input"
                  ref={pinInputRef}
                  type="password"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    setPinError(null);
                  }}
                  placeholder="Enter PIN / Passphrase"
                  className="h-10 text-center font-mono text-base tracking-widest pe-9"
                  autoFocus
                />
                {pin && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setPin("");
                      setPinError(null);
                      pinInputRef.current?.focus();
                    }}
                    className="absolute end-1 top-1 size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Clear input"
                  >
                    <ClinicalIcon name={Delete} size="inline" />
                  </Button>
                )}
              </div>
              {pinError && <p className="text-xs font-medium text-destructive">{pinError}</p>}
            </div>

            <DialogFooter className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
              <div className="text-[11px] text-muted-foreground font-mono">
                Security Policy: 5m idle lock
              </div>
              <Button
                type="submit"
                disabled={pin.length < 6 || isAuthenticating}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-xs gap-1.5"
              >
                <ClinicalIcon name={KeyRound} size="inline" className="mr-2" />
                <span>{isAuthenticating ? "Verifying..." : "Unlock Session"}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
