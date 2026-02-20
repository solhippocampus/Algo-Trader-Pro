import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StrategyCardProps {
  title: string;
  description: string;
  active?: boolean;
  icon: React.ReactNode;
  metrics?: { label: string; value: string }[];
  explanation: string;
}

export function StrategyCard({ title, description, active, icon, metrics, explanation }: StrategyCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative p-6 rounded-xl border transition-all duration-300 group overflow-hidden",
        "bg-card/40 backdrop-blur-sm hover:bg-card/60",
        active 
          ? "border-primary/50 shadow-lg shadow-primary/5 ring-1 ring-primary/20" 
          : "border-white/5 hover:border-white/10"
      )}
    >
      {active && (
        <div className="absolute top-0 right-0 px-3 py-1 bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider rounded-bl-xl border-b border-l border-primary/20">
          Active Strategy
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div className={cn(
          "p-3 rounded-lg transition-colors",
          active ? "bg-primary/20 text-primary" : "bg-white/5 text-muted-foreground group-hover:text-foreground"
        )}>
          {icon}
        </div>
        <Tooltip>
          <TooltipTrigger>
            <Info className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors cursor-help" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs bg-popover border-border text-popover-foreground">
            <p className="text-sm font-medium mb-1">How it works:</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{explanation}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <h3 className="text-lg font-bold font-display text-foreground mb-1 group-hover:text-primary transition-colors">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground mb-6 line-clamp-2 h-10">
        {description}
      </p>

      {metrics && (
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
          {metrics.map((metric, idx) => (
            <div key={idx}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                {metric.label}
              </p>
              <p className="text-sm font-mono font-medium text-foreground">
                {metric.value}
              </p>
            </div>
          ))}
        </div>
      )}
      
      {/* Background decoration */}
      <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </motion.div>
  );
}
