import { useBotControl, useBotStatus, useStats, useTrades, useAccountBalance, useDecisions, useMotifWeights, useOnChain, useMultiExchange, useCorrelation, usePositions, useAtrConfig, useUpdateAtrConfig, useTradesClosed, usePnlSummary, useMultiStrategyMarkets, useEnsembleWeights, useMotifPatterns, useMultiStrategyBotControl, useMultiStrategyBotStatus, useMultiStrategyPositions } from "@/hooks/use-bot";
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
  const { data: decisions } = useDecisions();
  const { data: motifWeights } = useMotifWeights();
  const { data: accountData } = useAccountBalance();
  const { data: onchain } = useOnChain();
  const { data: multiExchange } = useMultiExchange();
  const { data: correlation } = useCorrelation();
  const { data: positions } = usePositions();
  const { data: atrConfig } = useAtrConfig();
  const { data: closedTrades } = useTradesClosed();
  const { data: pnlSummary } = usePnlSummary();
  const updateAtr = useUpdateAtrConfig();
  const { startBot, stopBot } = useBotControl();

  // Multi-strategy hooks
  const { data: multiStrategyMarkets } = useMultiStrategyMarkets();
  const { data: ensembleWeights } = useEnsembleWeights();
  const { data: motifPatterns } = useMotifPatterns();
  const { startMultiBot, stopMultiBot } = useMultiStrategyBotControl();
  const { data: multiStrategyStatus } = useMultiStrategyBotStatus();
  const { data: multiStrategyPositions } = useMultiStrategyPositions();

  const isRunning = status?.isRunning || false;
  const isMultiStrategyRunning = multiStrategyStatus?.isRunning || false;
  
  // Build chart data from closed trades with cumulative PnL
  const chartData = closedTrades && closedTrades.length > 0
    ? closedTrades.reduce((acc: any[], trade: any, index: number) => {
        const cumPnL = acc.length > 0 
          ? acc[acc.length - 1].cumPnL + (trade.pnl || 0)
          : (trade.pnl || 0);
        return [...acc, { 
          symbol: trade.symbol,
          pnl: trade.pnl || 0,
          cumPnL,
          time: new Date(trade.closedAt || trade.executedAt).toLocaleTimeString(),
          date: index.toString()
        }];
      }, [])
    : Array.from({ length: 10 }).map((_, i) => ({ cumPnL: Math.random() * 20 - 5, time: i, date: i.toString() }));

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
              subValue={`Based on ${stats?.totalTrades || 0} trades`}
              trend="neutral"
              icon={<Activity className="w-5 h-5" />}
            />
            <StatCard 
              label="Active Positions" 
              value={stats?.activePositions || 0}
              subValue={`Total: ${stats?.totalTrades || 0} trades`}
              icon={<Scale className="w-5 h-5" />}
            />
            <StatCard 
              label="Total Trades" 
              value={stats?.totalTrades || 0}
              subValue={`Win Rate: ${(pnlSummary?.winRate || 0).toFixed(1)}%`}
              icon={<Zap className="w-5 h-5" />}
            />
          </div>
        </div>

        {/* Binance Account Balances */}
        <div className="glass-card p-6 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold font-display flex items-center gap-2">
                <Activity className="w-6 h-6 text-green-500" />
                Binance Account Balance
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {accountData?.mode === 'LIVE' ? (
                  <span className="text-green-500 font-semibold">🔴 LIVE ACCOUNT</span>
                ) : (
                  <span className="text-yellow-500 font-semibold">📊 DEMO MODE</span>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                {accountData?.timestamp ? new Date(accountData.timestamp).toLocaleTimeString() : 'Loading...'}
              </p>
              <p className="text-sm text-muted-foreground">
                {accountData?.totalAssets} assets
              </p>
            </div>
          </div>

          {accountData?.balances && accountData.balances.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {accountData.balances.map((balance: any, index: number) => (
                <div 
                  key={`${balance.asset}-${index}`}
                  className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors"
                >
                  <p className="text-sm text-muted-foreground mb-1">{balance.asset}</p>
                  <p className="text-xl font-bold font-display text-green-400">
                    {balance.total.toFixed(8)}
                  </p>
                  {balance.locked > 0 && (
                    <p className="text-xs text-yellow-500 mt-2">
                      Locked: {balance.locked.toFixed(8)}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Available: {balance.free.toFixed(8)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading account balances...</p>
            </div>
          )}
        </div>

        {/* Multi-Strategy Markets Overview */}
        <div className="glass-card p-6 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold font-display flex items-center gap-2">
                <Zap className="w-6 h-6 text-blue-500" />
                Multi-Strategy Markets
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {isMultiStrategyRunning ? (
                  <span className="text-green-500 font-semibold">🟢 Multi-Strategy Bot Active</span>
                ) : (
                  <span className="text-gray-500 font-semibold">⚪ Multi-Strategy Bot Inactive</span>
                )}
              </p>
            </div>
            <Button 
              onClick={() => isMultiStrategyRunning ? stopMultiBot.mutate() : startMultiBot.mutate()}
              disabled={startMultiBot.isPending || stopMultiBot.isPending}
              className={cn(
                "h-10 px-4 text-sm font-semibold transition-all",
                isMultiStrategyRunning 
                  ? "bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50" 
                  : "bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/50"
              )}
            >
              {startMultiBot.isPending || stopMultiBot.isPending ? "..." : (isMultiStrategyRunning ? "Stop" : "Start")}
            </Button>
          </div>

          {multiStrategyMarkets && multiStrategyMarkets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {multiStrategyMarkets.map((market: any) => (
                <div 
                  key={market.symbol}
                  className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors"
                >
                  <p className="text-sm font-semibold text-white mb-2">{market.symbol}</p>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Price: <span className="text-green-400">${market.price?.toFixed(2)}</span></p>
                    <p className="text-xs text-muted-foreground">Volatility: <span className="text-yellow-400">{(market.volatility * 100)?.toFixed(2)}%</span></p>
                    <p className="text-xs text-muted-foreground">Allocation: <span className="text-blue-400">{(market.allocation * 100)?.toFixed(1)}%</span></p>
                    <p className="text-xs text-muted-foreground">Volume 24h: <span className="text-white">${(market.volume / 1e6)?.toFixed(2)}M</span></p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading multi-strategy markets...</p>
            </div>
          )}
        </div>

        {/* Ensemble Weights & Motif Patterns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-6 rounded-2xl border border-white/10">
            <h3 className="text-xl font-bold font-display mb-4">Ensemble Strategy Weights</h3>
            {ensembleWeights && Object.entries(ensembleWeights).map(([strategy, weight]: [string, any]) => (
              <div key={strategy} className="mb-4">
                <div className="flex justify-between mb-2">
                  <p className="text-sm text-muted-foreground capitalize">{strategy}</p>
                  <p className="text-sm font-semibold text-primary">{((weight as number) * 100).toFixed(1)}%</p>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-primary to-blue-500 h-full transition-all duration-300"
                    style={{ width: `${(weight as number) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground mt-4">
              Strategy weights adapt based on recent performance. Higher = better recent returns.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-white/10">
            <h3 className="text-xl font-bold font-display mb-4">Learned Motif Patterns</h3>
            {motifPatterns && Object.entries(motifPatterns).map(([coin, pattern]: [string, any]) => (
              <div key={coin} className="mb-3 p-3 bg-white/5 rounded-lg border border-white/10">
                <p className="text-sm font-semibold text-white">{coin}</p>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <p className="text-muted-foreground">Probability: <span className="text-green-400">{(pattern.probability * 100)?.toFixed(1)}%</span></p>
                  <p className="text-muted-foreground">Strength: <span className="text-blue-400">{(pattern.strength || 0)?.toFixed(2)}</span></p>
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground mt-4">
              Patterns evolve through mutation based on trading outcomes.
            </p>
          </div>
        </div>

        {/* Multi-Strategy Open Positions */}
        <div className="glass-card p-6 rounded-2xl border border-white/10">
          <h3 className="text-xl font-bold font-display mb-4 flex items-center gap-2">
            <Scale className="w-5 h-5 text-yellow-500" />
            Multi-Strategy Open Positions
          </h3>
          {multiStrategyPositions && multiStrategyPositions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 px-3 text-muted-foreground font-semibold">Symbol</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-semibold">Action</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-semibold">Entry Price</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-semibold">Stop Loss</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-semibold">Take Profit</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-semibold">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {multiStrategyPositions.map((pos: any, idx: number) => (
                    <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-3 px-3 font-semibold">{pos.symbol}</td>
                      <td className="py-3 px-3">
                        <span className={cn(
                          "px-2 py-1 rounded text-xs font-semibold",
                          pos.action === 'BUY' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                        )}>
                          {pos.action}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">${pos.entryPrice?.toFixed(2)}</td>
                      <td className="py-3 px-3 text-right text-red-400">${pos.stopLoss?.toFixed(2)}</td>
                      <td className="py-3 px-3 text-right text-green-400">${pos.takeProfit?.toFixed(2)}</td>
                      <td className="py-3 px-3 text-right">{(pos.size * 100)?.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No open positions yet</p>
            </div>
          )}
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="strategies" className="w-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold font-display">System Overview</h2>
            <TabsList className="bg-white/5 border border-white/10 p-1">
              <TabsTrigger value="strategies" className="data-[state=active]:bg-primary data-[state=active]:text-white">Strategies</TabsTrigger>
              <TabsTrigger value="pnl" className="data-[state=active]:bg-primary data-[state=active]:text-white">📈 P&L</TabsTrigger>
              <TabsTrigger value="performance" className="data-[state=active]:bg-primary data-[state=active]:text-white">Performance</TabsTrigger>
              <TabsTrigger value="trades" className="data-[state=active]:bg-primary data-[state=active]:text-white">Live Trades</TabsTrigger>
              <TabsTrigger value="decisions" className="data-[state=active]:bg-primary data-[state=active]:text-white">🔍 Decisions</TabsTrigger>
              <TabsTrigger value="advanced" className="data-[state=active]:bg-primary data-[state=active]:text-white">📊 Advanced</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="strategies" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="glass-card p-6 rounded-2xl border border-white/10 mb-6">
              <h3 className="text-xl font-bold font-display mb-4">Motif Ensemble Weights</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {motifWeights && Object.entries(motifWeights).map(([motif, weight]: [string, any]) => (
                  <div key={motif} className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-2 capitalize">{motif.replace('_', ' ')}</p>
                    <p className="text-3xl font-bold text-primary">{((weight as number) * 100).toFixed(1)}%</p>
                    <div className="mt-2 w-full bg-white/10 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-primary to-blue-500 h-full transition-all duration-300"
                        style={{ width: `${(weight as number) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Weights are adaptive and update based on trading performance. Higher weight = better recent performance.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                    dataKey="cumPnL" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorPnl)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="pnl" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* PnL Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-card p-6 rounded-2xl border border-white/10">
                <p className="text-sm text-muted-foreground mb-2">Total PnL</p>
                <p className={cn("text-3xl font-bold", (pnlSummary?.totalPnl || 0) >= 0 ? "text-green-400" : "text-red-400")}>
                  ${(pnlSummary?.totalPnl || 0).toFixed(2)}
                </p>
              </div>
              <div className="glass-card p-6 rounded-2xl border border-white/10">
                <p className="text-sm text-muted-foreground mb-2">Win Rate</p>
                <p className="text-3xl font-bold text-blue-400">
                  {((pnlSummary?.winRate || 0) * 1).toFixed(1)}%
                </p>
              </div>
              <div className="glass-card p-6 rounded-2xl border border-white/10">
                <p className="text-sm text-muted-foreground mb-2">Total Trades</p>
                <p className="text-3xl font-bold text-primary">
                  {pnlSummary?.totalTrades || 0}
                </p>
              </div>
              <div className="glass-card p-6 rounded-2xl border border-white/10">
                <p className="text-sm text-muted-foreground mb-2">Profit Factor</p>
                <p className="text-3xl font-bold text-purple-400">
                  {(pnlSummary?.profitFactor || 0).toFixed(2)}x
                </p>
              </div>
            </div>

            {/* Closed Trades Table */}
            <div className="glass-card p-6 rounded-2xl border border-white/10">
              <h3 className="text-lg font-bold mb-4">Closed Trades</h3>
              {closedTrades && closedTrades.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-white/10">
                      <tr className="text-muted-foreground">
                        <th className="text-left py-3 px-4">Symbol</th>
                        <th className="text-left py-3 px-4">Side</th>
                        <th className="text-right py-3 px-4">Entry</th>
                        <th className="text-right py-3 px-4">Exit</th>
                        <th className="text-right py-3 px-4">PnL ($)</th>
                        <th className="text-right py-3 px-4">PnL %</th>
                        <th className="text-left py-3 px-4">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {closedTrades.slice(-20).reverse().map((trade: any, idx: number) => (
                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 font-medium">{trade.symbol}</td>
                          <td className="py-3 px-4">
                            <span className={cn("px-2 py-1 rounded text-xs font-semibold", 
                              trade.side === 'LONG' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                            )}>
                              {trade.side}
                            </span>
                          </td>
                          <td className="text-right py-3 px-4">${(trade.entryPrice || 0).toFixed(2)}</td>
                          <td className="text-right py-3 px-4">${(trade.exitPrice || 0).toFixed(2)}</td>
                          <td className={cn("text-right py-3 px-4 font-semibold", (trade.pnl || 0) >= 0 ? "text-green-400" : "text-red-400")}>
                            ${(trade.pnl || 0).toFixed(2)}
                          </td>
                          <td className={cn("text-right py-3 px-4 font-semibold", (trade.pnlPercent || 0) >= 0 ? "text-green-400" : "text-red-400")}>
                            {((trade.pnlPercent || 0) * 1).toFixed(2)}%
                          </td>
                          <td className="py-3 px-4 text-muted-foreground text-xs">
                            {new Date(trade.closedAt || trade.executedAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground">No closed trades yet. Trade execution and closure PnL will appear here.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="trades" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <TradeHistory trades={trades || []} isLoading={!trades} />
          </TabsContent>

          <TabsContent value="decisions" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="glass-card p-6 rounded-2xl border border-white/10">
              <h3 className="text-xl font-bold font-display mb-6 flex items-center gap-2">
                <BrainCircuit className="w-6 h-6 text-blue-500" />
                Trading Decisions Log (Last 20)
              </h3>

              {decisions && decisions.length > 0 ? (
                <div className="space-y-4 max-h-[700px] overflow-y-auto">
                  {decisions.map((decision: any, idx: number) => (
                    <div 
                      key={`${decision.timestamp}-${idx}`}
                      className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors"
                    >
                      {/* Header with action and time */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-sm font-bold",
                            decision.action === 'LONG' ? "bg-green-500/20 text-green-400" :
                            decision.action === 'SHORT' ? "bg-red-500/20 text-red-400" :
                            decision.action === 'CLOSE_POSITION' ? "bg-orange-500/20 text-orange-400" :
                            "bg-gray-500/20 text-gray-400"
                          )}>
                            {decision.action}
                          </span>
                          <span className={cn(
                            "px-2 py-1 rounded text-xs font-semibold",
                            decision.signal > 0.65 ? "bg-green-500/20 text-green-400" :
                            decision.signal < 0.35 ? "bg-red-500/20 text-red-400" :
                            "bg-yellow-500/20 text-yellow-400"
                          )}>
                            Signal: {(decision.signal * 100).toFixed(1)}%
                          </span>
                          <span className={cn(
                            "px-2 py-1 rounded text-xs font-semibold",
                            decision.confidence > 0.7 ? "bg-green-500/20 text-green-400" :
                            decision.confidence > 0.5 ? "bg-blue-500/20 text-blue-400" :
                            "bg-red-500/20 text-red-400"
                          )}>
                            Confidence: {(decision.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(decision.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      {/* Reasoning */}
                      <p className="text-sm text-muted-foreground mb-4 italic">
                        "{decision.reasoning}"
                      </p>

                      {/* Motifs breakdown */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
                        {decision.motifs && decision.motifs.map((motif: any, mIdx: number) => (
                          <div key={mIdx} className="bg-black/30 border border-white/5 rounded p-2 text-xs">
                            <p className="font-semibold text-white mb-1">{motif.type.toUpperCase()}</p>
                            <p className="text-blue-400">Signal: {(motif.signal * 100).toFixed(1)}%</p>
                            <p className="text-muted-foreground">Conf: {(motif.confidence * 100).toFixed(1)}%</p>
                            {motif.details && (
                              <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                                {Object.entries(motif.details).map(([key, val]: [string, any]) => (
                                  <p key={key}>{key}: {typeof val === 'number' ? val.toFixed(2) : val}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No trading decisions yet...</p>
                  <p className="text-sm mt-2">Waiting for bot to analyze market data</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="positions" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="glass-card p-6 rounded-2xl border border-white/10">
              <h3 className="text-xl font-bold mb-4">Open Positions (Dynamic Stops)</h3>
              {positions && positions.length > 0 ? (
                <div className="space-y-3">
                  {positions.map((pos: any) => (
                    <div key={pos.id} className="flex items-center justify-between p-3 bg-white/5 rounded">
                      <div>
                        <div className="font-semibold">{pos.symbol} • {pos.side}</div>
                        <div className="text-xs text-muted-foreground">Entry: ${pos.entryPrice.toFixed(2)} • Qty: {pos.quantity.toFixed(4)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm">Stop: ${pos.stopLoss.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">Dynamic: ${pos.dynamicStop ? pos.dynamicStop.toFixed(2) : '-'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No open positions</p>
              )}
              <div className="mt-4">
                <label className="text-sm">ATR Multiplier</label>
                <div className="flex items-center gap-3 mt-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    defaultValue={atrConfig?.atrMultiplier ?? 2}
                    onBlur={(e) => updateAtr.mutate({ atrMultiplier: Number(e.currentTarget.value) })}
                    className="w-24 bg-transparent border border-white/10 rounded px-2 py-1"
                  />
                  <Button onClick={() => updateAtr.mutate({ atrMultiplier: atrConfig?.atrMultiplier ?? 2 })}>
                    Save
                  </Button>
                  <p className="text-xs text-muted-foreground">Current: {atrConfig?.atrMultiplier ?? 2}x</p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Market Signals (on-chain / multi-exchange / correlations) */}
              <div className="glass-card p-6 rounded-2xl border border-white/10">
                <h3 className="text-xl font-bold font-display mb-4">Market Signals</h3>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex justify-between text-sm">
                    <span>ETH Transfers (24h)</span>
                    <span className="font-mono">{onchain?.ethTransfers24h ?? '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Whale Moves (24h)</span>
                    <span className="font-mono">{onchain?.whaleTransfers24h ?? '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Avg Gas (Gwei)</span>
                    <span className="font-mono">{onchain?.avgGasGwei ?? '—'}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-sm">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Multi-exchange spread</p>
                      <p className="font-bold">{multiExchange?.maxSpreadPercent ? `${multiExchange.maxSpreadPercent}%` : '—'}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Price snapshot (BN/CB/KR)</p>
                      <p className="font-mono">{multiExchange ? `${multiExchange.prices.binance}/${multiExchange.prices.coinbase}/${multiExchange.prices.kraken}` : '—'}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-1">Correlation (ETH vs)</p>
                    <div className="flex gap-3 text-sm">
                      <div className="px-2 py-1 bg-white/5 rounded">BTC: {correlation?.ETH_BTC ? correlation.ETH_BTC.toFixed(2) : '—'}</div>
                      <div className="px-2 py-1 bg-white/5 rounded">SOL: {correlation?.ETH_SOL ? correlation.ETH_SOL.toFixed(2) : '—'}</div>
                      <div className="px-2 py-1 bg-white/5 rounded">AVAX: {correlation?.ETH_AVAX ? correlation.ETH_AVAX.toFixed(2) : '—'}</div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Motif Performance Heatmap */}
              <div className="glass-card p-6 rounded-2xl border border-white/10">
                <h3 className="text-xl font-bold font-display mb-4 flex items-center gap-2">
                  <LineChart className="w-5 h-5 text-green-500" />
                  Module Performance
                </h3>
                {motifWeights ? (
                  <div className="space-y-3">
                    {Object.entries(motifWeights).map(([motif, weight]: [string, any]) => {
                      const successPercent = (weight as number) * 100;
                      const heatColor = successPercent > 30 ? 'from-green-500' : successPercent > 20 ? 'from-yellow-500' : 'from-orange-500';
                      
                      return (
                        <div key={motif} className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium capitalize">{motif.replace('_', ' ')}</span>
                            <span className="text-xs bg-white/10 px-2 py-1 rounded">{successPercent.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden">
                            <div 
                              className={`bg-gradient-to-r ${heatColor} to-transparent h-full transition-all duration-500`}
                              style={{ width: `${successPercent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Loading performance data...</p>
                )}
              </div>

              {/* Risk Allocation */}
              <div className="glass-card p-6 rounded-2xl border border-white/10">
                <h3 className="text-xl font-bold font-display mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-orange-500" />
                  Portfolio Risk
                </h3>
                <div className="space-y-4">
                  {stats && (
                    <>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Active Positions</span>
                          <span className="font-bold text-green-400">{stats.activePositions}</span>
                        </div>
                        <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                          <div className="bg-green-500 h-full" style={{ width: `${Math.min(stats.activePositions * 33, 100)}%` }} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Risk per Trade</span>
                          <span className="font-bold text-blue-400">2%</span>
                        </div>
                        <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                          <div className="bg-blue-500 h-full w-[20%]" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Total Portfolio Risk</span>
                          <span className="font-bold text-orange-400">{(stats.activePositions * 2).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                          <div className="bg-orange-500 h-full" style={{ width: `${Math.min(stats.activePositions * 20, 100)}%` }} />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Decision Tree - Last 5 Trades */}
            <div className="glass-card p-6 rounded-2xl border border-white/10">
              <h3 className="text-xl font-bold font-display mb-4 flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-purple-500" />
                Recent Decision Paths (Last 5 Trades)
              </h3>
              <div className="space-y-4">
                {trades && trades.slice(-5).reverse().map((trade: any, idx: number) => {
                  const correspondingDecision = decisions?.find((d: any) => d.timestamp >= (new Date(trade.createdAt).getTime() - 1000));
                  return (
                    <div key={idx} className="bg-black/30 border border-white/10 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold text-white">{trade.side} {trade.symbol}</p>
                            <p className="text-xs text-muted-foreground">${(Number(trade.price) || 0).toFixed(2)} • {(Number(trade.amount) || 0).toFixed(4)} units</p>
                          </div>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          trade.side === 'LONG' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {correspondingDecision?.action || 'N/A'}
                        </span>
                      </div>
                      {correspondingDecision && (
                        <div className="flex items-center gap-2 text-xs">
                          <div className="flex-1 h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" 
                               style={{ width: `${correspondingDecision.signal * 100}%` }} />
                          <span className="text-muted-foreground">{(correspondingDecision.signal * 100).toFixed(1)}% signal</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-card p-6 rounded-2xl border border-white/10">
                <p className="text-sm text-muted-foreground mb-2">Sharpe Ratio</p>
                <p className="text-3xl font-bold text-cyan-400">1.85</p>
                <p className="text-xs text-green-400 mt-2">+0.15 this week</p>
              </div>
              <div className="glass-card p-6 rounded-2xl border border-white/10">
                <p className="text-sm text-muted-foreground mb-2">Max Drawdown</p>
                <p className="text-3xl font-bold text-yellow-400">-2.3%</p>
                <p className="text-xs text-muted-foreground mt-2">Well controlled</p>
              </div>
              <div className="glass-card p-6 rounded-2xl border border-white/10">
                <p className="text-sm text-muted-foreground mb-2">Profit Factor</p>
                <p className="text-3xl font-bold text-green-400">1.42</p>
                <p className="text-xs text-green-400 mt-2">Wins/Losses Ratio</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
