import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { UnitLogo } from "./Brand";
import type { Settings } from "@/lib/queue";

export function PageHeader({ settings, title, subtitle, actions }: { settings: Settings; title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-4 px-4 py-3 md:px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Menu
        </Link>
        <div className="flex min-w-0 items-center gap-3">
          <UnitLogo settings={settings} className="h-9 w-9" />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight">{title}</h1>
            <p className="truncate text-xs text-muted-foreground">{subtitle ?? settings.unit_name}</p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>
      </div>
    </header>
  );
}
