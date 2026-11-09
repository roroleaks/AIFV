/**
 * EncounterCard Component (§2)
 *
 * Compact read-view of an individual stimulation encounter:
 * folliculometry split by ovary and bucket, hormonal labs, medication doses,
 * titration adjustments, clinical note, and status badge.
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
            className="border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 gap-1 text-[10px] font-semibold"
          >
            <CheckCircle2 className="size-3" />
            <span>Verified</span>
          </Badge>
        );
      case "Entered":
        return (
          <Badge variant="secondary" className="text-[10px] font-semibold text-primary">
            Entered
          </Badge>
        );
      case "Locked":
        return (
          <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/80">
            Locked
          </Badge>
        );
      case "Draft":
      default:
        return (
          <Badge
            variant="outline"
            className="border-amber-500/40 bg-amber-500/10 text-amber-600 text-[10px]"
          >
            Draft
          </Badge>
        );
    }
  };

  return (
    <Card className="border-border/80 shadow-xs hover:border-primary/40 transition-all">
      {/* Header Strip */}
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b border-border/50 bg-muted/20">
        <div className="flex items-center gap-2.5">
          <Badge variant="outline" className="font-mono font-bold text-xs bg-background h-6 px-2">
            Day {day}
          </Badge>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="size-3.5 text-muted-foreground/80" />
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
              className="h-7 gap-1 px-2 text-xs text-emerald-700 dark:text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10"
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
              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              title="Edit encounter (F2)"
            >
              <Pencil className="size-3" />
              <span>Edit</span>
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3.5 text-xs">
        {/* Main 3-Column Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Column 1: Folliculometry by Ovary & Bucket */}
          <div className="rounded-lg border border-border/50 bg-background/50 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between border-b border-border/40 pb-1">
              <span className="font-semibold text-foreground text-[11px] uppercase tracking-wider">
                Ultrasound Cohort ({totalFollicles})
              </span>
              {leadFollicles > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[9px] font-bold text-primary">
                  {leadFollicles} ≥ 17mm
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-muted-foreground block text-[10px]">
                  Right Ovary ({rTotal})
                </span>
                <span className="font-mono text-foreground font-medium">
                  {ultrasound.folliclesRight.lt10} / {ultrasound.folliclesRight.b10_13} /{" "}
                  {ultrasound.folliclesRight.b14_16} / {ultrasound.folliclesRight.gte17}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">
                  Left Ovary ({lTotal})
                </span>
                <span className="font-mono text-foreground font-medium">
                  {ultrasound.folliclesLeft.lt10} / {ultrasound.folliclesLeft.b10_13} /{" "}
                  {ultrasound.folliclesLeft.b14_16} / {ultrasound.folliclesLeft.gte17}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-1 border-t border-border/30">
              <span>Buckets: &lt;10 · 10–13 · 14–16 · ≥17 mm</span>
              {ultrasound.endometriumMm && (
                <span className="font-semibold text-foreground">
                  Endo: {ultrasound.endometriumMm} mm
                </span>
              )}
            </div>
          </div>

          {/* Column 2: Hormonal Labs */}
          <div className="rounded-lg border border-border/50 bg-background/50 p-2.5 space-y-1.5">
            <span className="font-semibold text-foreground text-[11px] uppercase tracking-wider block border-b border-border/40 pb-1">
              Hormonal Kinetics
            </span>
            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              <div>
                <span className="text-muted-foreground block text-[10px]">Estradiol (E2)</span>
                <span className="font-bold text-foreground">
                  {labs.estradiolPgMl ? `${labs.estradiolPgMl} pg/mL` : "—"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">LH</span>
                <span className="font-medium text-foreground">
                  {labs.lhMiuMl ? `${labs.lhMiuMl} mIU/mL` : "—"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Progesterone (P4)</span>
                <span className="font-medium text-foreground">
                  {labs.progesteroneNgMl ? `${labs.progesteroneNgMl} ng/mL` : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Column 3: Medications & Titration Adjustment */}
          <div className="rounded-lg border border-border/50 bg-background/50 p-2.5 space-y-1.5">
            <span className="font-semibold text-foreground text-[11px] uppercase tracking-wider block border-b border-border/40 pb-1">
              Medication &amp; Adjustment
            </span>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-foreground">
                {medications.gonadotropinType} {medications.gonadotropinDoseIU} IU
              </span>
              {medications.antagonistDoseMg && (
                <Badge variant="outline" className="text-[10px] h-4.5 px-1 font-mono">
                  Antagonist: {medications.antagonistDoseMg} mg
                </Badge>
              )}
            </div>
            {adjustment.direction !== "hold" && (
              <div className="flex items-center gap-1.5 text-[11px] text-primary font-medium pt-0.5">
                {adjustment.direction === "up" && <TrendingUp className="size-3" />}
                {adjustment.direction === "down" && <TrendingDown className="size-3" />}
                {adjustment.direction === "coast" && <Minus className="size-3" />}
                <span className="capitalize">{adjustment.direction}</span>
                {adjustment.deltaIU > 0 && <span>({adjustment.deltaIU} IU)</span>}
                {adjustment.reason && (
                  <span className="text-muted-foreground truncate">· {adjustment.reason}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Clinical Note if present */}
        {note && (
          <div className="text-[11px] text-muted-foreground bg-muted/20 rounded p-2 border border-border/40">
            <span className="font-semibold text-foreground me-1">Note:</span>
            <span>{note}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
