import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Save,
  RotateCcw,
  ShieldCheck,
  LogOut,
  Lock,
  User,
  Building2,
  Clock,
  Sparkles,
  CheckCircle2,
  Loader2,
  History,
  Check,
  X,
  Sliders,
  Type,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getSession, setSessionRole, lockSession, type Role } from "@/services/auth/session";
import {
  loadAuditChain,
  verifyAuditChain,
  appendAuditEntry,
  type AuditEntry,
} from "@/services/audit/auditLog";

export const Route = createFileRoute("/_shell/settings")({
  head: () => ({
    meta: [
      { title: "Hospital Settings & Security — AIFV Clinical CDSS" },
      {
        name: "description",
        content:
          "Clinician profile, idle-lock timer, auto-save interval, accessibility and cryptographic audit governance.",
      },
    ],
  }),
  component: SettingsPage,
});

// -----------------------------------------------------------------------------
// Settings Schema & Defaults
// -----------------------------------------------------------------------------
export interface ClinicianSettings {
  name: string;
  role: Role;
  hospitalUnit: string;
  idleTimeout: number; // in seconds: 180 (3 min), 300 (5 min), 600 (10 min)
  autoSaveInterval: number; // in seconds: 15, 30, 60
  largeText: boolean;
  confirmIrreversible: boolean;
}

const DEFAULT_SETTINGS: ClinicianSettings = {
  name: "Dr. Raouf Roshdy",
  role: "Physician",
  hospitalUnit: "Reproductive Endocrinology & Infertility (IVF) Center",
  idleTimeout: 300, // 5 min
  autoSaveInterval: 30, // 30 s
  largeText: false,
  confirmIrreversible: true,
};

// -----------------------------------------------------------------------------
// Global Polish: PolishedButton Component
// -----------------------------------------------------------------------------
interface PolishedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon?: React.ReactNode;
  variant?: "primary" | "danger" | "success" | "neutral" | undefined;
  isLoading?: boolean | undefined;
  disabledReason?: string | undefined;
}

function PolishedButton({
  label,
  icon,
  variant = "primary",
  isLoading = false,
  disabled = false,
  disabledReason,
  className,
  onClick,
  ...props
}: PolishedButtonProps) {
  // Strict color system:
  // primary = blue-600, danger = red-600, success = green-600, neutral = slate-200
  const variantStyles = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white border-blue-700 shadow-sm transition-colors",
    danger: "bg-red-600 hover:bg-red-700 text-white border-red-700 shadow-sm transition-colors",
    success:
      "bg-green-600 hover:bg-green-700 text-white border-green-700 shadow-sm transition-colors",
    neutral:
      "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 hover:bg-slate-300 dark:hover:bg-slate-700 shadow-sm transition-colors",
  }[variant];

  const buttonElement = (
    <Button
      variant="outline"
      disabled={disabled || isLoading}
      onClick={onClick}
      className={cn(
        "cursor-pointer font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50",
        variantStyles,
        className,
      )}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        icon && <span className="mr-2 inline-flex items-center">{icon}</span>
      )}
      <span>{label}</span>
    </Button>
  );

  if (disabled && disabledReason) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-block cursor-not-allowed">{buttonElement}</span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="bg-slate-900 text-white border-slate-800 text-xs shadow-md font-normal"
        >
          <p>{disabledReason}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return buttonElement;
}

// -----------------------------------------------------------------------------
// Settings Page Component
// -----------------------------------------------------------------------------
function SettingsPage() {
  const [settings, setSettings] = useState<ClinicianSettings>(DEFAULT_SETTINGS);
  const [initialSettings, setInitialSettings] = useState<ClinicianSettings>(DEFAULT_SETTINGS);

  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Audit modal state
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditChain, setAuditChain] = useState<AuditEntry[]>([]);
  const [auditIntegrity, setAuditIntegrity] = useState<{
    valid: boolean;
    brokenAtIndex?: number;
    reason?: string;
  } | null>(null);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Load settings on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    let loadedSettings = { ...DEFAULT_SETTINGS };

    // Get current session
    const currentSession = getSession();
    if (currentSession.name) loadedSettings.name = currentSession.name;
    if (currentSession.role) loadedSettings.role = currentSession.role;

    try {
      const stored = window.sessionStorage.getItem("aifv_settings");
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<ClinicianSettings>;
        loadedSettings = { ...loadedSettings, ...parsed };
      } else {
        // Check individual keys
        const storedTimeout = window.sessionStorage.getItem("aifv_idle_timeout");
        if (storedTimeout) loadedSettings.idleTimeout = parseInt(storedTimeout, 10);

        const storedAutoSave = window.sessionStorage.getItem("aifv_autosave_interval");
        if (storedAutoSave) loadedSettings.autoSaveInterval = parseInt(storedAutoSave, 10);

        const storedLargeText = window.sessionStorage.getItem("aifv_large_text");
        if (storedLargeText !== null) loadedSettings.largeText = storedLargeText === "true";

        const storedConfirm = window.sessionStorage.getItem("aifv_confirm_irreversible");
        if (storedConfirm !== null) loadedSettings.confirmIrreversible = storedConfirm === "true";
      }
    } catch {
      // fallback to defaults
    }

    setSettings(loadedSettings);
    setInitialSettings(loadedSettings);
  }, []);

  // Determine if there are pending modifications
  const isDirty = useMemo(() => {
    return (
      settings.name !== initialSettings.name ||
      settings.role !== initialSettings.role ||
      settings.hospitalUnit !== initialSettings.hospitalUnit ||
      settings.idleTimeout !== initialSettings.idleTimeout ||
      settings.autoSaveInterval !== initialSettings.autoSaveInterval ||
      settings.largeText !== initialSettings.largeText ||
      settings.confirmIrreversible !== initialSettings.confirmIrreversible
    );
  }, [settings, initialSettings]);

  // Determine if settings are at baseline hospital defaults
  const isDefault = useMemo(() => {
    return (
      settings.name === DEFAULT_SETTINGS.name &&
      settings.role === DEFAULT_SETTINGS.role &&
      settings.hospitalUnit === DEFAULT_SETTINGS.hospitalUnit &&
      settings.idleTimeout === DEFAULT_SETTINGS.idleTimeout &&
      settings.autoSaveInterval === DEFAULT_SETTINGS.autoSaveInterval &&
      settings.largeText === DEFAULT_SETTINGS.largeText &&
      settings.confirmIrreversible === DEFAULT_SETTINGS.confirmIrreversible
    );
  }, [settings]);

  // Validation
  const isValid = settings.name.trim().length >= 3;

  // 1. Save Settings Action Handler
  const handleSaveSettings = useCallback(async () => {
    if (!isValid) {
      toast.error("Please enter a valid clinician name (minimum 3 characters).");
      return;
    }

    setIsSaving(true);
    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("aifv_settings", JSON.stringify(settings));
        window.sessionStorage.setItem("aifv_idle_timeout", settings.idleTimeout.toString());
        window.sessionStorage.setItem(
          "aifv_autosave_interval",
          settings.autoSaveInterval.toString(),
        );
        window.sessionStorage.setItem("aifv_large_text", settings.largeText.toString());
        window.sessionStorage.setItem(
          "aifv_confirm_irreversible",
          settings.confirmIrreversible.toString(),
        );

        // Apply accessibility font scale
        if (settings.largeText) {
          document.documentElement.classList.add("large-text-mode");
        } else {
          document.documentElement.classList.remove("large-text-mode");
        }

        // Notify app-shell countdown and save interval
        window.dispatchEvent(new CustomEvent("aifv-settings-updated"));
      }

      // Update session identity
      setSessionRole(settings.role, settings.name);

      // Append immutable audit log event
      await appendAuditEntry({
        by: settings.name,
        action: "settings.update",
        details: {
          role: settings.role,
          hospitalUnit: settings.hospitalUnit,
          idleTimeout: settings.idleTimeout,
          autoSaveInterval: settings.autoSaveInterval,
          largeText: settings.largeText,
          confirmIrreversible: settings.confirmIrreversible,
          timestamp: new Date().toISOString(),
        },
      });

      setInitialSettings(settings);
      toast.success("Hospital workstation settings saved successfully.");
    } catch (err) {
      toast.error("Failed to save settings: " + String(err));
    } finally {
      setIsSaving(false);
    }
  }, [settings, isValid]);

  // 2. Reset to Defaults Action Handler
  const handleResetDefaults = useCallback(async () => {
    setIsResetting(true);
    try {
      setSettings(DEFAULT_SETTINGS);

      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("aifv_settings");
        window.sessionStorage.setItem("aifv_idle_timeout", DEFAULT_SETTINGS.idleTimeout.toString());
        window.sessionStorage.setItem(
          "aifv_autosave_interval",
          DEFAULT_SETTINGS.autoSaveInterval.toString(),
        );
        window.sessionStorage.setItem("aifv_large_text", DEFAULT_SETTINGS.largeText.toString());
        window.sessionStorage.setItem(
          "aifv_confirm_irreversible",
          DEFAULT_SETTINGS.confirmIrreversible.toString(),
        );

        document.documentElement.classList.remove("large-text-mode");
        window.dispatchEvent(new CustomEvent("aifv-settings-updated"));
      }

      setSessionRole(DEFAULT_SETTINGS.role, DEFAULT_SETTINGS.name);

      await appendAuditEntry({
        by: DEFAULT_SETTINGS.name,
        action: "settings.reset_defaults",
        details: {
          resetTo: DEFAULT_SETTINGS,
          timestamp: new Date().toISOString(),
        },
      });

      setInitialSettings(DEFAULT_SETTINGS);
      toast.success("Settings restored to hospital baseline defaults.");
    } catch (err) {
      toast.error("Failed to reset settings: " + String(err));
    } finally {
      setIsResetting(false);
    }
  }, []);

  // 3. View Audit Log Action Handler
  const handleViewAuditLog = useCallback(async () => {
    setIsLoadingAudit(true);
    setIsAuditModalOpen(true);
    try {
      const chain = await loadAuditChain();
      setAuditChain(chain);
      const integrity = await verifyAuditChain(chain);
      setAuditIntegrity(integrity);

      await appendAuditEntry({
        by: settings.name,
        action: "audit.viewed",
        details: {
          chainLength: chain.length,
          integrityValid: integrity.valid,
        },
      });
    } catch (err) {
      toast.error("Could not load audit log: " + String(err));
    } finally {
      setIsLoadingAudit(false);
    }
  }, [settings.name]);

  // 4. Sign Out Action Handler
  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    try {
      await appendAuditEntry({
        by: settings.name,
        action: "session.sign_out",
        details: {
          role: settings.role,
          hospitalUnit: settings.hospitalUnit,
          timestamp: new Date().toISOString(),
        },
      });

      lockSession("user_sign_out");
      toast.info("Clinician signed out. Crypto keys purged and screen locked.");
    } catch (err) {
      toast.error("Error signing out: " + String(err));
    } finally {
      setIsSigningOut(false);
    }
  }, [settings]);

  // 5. Lock Screen Action Handler
  const handleLockScreen = useCallback(() => {
    lockSession("manual_lock");
    const win = window as unknown as { lockScreen?: () => void };
    if (typeof win.lockScreen === "function") {
      win.lockScreen();
    }
    toast.info("Workstation screen locked.");
  }, []);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6 pb-20">
        <PageHeader
          eyebrow="Clinical Workstation Governance"
          title="AIVF Settings & Preferences"
          description=""
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <PolishedButton
                label="Sign Out"
                icon={<LogOut className="h-4 w-4" />}
                variant="danger"
                isLoading={isSigningOut}
                onClick={handleSignOut}
              />

              <PolishedButton
                label="Lock Screen"
                icon={<Lock className="h-4 w-4" />}
                variant="neutral"
                onClick={handleLockScreen}
              />
            </div>
          }
        />

        {/* Top Notification Banner if changes pending */}
        {isDirty && (
          <div className="flex items-center justify-between rounded-lg border border-blue-500/30 bg-blue-500/10 p-3.5 text-xs text-blue-800 dark:text-blue-300">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 shrink-0 text-blue-600 animate-pulse" />
              <span>
                You have unsaved changes in your workstation preferences. Click{" "}
                <strong>Save Settings</strong> to apply.
              </span>
            </div>
            <PolishedButton
              label="Save Settings"
              icon={<Save className="h-3.5 w-3.5" />}
              variant="primary"
              isLoading={isSaving}
              disabled={!isValid}
              disabledReason={!isValid ? "Name must be at least 3 characters" : undefined}
              onClick={handleSaveSettings}
              className="h-7 text-xs px-3"
            />
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Section 1: Clinician Profile */}
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <User className="size-4 text-blue-600" />
                  Clinician Profile
                </CardTitle>
                <Badge
                  variant="outline"
                  className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20 text-[11px]"
                >
                  Active Session
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="clinician-name" className="text-xs font-medium">
                  Clinician Full Name & Title
                </Label>
                <Input
                  id="clinician-name"
                  value={settings.name}
                  onChange={(e) => setSettings((s) => ({ ...s, name: e.target.value }))}
                  placeholder="e.g. Dr. Raouf Roshdy"
                  className="h-9 text-xs"
                />
                {!isValid && (
                  <p className="text-[11px] text-red-500">
                    Clinician name must be at least 3 characters.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="clinician-role" className="text-xs font-medium">
                  Clinical Role & Authorization Level
                </Label>
                <Select
                  value={settings.role}
                  onValueChange={(val: Role) => setSettings((s) => ({ ...s, role: val }))}
                >
                  <SelectTrigger id="clinician-role" className="h-9 text-xs">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Physician" className="text-xs">
                      Physician (Standard Decision Support)
                    </SelectItem>
                    <SelectItem value="SeniorPhysician" className="text-xs">
                      Senior Physician (Override & Protocol Authorizer)
                    </SelectItem>
                    <SelectItem value="Coordinator" className="text-xs">
                      IVF Coordinator (Scheduling & Patient Intake)
                    </SelectItem>
                    <SelectItem value="Admin" className="text-xs">
                      Hospital Administrator (Full Governance & Audit)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="hospital-unit" className="text-xs font-medium">
                  Hospital Department / Clinical Unit
                </Label>
                <div className="relative">
                  <Building2 className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="hospital-unit"
                    value={settings.hospitalUnit}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        hospitalUnit: e.target.value,
                      }))
                    }
                    placeholder="e.g. Reproductive Endocrinology & IVF Unit"
                    className="h-9 pl-8 text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Hospital Security & Inactivity Countdown */}
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Clock className="size-4 text-blue-600" />
                  Idle-Lock Timer Policy
                </CardTitle>
                <Badge
                  variant="outline"
                  className="bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20 text-[11px]"
                >
                  Mandatory Security
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 text-xs">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Inactivity Timeout Duration</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "3 Minutes", val: 180, desc: "High traffic clinic" },
                    { label: "5 Minutes", val: 300, desc: "Hospital standard" },
                    { label: "10 Minutes", val: 600, desc: "Private consult room" },
                  ].map((opt) => {
                    const isSelected = settings.idleTimeout === opt.val;
                    return (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setSettings((s) => ({ ...s, idleTimeout: opt.val }))}
                        className={cn(
                          "flex flex-col items-start p-3 rounded-lg border text-left transition-all cursor-pointer",
                          isSelected
                            ? "border-blue-600 bg-blue-500/10 ring-1 ring-blue-600"
                            : "border-border bg-card hover:bg-muted/50",
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-semibold text-foreground text-xs">{opt.label}</span>
                          {isSelected && <Check className="size-3.5 text-blue-600 shrink-0" />}
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1">{opt.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-border/80 bg-muted/30 p-3 text-[11px] text-muted-foreground space-y-1">
                <div className="font-medium text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-emerald-600" />
                  <span>Countdown Threshold Alerting</span>
                </div>
                <p>
                  At <strong>01:00</strong> remaining, the countdown timer turns amber. At{" "}
                  <strong>00:15</strong>, it turns red. At <strong>00:00</strong>, the screen blurs
                  immediately and requires PIN re-authentication.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Clinical Workflow & Auto-Save */}
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Sliders className="size-4 text-blue-600" />
                  Auto-Save Routine Interval
                </CardTitle>
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-[11px]"
                >
                  Zero Data Loss
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 text-xs">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Background Save Interval</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "15 Seconds", val: 15, desc: "Rapid input" },
                    { label: "30 Seconds", val: 30, desc: "Default balanced" },
                    { label: "60 Seconds", val: 60, desc: "Low network load" },
                  ].map((opt) => {
                    const isSelected = settings.autoSaveInterval === opt.val;
                    return (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() =>
                          setSettings((s) => ({
                            ...s,
                            autoSaveInterval: opt.val,
                          }))
                        }
                        className={cn(
                          "flex flex-col items-start p-3 rounded-lg border text-left transition-all cursor-pointer",
                          isSelected
                            ? "border-blue-600 bg-blue-500/10 ring-1 ring-blue-600"
                            : "border-border bg-card hover:bg-muted/50",
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-semibold text-foreground text-xs">{opt.label}</span>
                          {isSelected && <Check className="size-3.5 text-blue-600 shrink-0" />}
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1">{opt.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-border/80 bg-muted/30 p-3 text-[11px] text-muted-foreground space-y-1">
                <div className="font-medium text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-blue-600" />
                  <span>Immediate Visibility Trigger</span>
                </div>
                <p>
                  Regardless of the chosen interval, whenever a clinician switches tabs, minimizes
                  the browser, or navigates away (<code>visibilitychange=hidden</code>), an
                  immediate auto-save is executed.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Accessibility & Safety Gates */}
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Type className="size-4 text-blue-600" />
                  Accessibility & Safety Gates
                </CardTitle>
                <Badge
                  variant="outline"
                  className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20 text-[11px]"
                >
                  Clinical Ergonomics
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 text-xs">
              {/* Toggle 1: Large-text mode */}
              <div className="flex items-center justify-between rounded-lg border border-border/80 p-3">
                <div className="space-y-0.5 pr-4">
                  <Label
                    htmlFor="large-text-toggle"
                    className="text-xs font-semibold text-foreground cursor-pointer"
                  >
                    Large-Text Mode for Accessibility
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Scales root typography by +10% across all clinical tables, nomograms, and
                    patient charts.
                  </p>
                </div>
                <Switch
                  id="large-text-toggle"
                  checked={settings.largeText}
                  onCheckedChange={(checked) => {
                    setSettings((s) => ({ ...s, largeText: checked }));
                    if (checked) {
                      document.documentElement.classList.add("large-text-mode");
                    } else {
                      document.documentElement.classList.remove("large-text-mode");
                    }
                  }}
                  aria-label="Toggle large-text accessibility mode"
                />
              </div>

              {/* Toggle 2: Confirm-on-irreversible */}
              <div className="flex items-center justify-between rounded-lg border border-border/80 p-3">
                <div className="space-y-0.5 pr-4">
                  <Label
                    htmlFor="confirm-irreversible-toggle"
                    className="text-xs font-semibold text-foreground cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Confirm on Irreversible Actions</span>
                    <Badge
                      variant="secondary"
                      className="text-[9px] h-4 px-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                    >
                      Default ON
                    </Badge>
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Enforces dual-confirmation security modals before irreversible steps (trigger
                    approval, cycle deletion, consent revocation, dossier seal).
                  </p>
                </div>
                <Switch
                  id="confirm-irreversible-toggle"
                  checked={settings.confirmIrreversible}
                  onCheckedChange={(checked) =>
                    setSettings((s) => ({
                      ...s,
                      confirmIrreversible: checked,
                    }))
                  }
                  aria-label="Toggle confirmation modals on irreversible actions"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section 5: Audit Ledger Card */}
        <Card className="border-border shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-600" />
                  Tamper-Evident Audit Ledger Governance
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Append-only SHA-256 hash-chained cryptographic ledger recording all session,
                  clinical, and parameter events.
                </CardDescription>
              </div>

              <PolishedButton
                label="View Audit Log"
                icon={<History className="h-4 w-4" />}
                variant="neutral"
                isLoading={isLoadingAudit}
                onClick={handleViewAuditLog}
              />
            </div>
          </CardHeader>

          <CardContent className="text-xs text-muted-foreground">
            <p>
              Every cycle stage transition, safety ceiling override, trigger decision, and settings
              adjustment is linked to the previous block via <code>prevHash</code> and signed with
              Web Crypto SHA-256. Entries are immutable and cannot be deleted or modified.
            </p>
          </CardContent>
        </Card>

        {/* Bottom Actions Row */}
        <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-background/95 p-4 backdrop-blur-md shadow-lg">
          <div className="flex items-center gap-2">
            <PolishedButton
              label="Reset to Defaults"
              icon={<RotateCcw className="h-4 w-4" />}
              variant="neutral"
              isLoading={isResetting}
              disabled={isDefault}
              disabledReason={isDefault ? "Settings already match hospital defaults" : undefined}
              onClick={handleResetDefaults}
            />

            <PolishedButton
              label="View Audit Log"
              icon={<History className="h-4 w-4" />}
              variant="neutral"
              isLoading={isLoadingAudit}
              onClick={handleViewAuditLog}
            />
          </div>

          <div className="flex items-center gap-2">
            <PolishedButton
              label="Save Settings"
              icon={<Save className="h-4 w-4" />}
              variant="primary"
              isLoading={isSaving}
              disabled={!isValid || (!isDirty && !isDefault)}
              disabledReason={
                !isValid
                  ? "Name must be at least 3 characters"
                  : !isDirty
                    ? "All settings are already up to date"
                    : undefined
              }
              onClick={handleSaveSettings}
            />

            <PolishedButton
              label="Lock Screen"
              icon={<Lock className="h-4 w-4" />}
              variant="neutral"
              onClick={handleLockScreen}
            />
          </div>
        </div>

        {/* Audit Trail Modal */}
        <Dialog open={isAuditModalOpen} onOpenChange={setIsAuditModalOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6">
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <ShieldCheck className="size-5 text-emerald-600" />
                  Tamper-Evident Hospital Audit Trail
                </DialogTitle>
                {auditIntegrity && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs px-2.5 py-0.5 font-semibold",
                      auditIntegrity.valid
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
                    )}
                  >
                    {auditIntegrity.valid
                      ? "SHA-256 Chain Intact (Valid)"
                      : "Integrity Compromised"}
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs">
                Showing {auditChain.length} immutable events in chronological sequence.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
              {isLoadingAudit ? (
                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground text-xs">
                  <Loader2 className="size-6 animate-spin mb-2 text-blue-600" />
                  <span>Loading cryptographic audit chain...</span>
                </div>
              ) : auditChain.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground text-xs">
                  No audit entries recorded yet.
                </div>
              ) : (
                auditChain
                  .slice()
                  .reverse()
                  .map((entry, idx) => (
                    <div
                      key={entry.id || idx}
                      className="rounded-lg border border-border bg-card p-3 text-xs space-y-1.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="font-mono text-[10px] bg-muted">
                            {entry.action}
                          </Badge>
                          <span className="font-semibold text-foreground text-xs">{entry.by}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {new Date(entry.at).toLocaleString()}
                        </span>
                      </div>

                      {entry.caseId && (
                        <div className="text-[11px] text-muted-foreground">
                          Patient Case ID:{" "}
                          <span className="font-mono font-medium text-foreground">
                            {entry.caseId}
                          </span>
                        </div>
                      )}

                      {entry.details && (
                        <div className="text-[11px] text-muted-foreground bg-muted/40 p-2 rounded font-mono overflow-x-auto max-h-24">
                          {JSON.stringify(entry.details, null, 2)}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1 border-t border-border/50 text-[10px] font-mono text-muted-foreground/80">
                        <span>Hash:</span>
                        <span className="truncate text-foreground max-w-[240px]">{entry.hash}</span>
                        {entry.prevHash && (
                          <>
                            <span className="text-border">|</span>
                            <span>Prev:</span>
                            <span className="truncate max-w-[140px]">{entry.prevHash}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>

            <DialogFooter className="border-t border-border pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAuditModalOpen(false)}
                className="border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700"
              >
                <X className="mr-1.5 h-4 w-4" /> Close Audit Log
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
