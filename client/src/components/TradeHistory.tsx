import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { Trade } from "@shared/schema";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface TradeHistoryProps {
  trades: Trade[];
  isLoading: boolean;
}

export function TradeHistory({ trades, isLoading }: TradeHistoryProps) {
  if (isLoading) {
    return <div className="h-48 flex items-center justify-center text-muted-foreground animate-pulse">Loading trade history...</div>;
  }

  if (trades.length === 0) {
    return (
      <div className="h-48 flex flex-col items-center justify-center text-muted-foreground border border-dashed border-white/10 rounded-xl bg-white/5">
        <p>No trades recorded yet</p>
        <p className="text-xs mt-1 opacity-50">Start the bot to see activity</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/5 bg-card/40 backdrop-blur-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-white/5">
          <TableRow className="border-white/5 hover:bg-white/5">
            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Time</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Symbol</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Side</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Price</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Amount</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Strategy</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">PnL</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((trade) => (
            <TableRow key={trade.positionId || trade.id} className="border-white/5 hover:bg-white/5 transition-colors">
              <TableCell className="font-mono text-xs text-muted-foreground">
                {trade.executedAt ? format(new Date(trade.executedAt), "HH:mm:ss") : (trade.createdAt ? format(new Date(trade.createdAt), "HH:mm:ss") : "-")}
              </TableCell>
              <TableCell className="font-bold">{trade.symbol}</TableCell>
              <TableCell>
                <Badge 
                  variant="outline" 
                  className={(trade.side === "LONG" || trade.side === "BUY")
                    ? "bg-green-500/10 text-green-500 border-green-500/20" 
                    : "bg-red-500/10 text-red-500 border-red-500/20"
                  }
                >
                  {(trade.side === "LONG" || trade.side === "BUY") ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownLeft className="w-3 h-3 mr-1" />}
                  {trade.side}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-mono">${(trade.entryPrice || trade.price)?.toFixed(2)}</TableCell>
              <TableCell className="text-right font-mono">{(trade.quantity || trade.amount)?.toFixed(4)}</TableCell>
              <TableCell>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                  {trade.strategyUsed || "Motif"}
                </span>
              </TableCell>
              <TableCell className={cn(
                "text-right font-mono font-bold",
                Number(trade.pnl) > 0 ? "text-green-500" : Number(trade.pnl) < 0 ? "text-red-500" : "text-muted-foreground"
              )}>
                {trade.pnl ? `${Number(trade.pnl) > 0 ? "+" : ""}${trade.pnl}` : "OPEN"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
