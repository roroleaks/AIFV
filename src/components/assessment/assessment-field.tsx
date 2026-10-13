import { useState } from "react";
import { Check, ChevronsUpDown, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { FieldDef } from "@/lib/assessment/schema";
import type { FieldValue } from "@/lib/assessment/use-assessment";
import {
  interpretDerived,
  interpretField,
  toneClasses,
} from "@/lib/assessment/interpretations";

function SearchableSelect({
  id,
  value,
  options,
  onChange,
  placeholder,
}: {
  id: string;
  value?: string | undefined;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-10 w-full justify-between rounded-xl font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <span className="truncate">{value || placeholder || "Select…"}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          {options.length > 6 && <CommandInput placeholder="Search…" className="h-9" />}
          <CommandList>
            <CommandEmpty>No match found.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => {
                    onChange(opt === value ? "" : opt);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("size-4", value === opt ? "opacity-100" : "opacity-0")} />
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function MultiSelect({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (opt: string) =>
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(opt)}
            className={cn(
              "rounded-xl border px-3 py-2 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              active
                ? "border-primary/40 bg-primary-soft text-primary shadow-soft"
                : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {active && <Check className="size-3.5" />}
              {opt}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function AssessmentField({
  field,
  values,
  value,
  onChange,
  idPrefix = "f",
}: {
  field: FieldDef;
  values: Record<string, unknown>;
  value: FieldValue;
  onChange: (v: FieldValue) => void;
  idPrefix?: string;
}) {
  const id = `${idPrefix}-${field.key}`;
  const span =
    field.colSpan === 3 ? "sm:col-span-2 lg:col-span-3" : field.colSpan === 2 ? "sm:col-span-2" : "";

  const invalid =
    field.type === "number" &&
    value !== "" &&
    value !== undefined &&
    ((field.min !== undefined && Number(value) < field.min) ||
      (field.max !== undefined && Number(value) > field.max));

  const indicator =
    field.type === "derived"
      ? interpretDerived(field.key, values)
      : field.type === "number"
        ? interpretField(field.key, value, values)
        : null;

  return (
    <div className={cn("space-y-1.5", span)}>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {field.label}
        {field.unit && <span className="ml-1 text-[11px] opacity-70">({field.unit})</span>}
      </Label>

      {field.type === "derived" ? (
        <div className="flex h-10 items-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary-soft/60 px-3 text-sm font-semibold text-primary">
          <Sparkles className="size-3.5 shrink-0" />
          <span className="truncate">{field.compute?.(values) || "—"}</span>
        </div>
      ) : field.type === "select" ? (
        <SearchableSelect
          id={id}
          value={typeof value === "string" ? value : undefined}
          options={field.options ?? []}
          onChange={(v) => onChange(v)}
          placeholder={field.placeholder}
        />
      ) : field.type === "multi" ? (
        <MultiSelect
          options={field.options ?? []}
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
        />
      ) : field.type === "textarea" ? (
        <Textarea
          id={id}
          rows={3}
          className="rounded-xl"
          placeholder={field.placeholder}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          id={id}
          type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
          inputMode={field.type === "number" ? "decimal" : undefined}
          min={field.min}
          max={field.max}
          step={field.step}
          aria-invalid={invalid || undefined}
          className={cn("h-10 rounded-xl", invalid && "border-destructive focus-visible:ring-destructive")}
          placeholder={field.placeholder}
          value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {indicator && !invalid && (
        <p
          className={cn(
            "inline-flex animate-fade-in items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold",
            toneClasses[indicator.tone],
          )}
        >
          <span className="size-1.5 rounded-full bg-current" aria-hidden />
          {indicator.label}
        </p>
      )}
      {invalid && (
        <p className="text-[11px] font-medium text-destructive">
          Enter a value between {field.min} and {field.max}.
        </p>
      )}
      {!invalid && !indicator && field.hint && (
        <p className="text-[11px] text-muted-foreground">{field.hint}</p>
      )}
    </div>
  );
}

