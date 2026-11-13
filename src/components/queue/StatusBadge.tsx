import { cn } from "@/lib/utils";
import { STEP_STATUS_LABEL } from "@/lib/queue";

const STYLES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  waiting: "bg-primary-soft text-accent-foreground",
  called: "bg-call-soft text-call-foreground",
  in_service: "bg-call text-call-foreground",
  done: "bg-success-soft text-success",
  no_show: "bg-priority-soft text-priority",
  cancelled: "bg-muted text-muted-foreground line-through",
};

export function StepStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", STYLES[status], className)}>
      {STEP_STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function PriorityBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full bg-priority px-2 py-0.5 text-xs font-semibold text-priority-foreground", className)}>
      Preferencial
    </span>
  );
}
