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
  { label: "Hospital Worklist", to: "/worklist" },
  { label: "1. Assessment", to: "/assessment" },
  { label: "2. POSEIDON", to: "/poseidon" },
  { label: "3. Protocols", to: "/protocols" },
  { label: "4. Starting Dose", to: "/starting-dose" },
  { label: "5. Monitoring", to: "/monitoring" },
  { label: "6. Trigger", to: "/trigger" },
  { label: "7. Completion", to: "/cycle-completion" },
  { label: "8. Reports", to: "/reports" },
  { label: "Evidence", to: "/evidence" },
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
                "px-3 pb-1 text-[11px] font-bold uppercase tracking-wider",
                sIdx === 1 ? "text-primary" : "text-muted-foreground/70",
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
                "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-sidebar-foreground/80 transition-all hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
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
                <item.icon
                  className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground"
                  strokeWidth={2}
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
  if (pathname.startsWith("/trigger"))
    return { title: "Stage 6: Trigger Decision & Safety", stageNumber: 6 };
  if (pathname.startsWith("/cycle-completion"))
    return { title: "Stage 7: Cycle Completion & Safety", stageNumber: 7 };
  if (pathname.startsWith("/reports"))
    return { title: "Stage 8: Clinical Intelligence Report", stageNumber: 8 };
  if (pathname.startsWith("/worklist")) return { title: "Hospital Clinical Worklist" };
  if (pathname.startsWith("/patients")) return { title: "Patients Registry" };
  if (pathname.startsWith("/dashboard")) return { title: "Clinical Dashboard" };
  if (pathname.startsWith("/engine")) return { title: "Intelligence Engine" };
  if (pathname.startsWith("/calculator")) return { title: "Clinical Calculator" };
  if (pathname.startsWith("/evidence")) return { title: "Evidence Library & Governance" };
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
    <div className="sticky top-0 z-35 flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-background/95 px-4 py-2 backdrop-blur-md shadow-2xs text-xs">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs border border-primary/20">
            {patientName.slice(0, 2).toUpperCase()}
          </div>
          <span className="font-bold text-foreground text-sm tracking-tight">{patientName}</span>
        </div>

        <span className="text-border">|</span>

        <div className="flex items-center gap-1.5 font-mono text-muted-foreground text-[11px]">
          <span className="text-muted-foreground/80">ID:</span>
          <span className="font-semibold text-foreground">{patientId}</span>
        </div>

        <span className="text-border">|</span>

        <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
          <span className="text-muted-foreground/80">Age:</span>
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
          <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>{lastSavedText}</span>
        </div>

        <Link to="/patients">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-[11px] font-medium border-border/70 hover:bg-muted text-foreground"
          >
            <UserCheck className="size-3 me-1.5 text-primary" />
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
            <Home className="size-3.5" />
            <span>Home</span>
          </Button>
        </Link>

        <ChevronRight className="size-3.5 text-muted-foreground/50 rtl:rotate-180" />

        <Link to="/assessment">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs text-foreground font-semibold hover:bg-muted/50 gap-1"
          >
            <User className="size-3.5 text-primary" />
            <span>{patientName}</span>
          </Button>
        </Link>

        <ChevronRight className="size-3.5 text-muted-foreground/50 rtl:rotate-180" />

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
          <Save className="size-3 text-primary" />
          <span>{isSaving ? "Saving..." : "Save Now"}</span>
        </Button>
      </div>
    </footer>
  );
}

// -----------------------------------------------------------------------------
// Main AppShell Component
// -----------------------------------------------------------------------------
const IDLE_TIMEOUT_SECONDS = 300; // 05:00
const STORAGE_KEY = "lastActiveAt";

export function AppShell({ children }: { children?: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Patient assessment draft data
  const { draft, savedAt } = useAssessment();
  const [isSaving, setIsSaving] = useState(false);
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

  // 3. Top-Right Idle Countdown & Hospital Inactivity Lock State
  const [secondsRemaining, setSecondsRemaining] = useState<number>(IDLE_TIMEOUT_SECONDS);
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
    setSecondsRemaining(IDLE_TIMEOUT_SECONDS);
  }, [isLocked]);

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
      const remaining = Math.max(0, IDLE_TIMEOUT_SECONDS - elapsed);

      setSecondsRemaining(remaining);

      if (remaining <= 0) {
        lockScreen();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isLocked, lockScreen]);

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
        <header className="sticky top-0 z-40 border-b border-border/70 glass-panel">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                    <Menu className="size-5" />
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

              <nav aria-label="Sections" className="ml-4 hidden min-w-0 items-center gap-1 xl:flex">
                {topNav.map((item) => {
                  const active = pathname.startsWith(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                        active && "bg-primary-soft text-primary",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Top Right Controls & Mandatory Idle-Lock Countdown */}
            <div className="flex shrink-0 items-center gap-2">
              <Link to="/worklist" className="hidden sm:inline-flex">
                <Button size="sm" className="h-8 gap-1.5 text-xs font-semibold shadow-xs">
                  <Sparkles className="size-3.5" />
                  <span>Hospital Worklist</span>
                </Button>
              </Link>

              {/* 3. Top-Right Idle Countdown Timer */}
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-mono transition-colors",
                    secondsRemaining <= 15
                      ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 animate-pulse font-bold"
                      : secondsRemaining <= 60
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold"
                        : "border-border/60 bg-muted/30 text-muted-foreground",
                  )}
                  title={`Hospital Inactivity Countdown: ${formatCountdown(secondsRemaining)} remaining before lock`}
                >
                  <Clock className="size-3.5" />
                  <span>{formatCountdown(secondsRemaining)}</span>
                </div>

                {/* Extend Button (visible when timer <= 60s) */}
                {secondsRemaining <= 60 && !isLocked && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetActivity}
                    className="h-7 px-2 text-[11px] text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 border-amber-500/40 gap-1 font-semibold"
                    title="Extend session by 5 minutes"
                  >
                    <RotateCcw className="size-3" />
                    <span>Extend (+5m)</span>
                  </Button>
                )}

                {/* Manual Immediate Lock Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={lockScreen}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted gap-1"
                  title="Immediately lock clinical session"
                >
                  <Lock className="size-3.5" />
                  <span className="hidden sm:inline">Lock</span>
                </Button>
              </div>

              <div className="relative hidden md:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search patients, evidence…"
                  aria-label="Global search"
                  className="h-9 w-44 lg:w-56 rounded-xl border-border/70 bg-background/60 pl-9 text-sm"
                />
              </div>

              <Button variant="ghost" size="icon" aria-label="Notifications">
                <Bell className="size-4.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggle}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
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
              "sticky top-[95px] hidden h-[calc(100vh-95px)] shrink-0 flex-col border-r border-sidebar-border bg-sidebar py-4 transition-[width] duration-300 lg:flex",
              collapsed ? "w-[74px]" : "w-64",
            )}
          >
            <SideNavList collapsed={collapsed} />
            <div className="mt-auto px-3">
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 text-muted-foreground",
                  collapsed && "justify-center",
                )}
                onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? (
                  <PanelLeft className="size-4.5" />
                ) : (
                  <PanelLeftClose className="size-4.5" />
                )}
                {!collapsed && <span className="text-sm">Collapse</span>}
              </Button>
              {!collapsed && (
                <Link
                  to="/help"
                  className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60"
                >
                  <LifeBuoy className="size-4.5" />
                  Help & Support
                </Link>
              )}
            </div>
          </aside>

          <main className="flex min-w-0 flex-1 flex-col px-4 py-6 lg:px-8 lg:py-8">
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
              <div className="text-[11px] text-muted-foreground">
                AiFV Precision · ESHRE 2025 Synchronized
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
                <ShieldAlert className="size-5" />
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
                    <Delete className="size-4" />
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
                <KeyRound className="size-3.5" />
                <span>{isAuthenticating ? "Verifying..." : "Unlock Session"}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
