import { Ticket } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Settings } from "@/lib/queue";

export function UnitLogo({ settings, className }: { settings: Pick<Settings, "logo_url" | "unit_name">; className?: string }) {
  if (settings.logo_url) {
    return <img src={settings.logo_url} alt={settings.unit_name} className={cn("h-10 w-auto object-contain", className)} />;
  }
  return (
    <div className={cn("grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground", className)}>
      <Ticket className="h-1/2 w-1/2" />
    </div>
  );
}
