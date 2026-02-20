import { useBotControl, useBotStatus, useStats, useTrades } from "@/hooks/use-bot";
import { StrategyCard } from "@/components/StrategyCard";
import { StatCard } from "@/components/StatCard";
import { TradeHistory } from "@/components/TradeHistory";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AreaChart, Area, XAxis, YAxis, Tooltip as ChartTooltip, ResponsiveContainer } from "recharts";
import { Activity, Zap, Scale, TrendingUp, BrainCircuit, LineChart, Play, Square, Settings as SettingsIcon } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { data: status } = useBotStatus();
  const { data: stats } = useStats();
  const { data: trades } = useTrades();
  const { startBot, stopBot } = useBotControl();

  const isRunning = status?.isRunning || false;
  
  // Mock data for chart if not enough trades
  const chartData = trades && trades.length > 5 
    ? trades.map(t => ({ pnl: Number(t.pnl), time: t.createdAt }))
    : Array.from({ length: 10 }).map((_, i) => ({ pnl: Math.random() * 20 - 5, time: i }));

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 grid-bg">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-display tracking-tight leading-none">Binance Quant</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Autonomous Trading System</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <StatusBadge isRunning={isRunning} />
            <Link href="/settings">
              <Button variant="outline" size="icon" className="h-9 w-9 border-white/10 hover:bg-white/5">
                <SettingsIcon className="w-4 h-4 text-muted-foreground" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Control Panel & Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-card p-6 rounded-2xl border-l-4 border-l-primary flex flex-col justify-between h-full min-h-[200px]">
              <div>
                <h2 className="text-xl font-bold font-display mb-2">Bot Control</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  {isRunning 
                    ? "System is actively monitoring market data and executing trades based on selected strategies."
                    : "System is offline. Strategies will not execute until the bot is started."}
                </p>
              </div>
              
              <Button 
                onClick={() => isRunning ? stopBot.mutate() : startBot.mutate()}
                disabled={startBot.isPending || stopBot.isPending}
                className={cn(
                  "w-full h-12 text-base font-semibold shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]",
                  isRunning 
                    ? "bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50" 
                    : "bg-primary hover:bg-primary/90 text-white shadow-primary/25"
                )}
              >
                {startBot.isPending || stopBot.isPending ? (
                  "Processing..."
                ) : isRunning ? (
                  <><Square className="w-4 h-4 mr-2 fill-current" /> STOP BOT</>
                ) : (
                  <><Play className="w-4 h-4 mr-2 fill-current" /> START BOT</>
                )}
              </Button>
            </div>
          </div>

          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
              label="Total PnL" 
              value={`$${stats?.totalPnl.toFixed(2) || '0.00'}`} 
              subValue="+12.5% vs last week"
              trend="up"
              icon={<LineChart className="w-5 h-5" />}
            />
            <StatCard 
              label="Win Rate" 
              value={`${stats?.winRate.toFixed(1) || '0.0'}%`} 
              subValue="Based on 142 trades"
              trend="neutral"
              icon={<Activity className="w-5 h-5" />}
            />
            <StatCard 
              label="Active Positions" 
              value={stats?.activePositions || 0} 
              subValue="3 Long / 2 Short"
              icon={<Scale className="w-5 h-5" />}
            />
            <StatCard 
              label="Total Volume" 
              value="$124.5k" 
              subValue="24h Volume"
              icon={<Zap className="w-5 h-5" />}
            />
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="strategies" className="w-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold font-display">System Overview</h2>
            <TabsList className="bg-white/5 border border-white/10 p-1">
              <TabsTrigger value="strategies" className="data-[state=active]:bg-primary data-[state=active]:text-white">Strategies</TabsTrigger>
              <TabsTrigger value="performance" className="data-[state=active]:bg-primary data-[state=active]:text-white">Performance</TabsTrigger>
              <TabsTrigger value="trades" className="data-[state=active]:bg-primary data-[state=active]:text-white">Live Trades</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="strategies" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              <StrategyCard 
                title="Market Making"
                description="Provides liquidity by placing limit orders on both sides."
                active={status?.activeStrategy === 'MarketMaking'}
                icon={<Scale className="w-6 h-6" />}
                explanation="Continuously places buy and sell limit orders near the current price to capture the bid-ask spread. Profits from stable or range-bound markets."
                metrics={[
                  { label: "Spread", value: "0.15%" },
                  { label: "Orders", value: "Active" }
                ]}
              />
              <StrategyCard 
                title="Arbitrage"
                description="Exploits price differences across multiple markets."
                active={status?.activeStrategy === 'Arbitrage'}
                icon={<Zap className="w-6 h-6" />}
                explanation="Monitors different exchanges or pairs for the same asset. Instantly buys lower and sells higher when a discrepancy exceeds fees."
                metrics={[
                  { label: "Opps/hr", value: "12" },
                  { label: "Avg Profit", value: "0.4%" }
                ]}
              />
              <StrategyCard 
                title="Momentum"
                description="Follows trends based on news and volume spikes."
                active={status?.activeStrategy === 'Momentum'}
                icon={<TrendingUp className="w-6 h-6" />}
                explanation="Detects strong price movements accompanied by high volume. Enters positions in the direction of the trend and rides it until momentum fades."
                metrics={[
                  { label: "RSI", value: "64" },
                  { label: "Trend", value: "Bullish" }
                ]}
              />
              <StrategyCard 
                title="Bayes + Monte Carlo"
                description="Probabilistic modeling for risk-adjusted entries."
                active={status?.activeStrategy === 'Bayesian'}
                icon={<BrainCircuit className="w-6 h-6" />}
                explanation="Uses Bayesian inference to update probability beliefs with new data. Runs Monte Carlo simulations to predict future price paths and assess risk."
                metrics={[
                  { label: "Confidence", value: "87%" },
                  { label: "Sims", value: "10k" }
                ]}
              />
              <StrategyCard 
                title="Reinforcement Learning"
                description="Self-optimizing agent that learns from market feedback."
                active={status?.activeStrategy === 'RL'}
                icon={<Activity className="w-6 h-6" />}
                explanation="An AI agent that learns optimal actions (buy, sell, hold) by interacting with the market environment and maximizing a reward function (PnL)."
                metrics={[
                  { label: "Epsilon", value: "0.1" },
                  { label: "Reward", value: "+245" }
                ]}
              />
            </div>
          </TabsContent>

          <TabsContent value="performance" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="glass-card p-6 rounded-2xl h-[400px]">
              <h3 className="text-lg font-bold mb-6">Cumulative Profit/Loss</h3>
              <ResponsiveContainer width="100%" height="85%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <YAxis stroke="#4b5563" fontSize={12} tickFormatter={(value) => `$${value}`} />
                  <ChartTooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'white' }}
                    itemStyle={{ color: 'hsl(var(--primary))' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="pnl" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorPnl)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="trades" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <TradeHistory trades={trades || []} isLoading={!trades} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
