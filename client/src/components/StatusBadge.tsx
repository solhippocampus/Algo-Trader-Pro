import { cn } from "@/lib/utils";
import { Activity, Power, PowerOff } from "lucide-react";

interface StatusBadgeProps {
  isRunning: boolean;
  className?: string;
}

export function StatusBadge({ isRunning, className }: StatusBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border shadow-sm transition-all duration-300",
        isRunning
          ? "bg-green-500/10 text-green-400 border-green-500/20 shadow-green-500/10"
          : "bg-red-500/10 text-red-400 border-red-500/20 shadow-red-500/10",
        className
      )}
    >
      {isRunning ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          ACTIVE
        </>
      ) : (
        <>
          <PowerOff className="w-3 h-3" />
          STOPPED
        </>
      )}
    </div>
  );
}
