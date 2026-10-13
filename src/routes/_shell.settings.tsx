import { createFileRoute } from "@tanstack/react-router";
import { Building2, Upload } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SectionCard, EmptyPlaceholder } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/hooks/use-theme";

export const Route = createFileRoute("/_shell/settings")({
  head: () => ({
    meta: [
      { title: "Settings — IVF Ai Calc" },
      { name: "description", content: "Clinic profile, units, databases, theme and language." },
      { property: "og:title", content: "Settings — IVF Ai Calc" },
      {
        property: "og:description",
        content: "Clinic profile, units, databases, theme and language.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Workspace preferences for your clinic."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Clinic Profile">
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <span className="grid size-16 shrink-0 place-items-center rounded-xl border border-dashed border-border bg-muted/50 text-muted-foreground">
                <Building2 className="size-6" />
              </span>
              <Button variant="outline" className="rounded-xl">
                <Upload className="size-4" /> Upload clinic logo
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="clinic-name">Clinic name</Label>
              <Input
                id="clinic-name"
                placeholder="e.g. Nile Fertility Centre"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input id="country" placeholder="Country" className="rounded-xl" />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Clinical Preferences">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Preferred units</Label>
              <Select>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select unit system" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="si">SI units</SelectItem>
                  <SelectItem value="conventional">Conventional units</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Select>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/70 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Dark theme</p>
                <p className="text-xs text-muted-foreground">Switch the workspace appearance</p>
              </div>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(v) => setTheme(v ? "dark" : "light")}
                aria-label="Toggle dark theme"
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Medication Database">
          <EmptyPlaceholder label="No medication database connected" className="min-h-32" />
        </SectionCard>

        <SectionCard title="Brand Database">
          <EmptyPlaceholder label="No brand database connected" className="min-h-32" />
        </SectionCard>
      </div>
    </>
  );
}
