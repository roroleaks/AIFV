import { TestModeBanner } from "@/components/engine/test-mode-banner";
import { useState, type ReactNode } from "react";
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
} from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const topNav = [
  { label: "Dashboard", to: "/dashboard" },
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
    title: "Workspace",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
      { label: "Patients", to: "/patients", icon: ClipboardPlus },
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

export function AppShell({ children }: { children?: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen w-full bg-background">
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

          <div className="flex shrink-0 items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search patients, evidence…"
                aria-label="Global search"
                className="h-9 w-56 rounded-xl border-border/70 bg-background/60 pl-9 text-sm"
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

      <div className="flex w-full">
        <aside
          className={cn(
            "sticky top-[57px] hidden h-[calc(100vh-57px)] shrink-0 flex-col border-r border-sidebar-border bg-sidebar py-4 transition-[width] duration-300 lg:flex",
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
    </div>
  );
}
