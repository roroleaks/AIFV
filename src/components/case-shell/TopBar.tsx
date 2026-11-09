import { useState, useRef, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Search,
  Globe,
  Settings,
  Sun,
  Moon,
  Eye,
  Shield,
  Building2,
  Lock,
  Brain,
  X,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/hooks/use-theme";
import { lockSession, setSessionRole, type Role } from "@/services/auth/session";
import { cn } from "@/lib/utils";

interface TopBarProps {
  onSearch?: (term: string) => void;
  activeRole?: string;
  onRoleChange?: (role: string) => void;
  isDecisionOpen?: boolean;
  onToggleDecision?: () => void;
}

export function TopBar({
  onSearch,
  activeRole = "Physician",
  onRoleChange,
  isDecisionOpen,
  onToggleDecision,
}: TopBarProps) {
  const { t, i18n } = useTranslation();
  const { theme, toggle } = useTheme();
  const [searchTerm, setSearchTerm] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    onSearch?.(e.target.value);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    onSearch?.("");
    searchInputRef.current?.focus();
  };

  const toggleLanguage = () => {
    const nextLang = i18n.language === "ar" ? "en" : "ar";
    i18n.changeLanguage(nextLang);
    if (typeof document !== "undefined") {
      document.documentElement.dir = nextLang === "ar" ? "rtl" : "ltr";
      document.documentElement.lang = nextLang;
    }
  };

  return (
    <header className="sticky top-0 z-50 flex h-14 w-full items-center justify-between border-b border-border-subtle bg-bg-surface/95 px-4 backdrop-blur-md supports-backdrop-filter:bg-bg-surface/80">
      {/* Start: Clinic identity & Brand */}
      <div className="flex items-center gap-3">
        <Link to="/worklist" className="flex items-center gap-2 hover:opacity-90">
          <BrandMark />
        </Link>
        <span className="hidden text-border-subtle sm:inline">|</span>
        <div className="hidden items-center gap-1.5 text-xs text-text-secondary sm:flex">
          <Building2 className="size-3.5 text-accent-primary" />
          <span className="font-medium text-text-primary">{t("topbar.brandSubtitle")}</span>
          <Badge
            variant="outline"
            className="h-5 px-1.5 text-[10px] uppercase font-mono border-border-default text-text-muted"
          >
            {t("topbar.hospitalCdss")}
          </Badge>
        </div>
      </div>

      {/* Center: Global MRN / Name Search with Ctrl+K */}
      <div className="flex max-w-md flex-1 px-4">
        <div className="relative w-full">
          <Search className="absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            ref={searchInputRef}
            type="search"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder={t("topbar.searchPlaceholder")}
            className="h-8.5 w-full rounded-md bg-bg-surface-muted/60 ps-8 pe-12 text-xs border-border-subtle focus-visible:bg-bg-surface focus-visible:border-accent-primary focus-visible:ring-1 focus-visible:ring-accent-primary"
          />
          {searchTerm ? (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              title="Clear search"
            >
              <X className="size-3.5" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 rounded border border-border-default bg-bg-surface px-1.5 py-0.5 text-[10px] font-mono text-text-muted">
              Ctrl+K
            </kbd>
          )}
        </div>
      </div>

      {/* Encrypted Session Indicator (§2.7) */}
      <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-safety-success-bg border border-safety-success/20 text-safety-success text-[11px] font-medium tracking-tight">
        <Shield className="size-3.5 shrink-0" />
        <span>{t("topbar.encryptedBadge")}</span>
      </div>

      {/* End: Decision, Role, Language, Theme & Settings */}
      <div className="flex items-center gap-2">
        {/* Decision & Insights Trigger (Alt+D) */}
        {onToggleDecision && (
          <Button
            variant={isDecisionOpen ? "secondary" : "outline"}
            size="sm"
            onClick={onToggleDecision}
            className={cn(
              "h-8 gap-1.5 px-2.5 text-xs font-semibold transition-colors",
              isDecisionOpen
                ? "bg-accent-primary text-text-on-accent hover:bg-accent-primary-hover"
                : "border-accent-primary/30 text-accent-primary hover:bg-accent-primary/10",
            )}
            title="Toggle Clinical Decision Support (Alt+D)"
            aria-expanded={isDecisionOpen}
            aria-controls="decision-sidebar-panel"
          >
            <Brain className="size-3.5" />
            <span className="hidden sm:inline">{t("decisionSidebar.buttonLabel")}</span>
            <kbd className="hidden lg:inline-block rounded bg-bg-surface-muted px-1 py-0.2 text-[9px] font-mono text-text-muted">
              Alt+D
            </kbd>
          </Button>
        )}

        {/* Role Indicator */}
        <div className="hidden items-center gap-1.5 md:flex">
          <Badge
            variant="secondary"
            className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-accent-primary cursor-pointer hover:bg-accent-primary/10 bg-bg-surface-muted border-border-subtle"
            title="Click to toggle clinical role"
            onClick={() => {
              const nextRole: Role = activeRole === "Physician" ? "Coordinator" : "Physician";
              onRoleChange?.(nextRole);
              setSessionRole(nextRole);
            }}
          >
            <Shield className="size-3" />
            <span>{t(`roles.${activeRole}`, activeRole)}</span>
          </Badge>
        </div>

        {/* Manual Lock Button (§2.5) */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => lockSession("manual_topbar")}
          className="h-8 gap-1 px-2 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-surface-muted"
          title={t("topbar.lockTitle")}
        >
          <Lock className="size-3.5" />
          <span className="hidden sm:inline">{t("topbar.lock")}</span>
        </Button>

        {/* Bilingual EN/AR Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleLanguage}
          className="h-8 px-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-surface-muted"
          title={t("topbar.toggleLang")}
        >
          <Globe className="me-1 size-3.5" />
          <span>{(i18n.language || "en").toUpperCase()}</span>
        </Button>

        {/* Theme Toggle (Light -> Dark -> High-Contrast) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className="size-8 text-text-secondary hover:text-text-primary hover:bg-bg-surface-muted"
          aria-label={t("topbar.toggleTheme")}
          title={`Theme: ${theme.toUpperCase()} (Click to toggle)`}
        >
          {theme === "dark" ? (
            <Sun className="size-4" />
          ) : theme === "high-contrast" ? (
            <Eye className="size-4 text-safety-warning" />
          ) : (
            <Moon className="size-4" />
          )}
        </Button>

        {/* Settings */}
        <Link to="/settings">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-text-secondary hover:text-text-primary hover:bg-bg-surface-muted"
            aria-label={t("topbar.settings")}
          >
            <Settings className="size-4" />
          </Button>
        </Link>
      </div>
    </header>
  );
}
