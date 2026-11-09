import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Search, Globe, Settings, Sun, Moon, Eye, Shield, Building2, Lock, Brain } from "lucide-react";
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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    onSearch?.(e.target.value);
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
    <header className="sticky top-0 z-50 flex h-14 w-full items-center justify-between border-b border-border/80 bg-background/95 px-4 backdrop-blur-md supports-backdrop-filter:bg-background/80">
      {/* Start: Clinic identity & Brand */}
      <div className="flex items-center gap-3">
        <Link to="/worklist" className="flex items-center gap-2 hover:opacity-90">
          <BrandMark />
        </Link>
        <span className="hidden text-border sm:inline">|</span>
        <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
          <Building2 className="size-3.5 text-primary" />
          <span className="font-medium text-foreground">{t("topbar.brandSubtitle")}</span>
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase font-mono">
            {t("topbar.hospitalCdss")}
          </Badge>
        </div>
      </div>

      {/* Center: Global MRN / Name Search */}
      <div className="flex max-w-md flex-1 px-4">
        <div className="relative w-full">
          <Search className="absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder={t("topbar.searchPlaceholder")}
            className="h-8.5 w-full rounded-lg bg-muted/40 ps-8 text-xs focus-visible:bg-background"
          />
        </div>
      </div>

      {/* Encrypted Session Indicator (§2.7) */}
      <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-medium tracking-tight">
        <Shield className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span>{t("topbar.encryptedBadge")}</span>
      </div>

      {/* End: Decision, Role, Language, Theme, Legacy Switcher & Settings */}
      <div className="flex items-center gap-2">
        {/* Decision & Insights Trigger (Alt+D) */}
        {onToggleDecision && (
          <Button
            variant={isDecisionOpen ? "secondary" : "outline"}
            size="sm"
            onClick={onToggleDecision}
            className={cn(
              "h-8 gap-1.5 px-2.5 text-xs font-semibold shadow-2xs transition-all",
              isDecisionOpen
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "border-primary/30 text-primary hover:bg-primary/10",
            )}
            title="Toggle Clinical Decision Support (Alt+D)"
            aria-expanded={isDecisionOpen}
            aria-controls="decision-sidebar-panel"
          >
            <Brain className="size-3.5" />
            <span className="hidden sm:inline">{t("decisionSidebar.buttonLabel")}</span>
            <kbd className="hidden lg:inline-block rounded bg-muted/70 px-1 py-0.2 text-[9px] font-mono opacity-80">
              Alt+D
            </kbd>
          </Button>
        )}

        {/* Role Indicator */}
        <div className="hidden items-center gap-1.5 md:flex">
          <Badge
            variant="secondary"
            className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-primary cursor-pointer hover:bg-primary/10"
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
          className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
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
          className="h-8 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
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
          className="size-8 text-muted-foreground hover:text-foreground"
          aria-label={t("topbar.toggleTheme")}
          title={`Theme: ${theme.toUpperCase()} (Click to toggle)`}
        >
          {theme === "dark" ? (
            <Sun className="size-4" />
          ) : theme === "high-contrast" ? (
            <Eye className="size-4 text-amber-500" />
          ) : (
            <Moon className="size-4" />
          )}
        </Button>

        {/* Settings */}
        <Link to="/settings">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            aria-label={t("topbar.settings")}
          >
            <Settings className="size-4" />
          </Button>
        </Link>
      </div>
    </header>
  );
}
