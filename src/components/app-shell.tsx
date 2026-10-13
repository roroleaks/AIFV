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
  { label: "New Assessment", to: "/assessment" },
  { label: "Patients", to: "/patients" },
  { label: "Engine", to: "/engine" },
  { label: "POSEIDON", to: "/poseidon" },
  { label: "Reports", to: "/reports" },
  { label: "Evidence Library", to: "/evidence" },
  { label: "Settings", to: "/settings" },
  { label: "Help", to: "/help" },
] as const;

const sideNav = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Patient Assessment", to: "/assessment", icon: ClipboardPlus },
  { label: "Clinical Calculator", to: "/calculator", icon: Calculator },
  { label: "Intelligence Engine", to: "/engine", icon: Cpu },
  { label: "POSEIDON Clinical Assessment", to: "/poseidon", icon: Compass },
  { label: "Patient Phenotype Engine", to: "/decision-support", icon: Brain },
  { label: "Protocol Recommendation", to: "/protocols", icon: Stethoscope },
  { label: "Gonadotropin Selection", to: "/gonadotropins", icon: Pill },
  { label: "Starting Dose Engine", to: "/starting-dose", icon: Syringe },
  { label: "CONSORT Starting Dose", to: "/consort", icon: Syringe },
  { label: "Monitoring & Dose Adjustment", to: "/monitoring", icon: Activity },
  { label: "Trigger Decision & Safety", to: "/trigger", icon: Syringe },
  { label: "Cycle Completion & Safety", to: "/cycle-completion", icon: ShieldCheck },

  { label: "Reports", to: "/reports", icon: FileText },
  { label: "Evidence Library", to: "/evidence", icon: BookOpen },
  { label: "Evidence Master Index", to: "/evidence-master", icon: Library },
  { label: "Evidence Updates", to: "/evidence-updates", icon: Library },
  { label: "Evidence Requirements", to: "/evidence-requirements", icon: FileWarning },
  { label: "Update Evidence Center", to: "/evidence-governance", icon: Library },
  { label: "Full Engine Test", to: "/system-test", icon: FileWarning },

  { label: "Favorites", to: "/favorites", icon: Star },
  { label: "Settings", to: "/settings", icon: Settings },
] as const;

function SideNavList({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  return (
    <nav aria-label="Primary" className="flex flex-col gap-1 px-3">
      {sideNav.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          title={collapsed ? item.label : undefined}
          activeProps={{
            className: "bg-sidebar-accent text-sidebar-accent-foreground font-semibold",
          }}
          className={cn(
            "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/80 transition-all hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          <item.icon className="size-4.5 shrink-0" strokeWidth={2} />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </Link>
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
            <span className="ml-1 hidden size-9 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary sm:grid">
              DR
            </span>
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
              className={cn("w-full justify-start gap-3 text-muted-foreground", collapsed && "justify-center")}
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeft className="size-4.5" /> : <PanelLeftClose className="size-4.5" />}
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
          <footer className="mx-auto mt-10 w-full max-w-7xl border-t border-border/60 pt-4 text-[11px] tracking-wide text-muted-foreground">
            Created by Dr Raouf Roshdy
          </footer>
        </main>

      </div>
    </div>
  );
}

