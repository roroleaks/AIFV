/**
 * OverrideDialog Component (§2.4)
 *
 * Modal enabling a physician to record a structured override with a mandatory
 * clinical justification (min 10 characters).
 *
 * Gating:
 *  - Only accessible to physicians (Coordinator role sees disabled trigger)
 *  - Hotkey: Ctrl+O triggers override when supported
 */

import { useState, useEffect } from "react";
import { AlertTriangle, Check, RotateCcw } from "lucide-react";
import type { EngineName, Override } from "@/services/clinical/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface OverrideOption {
  label: string;
  value: string;
  description?: string;
}

export interface OverrideDialogProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  engine: EngineName;
  field: string;
  fieldLabel: string;
  currentValue: unknown;
  currentDisplay: string;
  options?: OverrideOption[] | undefined;
  isNumeric?: boolean | undefined;
  minVal?: number | undefined;
  maxVal?: number | undefined;
  stepVal?: number | undefined;
  unit?: string | undefined;
  activeRole?: string | undefined;
  onConfirm: (override: Omit<Override, "id" | "at">) => void;
  onRemoveOverride?: (() => void) | undefined;
  existingOverride?: Override | undefined;
}

export function OverrideDialog({
  isOpen,
  onClose,
  caseId,
  engine,
  field,
  fieldLabel,
  currentValue,
  currentDisplay,
  options,
  isNumeric = false,
  minVal = 37.5,
  maxVal = 600,
  stepVal = 12.5,
  unit,
  activeRole = "Physician",
  onConfirm,
  onRemoveOverride,
  existingOverride,
}: OverrideDialogProps) {
  const isPhysician = activeRole.toLowerCase() === "physician";

  const [toValue, setToValue] = useState<string>(
    existingOverride ? String(existingOverride.toValue) : options ? (options[0]?.value ?? "") : "",
  );
  const [reason, setReason] = useState<string>(existingOverride?.reason ?? "");

  // Reset when dialog opens
  useEffect(() => {
    if (isOpen) {
      if (existingOverride) {
        setToValue(String(existingOverride.toValue));
        setReason(existingOverride.reason);
      } else if (options && options.length > 0) {
        const altOption = options.find((opt) => opt.value !== String(currentValue)) ?? options[0];
        setToValue(altOption?.value ?? "");
        setReason("");
      } else if (isNumeric) {
        setToValue(typeof currentValue === "number" ? String(currentValue) : "225");
        setReason("");
      } else {
        setToValue("");
        setReason("");
      }
    }
  }, [isOpen, existingOverride, currentValue, options, isNumeric]);

  const reasonTrimmed = reason.trim();
  const isReasonValid = reasonTrimmed.length >= 10;
  const charsRemaining = Math.max(0, 10 - reasonTrimmed.length);

  const handleSave = () => {
    if (!isReasonValid || !isPhysician) return;

    const parsedToValue = isNumeric ? Number(toValue) : toValue;

    onConfirm({
      caseId,
      engine,
      field,
      fromValue: currentValue,
      toValue: parsedToValue,
      reason: reasonTrimmed,
      by: `${activeRole === "Physician" ? "Attending Physician" : activeRole} (Override Sign)`,
    });

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-full bg-accent-override/10 text-accent-override">
              <AlertTriangle className="size-4" />
            </div>
            <DialogTitle className="text-sm font-bold text-foreground">
              Physician Decision Override: {fieldLabel}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            Overrides adapt clinical algorithms to individual patient history. Engine inputs remain
            pure and unmutated; your rationale will be recorded in the dossier.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Engine & Raw Recommendation Baseline */}
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">
                Algorithm Baseline ({engine})
              </span>
              <Badge variant="outline" className="text-[10px] font-mono">
                Engine Generated
              </Badge>
            </div>
            <div className="text-foreground font-semibold text-sm">
              {currentDisplay || String(currentValue)}
            </div>
          </div>

          {/* New Overridden Value Selector / Input */}
          <div className="space-y-1.5">
            <Label htmlFor="ovr-value" className="text-xs font-semibold">
              Physician-Selected Value *
            </Label>

            {options && options.length > 0 ? (
              <Select value={toValue} onValueChange={setToValue}>
                <SelectTrigger id="ovr-value" className="h-9 text-xs">
                  <SelectValue placeholder="Select alternative" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      <div className="flex flex-col">
                        <span className="font-medium">{opt.label}</span>
                        {opt.description && (
                          <span className="text-[10px] text-muted-foreground">
                            {opt.description}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : isNumeric ? (
              <div className="relative">
                <Input
                  id="ovr-value"
                  type="number"
                  min={minVal}
                  max={maxVal}
                  step={stepVal}
                  value={toValue}
                  onChange={(e) => setToValue(e.target.value)}
                  className="h-9 text-xs font-mono font-bold pe-12"
                  autoFocus
                />
                {unit && (
                  <span className="absolute end-3 top-2 text-[11px] text-muted-foreground font-mono">
                    {unit}
                  </span>
                )}
              </div>
            ) : (
              <Input
                id="ovr-value"
                type="text"
                value={toValue}
                onChange={(e) => setToValue(e.target.value)}
                className="h-9 text-xs"
                autoFocus
              />
            )}
          </div>

          {/* Mandatory Clinical Justification */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="ovr-reason" className="text-xs font-semibold">
                Clinical Justification * (Min. 10 characters)
              </Label>
              <span
                className={`text-[10px] font-mono ${
                  isReasonValid ? "text-safety-success" : "text-accent-override"
                }`}
              >
                {isReasonValid ? "Requirement met" : `${charsRemaining} chars needed`}
              </span>
            </div>
            <textarea
              id="ovr-reason"
              rows={3}
              placeholder="e.g. Prior cycle with antagonist yielded only 2 oocytes; converting to long agonist for improved synchronization."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-border/50 pt-3">
          {existingOverride && onRemoveOverride ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onRemoveOverride();
                onClose();
              }}
              className="text-xs text-safety-danger hover:bg-safety-danger/10 me-auto h-8 px-2"
            >
              <RotateCcw className="size-3 me-1" />
              <span>Revert to Algorithm</span>
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2 ms-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!isReasonValid || !isPhysician}
              onClick={handleSave}
              className="h-8 gap-1 text-xs bg-accent-override text-text-on-accent hover:bg-accent-override/90 shadow-xs"
              title={isPhysician ? "Apply structured override" : "Physician role required"}
            >
              <Check className="size-3.5" />
              <span>Confirm &amp; Apply Override</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
