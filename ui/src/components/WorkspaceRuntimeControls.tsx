import { Activity, Loader2, Play, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type WorkspaceRuntimeAction = "start" | "stop" | "restart";

type WorkspaceRuntimeControlsProps = {
  isRunning: boolean;
  canStart: boolean;
  isPending?: boolean;
  pendingAction?: WorkspaceRuntimeAction | null;
  disabledHint?: string | null;
  onAction: (action: WorkspaceRuntimeAction) => void;
  className?: string;
};

export function hasRunningRuntimeServices(
  runtimeServices: Array<{ status: string }> | null | undefined,
) {
  return (runtimeServices ?? []).some((service) => service.status === "starting" || service.status === "running");
}

export function WorkspaceRuntimeControls({
  isRunning,
  canStart,
  isPending = false,
  pendingAction = null,
  disabledHint = null,
  onAction,
  className,
}: WorkspaceRuntimeControlsProps) {
  const actions: WorkspaceRuntimeAction[] = isRunning ? ["stop", ...(canStart ? ["restart" as const] : [])] : ["start"];
  const statusCopy = isRunning
    ? "Attached services are live for this workspace."
    : canStart
      ? "Ready to start attached services."
      : "Add a working directory and runtime config to start services.";

  return (
    <div className={cn("rounded-xl border border-border/70 bg-background/60 p-3", className)}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Runtime state</div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                  isRunning
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-border bg-background text-muted-foreground",
                )}
              >
                <Activity className="h-3.5 w-3.5" />
                {isRunning ? "Running" : "Stopped"}
              </span>
              <span className="text-xs text-muted-foreground">{statusCopy}</span>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            {actions.map((action) => {
              const Icon = action === "start" ? Play : action === "stop" ? Square : RotateCcw;
              const label = action === "start" ? "Start" : action === "stop" ? "Stop" : "Restart";
              const showSpinner = isPending && pendingAction === action;
              const disabled = isPending || ((action === "start" || action === "restart") && !canStart);

              return (
                <Button
                  key={action}
                  variant={action === "start" ? "default" : action === "stop" ? "destructive" : "outline"}
                  size="sm"
                  className={cn(
                    "h-10 w-full justify-start rounded-xl px-3 shadow-none sm:w-auto",
                    action === "restart" ? "bg-background" : null,
                  )}
                  disabled={disabled}
                  onClick={() => onAction(action)}
                >
                  {showSpinner ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                  {label}
                </Button>
              );
            })}
          </div>
        </div>
        {!isRunning && !canStart && disabledHint ? <p className="text-xs text-muted-foreground">{disabledHint}</p> : null}
      </div>
    </div>
  );
}
