/**
 * EncounterCard Component (§2)
 *
 * Compact read-view of an individual stimulation encounter:
 * folliculometry split by ovary and bucket, hormonal labs, medication doses,
 * titration adjustments, clinical note, and status badge.
 *
 * Enforces:
 *  - Academic color system (§11)
 *  - Logical spacing scale (§2.1)
 */

import {
  Calendar,
  CheckCircle2,
  Pencil,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import type { Encounter, EncounterStatus } from "./types";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface EncounterCardProps {
  encounter: Encounter;
  onEdit?: (encounter: Encounter) => void;
  onVerify?: (encounterId: string) => void;
}

export function EncounterCard({ encounter, onEdit, onVerify }: EncounterCardProps) {
  const { date, day, ultrasound, labs, medications, adjustment, note, status } = encounter;

  const rTotal =
    ultrasound.folliclesRight.lt10 +
    ultrasound.folliclesRight.b10_13 +
    ultrasound.folliclesRight.b14_16 +
    ultrasound.folliclesRight.gte17;

  const lTotal =
    ultrasound.folliclesLeft.lt10 +
    ultrasound.folliclesLeft.b10_13 +
    ultrasound.folliclesLeft.b14_16 +
    ultrasound.folliclesLeft.gte17;

  const totalFollicles = rTotal + lTotal;
  const leadFollicles = ultrasound.folliclesRight.gte17 + ultrasound.folliclesLeft.gte17;

  const getStatusBadge = (st: EncounterStatus) => {
    switch (st) {
      case "Verified":
        return (
          <Badge
            variant="outline"
            className="border-safety-success/50 bg-safety-success-bg text-safety-success gap-1 text-[10px] font-semibold"
          >
            <CheckCircle2 className="size-3" />
            <span>Verified</span>
          </Badge>
        );
      case "Entered":
        return (
          <Badge
            variant="secondary"
            className="text-[10px] font-semibold text-accent-primary bg-bg-surface-muted border-border-subtle"
          >
            Entered
          </Badge>
        );
      case "Locked":
        return (
          <Badge variant="outline" className="text-[10px] text-text-muted border-border-default">
            Locked
          </Badge>
        );
      case "Draft":
      default:
        return (
          <Badge
            variant="outline"
            className="border-safety-warning/40 bg-safety-warning-bg text-safety-warning text-[10px]"
          >
            Draft
          </Badge>
        );
    }
  };

  return (
    <Card className="border-border-subtle bg-bg-surface shadow-2xs hover:border-accent-primary/40 transition-all">
      {/* Header Strip */}
      <CardHeader className="flex flex-row items-center justify-between py-2.5 px-4 border-b border-border-subtle bg-bg-surface-muted/40">
        <div className="flex items-center gap-2.5">
          <Badge
            variant="outline"
            className="font-mono font-bold text-xs bg-bg-surface h-6 px-2 border-border-default text-text-primary"
          >
            Day {day}
          </Badge>
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <Calendar className="size-3.5" />
            <span>{date ? new Date(date).toLocaleDateString() : `Stim Day ${day}`}</span>
          </div>
          {getStatusBadge(status)}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          {status === "Entered" && onVerify && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onVerify(encounter.id)}
              className="h-7 gap-1 px-2 text-xs text-safety-success border-safety-success/40 hover:bg-safety-success-bg"
              title="Verify encounter data"
            >
              <ShieldCheck className="size-3" />
              <span>Verify</span>
            </Button>
          )}

          {status !== "Locked" && onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(encounter)}
              className="h-7 gap-1 px-2 text-xs text-text-muted hover:text-text-primary hover:bg-bg-surface-muted"
              title="Edit encounter (F2)"
            >
              <Pencil className="size-3" />
              <span>Edit</span>
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3 text-xs">
        {/* Main 3-Column Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Column 1: Folliculometry by Ovary & Bucket */}
          <div className="rounded-lg border border-border-subtle bg-bg-surface p-2.5 space-y-1.5">
            <div className="flex items-center justify-between border-b border-border-subtle pb-1">
              <span className="font-semibold text-text-primary text-[11px] uppercase tracking-wider">
                Ultrasound Cohort ({totalFollicles})
              </span>
              {leadFollicles > 0 && (
                <Badge
                  variant="secondary"
                  className="h-4 px-1 text-[9px] font-bold text-accent-primary bg-bg-surface-muted"
                >
                  {leadFollicles} ≥ 17mm
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-text-muted block text-[10px]">Right Ovary ({rTotal})</span>
                <span className="font-mono text-text-primary font-medium">
                  {ultrasound.folliclesRight.lt10} / {ultrasound.folliclesRight.b10_13} /{" "}
                  {ultrasound.folliclesRight.b14_16} / {ultrasound.folliclesRight.gte17}
                </span>
              </div>
              <div>
                <span className="text-text-muted block text-[10px]">Left Ovary ({lTotal})</span>
                <span className="font-mono text-text-primary font-medium">
                  {ultrasound.folliclesLeft.lt10} / {ultrasound.folliclesLeft.b10_13} /{" "}
                  {ultrasound.folliclesLeft.b14_16} / {ultrasound.folliclesLeft.gte17}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center text-[10px] text-text-muted pt-1 border-t border-border-subtle">
              <span>Buckets: &lt;10 · 10–13 · 14–16 · ≥17 mm</span>
              {ultrasound.endometriumMm && (
                <span className="font-semibold text-text-primary">
                  Endo: {ultrasound.endometriumMm} mm
                </span>
              )}
            </div>
          </div>

          {/* Column 2: Hormonal Labs */}
          <div className="rounded-lg border border-border-subtle bg-bg-surface p-2.5 space-y-1.5">
            <span className="font-semibold text-text-primary text-[11px] uppercase tracking-wider block border-b border-border-subtle pb-1">
              Hormonal Kinetics
            </span>
            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              <div>
                <span className="text-text-muted block text-[10px]">Estradiol (E2)</span>
                <span className="font-bold text-text-primary">
                  {labs.estradiolPgMl ? `${labs.estradiolPgMl} pg/mL` : "—"}
                </span>
              </div>
              <div>
                <span className="text-text-muted block text-[10px]">LH</span>
                <span className="font-medium text-text-primary">
                  {labs.lhMiuMl ? `${labs.lhMiuMl} mIU/mL` : "—"}
                </span>
              </div>
              <div>
                <span className="text-text-muted block text-[10px]">Progesterone (P4)</span>
                <span className="font-medium text-text-primary">
                  {labs.progesteroneNgMl ? `${labs.progesteroneNgMl} ng/mL` : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Column 3: Medications & Titration Adjustment */}
          <div className="rounded-lg border border-border-subtle bg-bg-surface p-2.5 space-y-1.5">
            <span className="font-semibold text-text-primary text-[11px] uppercase tracking-wider block border-b border-border-subtle pb-1">
              Medication &amp; Adjustment
            </span>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-text-primary">
                {medications.gonadotropinType} {medications.gonadotropinDoseIU} IU
              </span>
              {medications.antagonistDoseMg && (
                <Badge
                  variant="outline"
                  className="text-[10px] h-4.5 px-1 font-mono border-border-default text-text-muted"
                >
                  Antagonist: {medications.antagonistDoseMg} mg
                </Badge>
              )}
            </div>
            {adjustment.direction !== "hold" && (
              <div className="flex items-center gap-1.5 text-[11px] text-accent-primary font-medium pt-0.5">
                {adjustment.direction === "up" && <TrendingUp className="size-3" />}
                {adjustment.direction === "down" && <TrendingDown className="size-3" />}
                {adjustment.direction === "coast" && <Minus className="size-3" />}
                <span className="capitalize">{adjustment.direction}</span>
                {adjustment.deltaIU > 0 && <span>({adjustment.deltaIU} IU)</span>}
                {adjustment.reason && (
                  <span className="text-text-muted truncate">· {adjustment.reason}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Clinical Note if present */}
        {note && (
          <div className="text-[11px] text-text-secondary bg-bg-surface-muted/60 rounded p-2 border border-border-subtle">
            <span className="font-semibold text-text-primary me-1">Note:</span>
            <span>{note}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
