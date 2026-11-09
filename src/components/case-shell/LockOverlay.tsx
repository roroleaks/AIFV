/**
 * Clinical Session Lock Screen Overlay (§2.5)
 *
 * Appears when:
 *  - User exceeds 5 minutes of inactivity.
 *  - User clicks "Lock" in TopBar.
 *
 * Behavior:
 *  - Enforces minimum 8 characters (or passphrase). Rejects 4-digit and 6-digit PINs.
 *  - Live PIN strength meter (weak / fair / strong).
 *  - Blocks all data access until device PIN is entered.
 *  - Key is re-derived via PBKDF2 on successful PIN entry.
 *  - Rate-limited (60s lockout) after 5 failed PIN attempts.
 *  - Keyboard focus-trapped while open.
 */

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Lock, Shield, AlertTriangle, KeyRound, Key } from "lucide-react";
import {
  getSession,
  subscribeSession,
  authenticateWithPin,
  completeFirstRunSetup,
  type SessionContext,
} from "@/services/auth/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function calculatePinStrength(val: string): {
  level: "weak" | "fair" | "strong";
  percent: number;
} {
  if (val.length === 0) return { level: "weak", percent: 0 };
  if (val.length < 8) return { level: "weak", percent: 25 };

  const hasLetters = /[a-zA-Z]/.test(val);
  const hasNumbers = /[0-9]/.test(val);
  const hasSymbols = /[^a-zA-Z0-9]/.test(val);
  const diversity = (hasLetters ? 1 : 0) + (hasNumbers ? 1 : 0) + (hasSymbols ? 1 : 0);

  if (val.length >= 10 && diversity >= 2) {
    return { level: "strong", percent: 100 };
  }
  if (val.length >= 8 && diversity >= 2) {
    return { level: "fair", percent: 65 };
  }
  return { level: "fair", percent: 50 };
}

export function LockOverlay() {
  const { t } = useTranslation();
  const [session, setSession] = useState<SessionContext>(getSession());
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return subscribeSession(setSession);
  }, []);

  const isFirstRun = session.firstRunSetupRequired === true;

  // Focus trap inside lock overlay (§2.4)
  useEffect(() => {
    if (!session.locked && !isFirstRun) return;

    inputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current) return;
      if (e.key === "Tab") {
        const focusables = containerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [session.locked, isFirstRun]);

  if (!session.locked && !isFirstRun) {
    return null;
  }

  const strength = calculatePinStrength(pin);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin.trim()) return;

    if (pin.length < 8) {
      setError(t("lockOverlay.pinStrengthWeak"));
      return;
    }

    if (isFirstRun) {
      if (pin !== confirmPin) {
        setError(t("lockOverlay.pinMismatch"));
        return;
      }
      setError(null);
      setIsAuthenticating(true);
      try {
        await completeFirstRunSetup(pin);
        setPin("");
        setConfirmPin("");
        setError(null);
      } catch (err: unknown) {
        setError((err as Error).message);
      } finally {
        setIsAuthenticating(false);
      }
      return;
    }

    setError(null);
    setIsAuthenticating(true);

    try {
      const success = await authenticateWithPin(pin);
      if (success) {
        setPin("");
        setError(null);
      } else {
        setError(`Incorrect PIN. ${5 - session.failedPinAttempts} attempts remaining.`);
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isFirstRun ? t("lockOverlay.firstRunTitle") : t("lockOverlay.lockedTitle")}
      className="fixed inset-0 z-100 flex items-center justify-center bg-background/95 backdrop-blur-xl animate-in fade-in duration-200"
    >
      <div
        ref={containerRef}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl"
      >
        <div className="flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4 border border-primary/20">
            {isFirstRun ? <Key className="size-7" /> : <Lock className="size-7" />}
          </div>

          <h2 className="text-xl font-bold tracking-tight text-foreground">
            {isFirstRun ? t("lockOverlay.firstRunTitle") : t("lockOverlay.lockedTitle")}
          </h2>
          <p className="mt-1.5 text-xs text-muted-foreground max-w-xs">
            {isFirstRun ? t("lockOverlay.firstRunSubtitle") : t("lockOverlay.lockedSubtitle")}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 w-full space-y-4">
            <div className="space-y-1.5 text-start">
              <label
                htmlFor="device-pin-input"
                className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
              >
                <KeyRound className="size-3 text-primary" />
                <span>
                  {isFirstRun
                    ? `${t("lockOverlay.confirmPin")} (≥8 chars)`
                    : "Device PIN / Passphrase"}
                </span>
              </label>
              <Input
                id="device-pin-input"
                ref={inputRef}
                type="password"
                maxLength={32}
                autoFocus
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError(null);
                }}
                placeholder={t("lockOverlay.pinPlaceholder")}
                className="h-11 text-center font-mono text-base tracking-widest"
              />

              {/* PIN Strength Meter (§2.5) */}
              {pin.length > 0 && (
                <div className="pt-1.5 space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">
                      {t("lockOverlay.pinStrengthLabel")}
                    </span>
                    <span
                      className={cn(
                        "font-semibold",
                        strength.level === "weak" && "text-destructive",
                        strength.level === "fair" && "text-amber-500",
                        strength.level === "strong" && "text-emerald-500",
                      )}
                    >
                      {strength.level === "weak" && t("lockOverlay.pinStrengthWeak")}
                      {strength.level === "fair" && t("lockOverlay.pinStrengthFair")}
                      {strength.level === "strong" && t("lockOverlay.pinStrengthStrong")}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all duration-300",
                        strength.level === "weak" && "bg-destructive",
                        strength.level === "fair" && "bg-amber-500",
                        strength.level === "strong" && "bg-emerald-500",
                      )}
                      style={{ width: `${strength.percent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm PIN Field for First-Run Setup */}
            {isFirstRun && (
              <div className="space-y-1.5 text-start">
                <label
                  htmlFor="confirm-pin-input"
                  className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
                >
                  <KeyRound className="size-3 text-primary" />
                  <span>{t("lockOverlay.confirmPin")}</span>
                </label>
                <Input
                  id="confirm-pin-input"
                  type="password"
                  maxLength={32}
                  value={confirmPin}
                  onChange={(e) => {
                    setConfirmPin(e.target.value);
                    setError(null);
                  }}
                  placeholder={t("lockOverlay.confirmPin")}
                  className="h-11 text-center font-mono text-base tracking-widest"
                />
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive border border-destructive/20 text-start"
              >
                <AlertTriangle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={isAuthenticating || pin.length < 8 || (isFirstRun && !confirmPin)}
              className="w-full h-10 font-semibold"
            >
              {isAuthenticating
                ? "Deriving PBKDF2 Key..."
                : isFirstRun
                  ? t("lockOverlay.initializeButton")
                  : t("lockOverlay.unlockButton")}
            </Button>
          </form>

          <div className="mt-6 flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
            <Shield className="size-3 text-emerald-500" />
            <span>{t("topbar.encryptedBadge")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
