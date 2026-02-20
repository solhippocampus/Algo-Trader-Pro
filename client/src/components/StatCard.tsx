import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({ label, value, subValue, trend, icon, className }: StatCardProps) {
  return (
    <div className={cn(
      "glass-card p-6 rounded-xl relative overflow-hidden",
      className
    )}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
          <h4 className="text-3xl font-bold font-mono tracking-tight text-foreground">
            {value}
          </h4>
          {subValue && (
            <p className={cn(
              "text-xs font-medium mt-2 flex items-center gap-1",
              trend === "up" ? "text-green-400" : trend === "down" ? "text-red-400" : "text-muted-foreground"
            )}>
              {trend === "up" && "↑"}
              {trend === "down" && "↓"}
              {subValue}
            </p>
          )}
        </div>
        {icon && (
          <div className="p-3 rounded-full bg-white/5 text-muted-foreground">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
