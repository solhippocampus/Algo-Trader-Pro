import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useBotStatus() {
  return useQuery({
    queryKey: [api.bot.status.path],
    queryFn: async () => {
      const res = await fetch(api.bot.status.path);
      if (!res.ok) throw new Error("Failed to fetch bot status");
      return api.bot.status.responses[200].parse(await res.json());
    },
    refetchInterval: 3000, // Poll every 3s for live status
  });
}

export function useBotControl() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const startBot = useMutation({
    mutationFn: async () => {
      const res = await fetch(api.bot.start.path, { method: api.bot.start.method });
      if (!res.ok) throw new Error("Failed to start bot");
      return api.bot.start.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.bot.status.path] });
      toast({ title: "Bot Started", description: data.message, className: "border-green-500/50 text-green-500" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const stopBot = useMutation({
    mutationFn: async () => {
      const res = await fetch(api.bot.stop.path, { method: api.bot.stop.method });
      if (!res.ok) throw new Error("Failed to stop bot");
      return api.bot.stop.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.bot.status.path] });
      toast({ title: "Bot Stopped", description: data.message, className: "border-yellow-500/50 text-yellow-500" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  return { startBot, stopBot };
}

export function useStats() {
  return useQuery({
    queryKey: [api.stats.get.path],
    queryFn: async () => {
      const res = await fetch(api.stats.get.path);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return api.stats.get.responses[200].parse(await res.json());
    },
    refetchInterval: 5000,
  });
}

export function useTrades() {
  return useQuery({
    queryKey: [api.trades.list.path],
    queryFn: async () => {
      const res = await fetch(api.trades.list.path);
      if (!res.ok) throw new Error("Failed to fetch trades");
      return api.trades.list.responses[200].parse(await res.json());
    },
    refetchInterval: 5000,
  });
}

export function useTradesClosed() {
  return useQuery({
    queryKey: ["/api/trading/trades-closed"],
    queryFn: async () => {
      const res = await fetch("/api/trading/trades-closed");
      if (!res.ok) throw new Error("Failed to fetch closed trades");
      return await res.json();
    },
    refetchInterval: 10000, // Update every 10s for closed trades
  });
}

export function usePnlSummary() {
  return useQuery({
    queryKey: ["/api/trading/pnl-summary"],
    queryFn: async () => {
      const res = await fetch("/api/trading/pnl-summary");
      if (!res.ok) throw new Error("Failed to fetch PnL summary");
      return await res.json();
    },
    refetchInterval: 10000, // Update every 10s for PnL metrics
  });
}

export function useConfig() {
  return useQuery({
    queryKey: [api.config.get.path],
    queryFn: async () => {
      const res = await fetch(api.config.get.path);
      if (!res.ok) throw new Error("Failed to fetch config");
      return api.config.get.responses[200].parse(await res.json());
    },
  });
}

export function useUpdateConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (updates: Partial<any>) => { // Using Partial<any> to simplify hook signature, validated by zod below
      const validated = api.config.update.input.parse(updates);
      const res = await fetch(api.config.update.path, {
        method: api.config.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
      if (!res.ok) {
        if (res.status === 400) {
           const error = api.config.update.responses[400].parse(await res.json());
           throw new Error(error.message);
        }
        throw new Error("Failed to update config");
      }
      return api.config.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.config.get.path] });
      toast({ title: "Configuration Updated", description: "Bot settings have been saved." });
    },
    onError: (error) => {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    }
  });
}

export function useAccountBalance() {
  return useQuery({
    queryKey: ["/api/trading/account-balance"],
    queryFn: async () => {
      const res = await fetch("/api/trading/account-balance");
      if (!res.ok) throw new Error("Failed to fetch account balance");
      const data = await res.json();
      return {
        mode: data.mode || "DEMO",
        balances: data.balances || [],
        totalAssets: data.totalAssets || 0,
        timestamp: data.timestamp || new Date().toISOString(),
      };
    },
    refetchInterval: 10000, // Update every 10s
  });
}

export function useDecisions() {
  return useQuery({
    queryKey: ["/api/trading/decisions"],
    queryFn: async () => {
      const res = await fetch("/api/trading/decisions");
      if (!res.ok) throw new Error("Failed to fetch decisions");
      const data = await res.json();
      // API returns array directly, not wrapped in { value: [] }
      return Array.isArray(data) ? data : (data.value || []);
    },
    refetchInterval: 5000, // Update every 5s for live decisions
  });
}

export function useMotifWeights() {
  return useQuery({
    queryKey: ["/api/trading/motif-weights"],
    queryFn: async () => {
      const res = await fetch("/api/trading/motif-weights");
      if (!res.ok) throw new Error("Failed to fetch motif weights");
      return await res.json();
    },
    refetchInterval: 10000, // Update every 10s
  });
}

export function useOnChain() {
  return useQuery({
    queryKey: ['/api/data/onchain'],
    queryFn: async () => {
      const res = await fetch('/api/data/onchain');
      if (!res.ok) throw new Error('Failed to fetch on-chain data');
      return await res.json();
    },
    refetchInterval: 30000,
  });
}

export function useMultiExchange() {
  return useQuery({
    queryKey: ['/api/data/multi-exchange'],
    queryFn: async () => {
      const res = await fetch('/api/data/multi-exchange');
      if (!res.ok) throw new Error('Failed to fetch multi-exchange data');
      return await res.json();
    },
    refetchInterval: 15000,
  });
}

export function useCorrelation() {
  return useQuery({
    queryKey: ['/api/trading/correlation'],
    queryFn: async () => {
      const res = await fetch('/api/trading/correlation');
      if (!res.ok) throw new Error('Failed to fetch correlation data');
      return await res.json();
    },
    refetchInterval: 30000,
  });
}

export function usePositions() {
  return useQuery({
    queryKey: ['/api/trading/positions'],
    queryFn: async () => {
      const res = await fetch('/api/trading/positions');
      if (!res.ok) throw new Error('Failed to fetch positions');
      return await res.json();
    },
    refetchInterval: 5000,
  });
}

export function useAtrConfig() {
  return useQuery({
    queryKey: ['/api/trading/atr-config'],
    queryFn: async () => {
      const res = await fetch('/api/trading/atr-config');
      if (!res.ok) throw new Error('Failed to fetch ATR config');
      return await res.json();
    },
    refetchInterval: 15000,
  });
}

export function useUpdateAtrConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: { atrMultiplier: number }) => {
      const res = await fetch('/api/trading/atr-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to update ATR config');
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/trading/atr-config'] });
      toast({ title: 'ATR updated', description: `ATR multiplier set to ${data.atrMultiplier}` });
    },
    onError: (err) => {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    }
  });
}

// ===== MULTI-STRATEGY HOOKS =====

export function useMultiStrategyMarkets() {
  return useQuery({
    queryKey: ['/api/multi-strategy/markets'],
    queryFn: async () => {
      const res = await fetch('/api/multi-strategy/markets');
      if (!res.ok) throw new Error('Failed to fetch markets');
      return await res.json();
    },
    refetchInterval: 30000, // Update every 30s
  });
}

export function useEnsembleWeights() {
  return useQuery({
    queryKey: ['/api/multi-strategy/ensemble-weights'],
    queryFn: async () => {
      const res = await fetch('/api/multi-strategy/ensemble-weights');
      if (!res.ok) throw new Error('Failed to fetch ensemble weights');
      return await res.json();
    },
    refetchInterval: 10000,
  });
}

export function useMotifPatterns() {
  return useQuery({
    queryKey: ['/api/multi-strategy/motif-patterns'],
    queryFn: async () => {
      const res = await fetch('/api/multi-strategy/motif-patterns');
      if (!res.ok) throw new Error('Failed to fetch motif patterns');
      return await res.json();
    },
    refetchInterval: 15000,
  });
}

export function useMultiStrategyBotControl() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const startMultiBot = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/multi-strategy/start-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) throw new Error('Failed to start multi-strategy bot');
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/multi-strategy/bot-status'] });
      toast({ title: 'Multi-Strategy Bot Started', description: `Markets: ${data.status.activeMarkets.join(', ')}`, className: 'border-green-500/50' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const stopMultiBot = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/multi-strategy/stop-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) throw new Error('Failed to stop multi-strategy bot');
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/multi-strategy/bot-status'] });
      toast({ title: 'Multi-Strategy Bot Stopped', className: 'border-yellow-500/50' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  return { startMultiBot, stopMultiBot };
}

export function useMultiStrategyBotStatus() {
  return useQuery({
    queryKey: ['/api/multi-strategy/bot-status'],
    queryFn: async () => {
      const res = await fetch('/api/multi-strategy/bot-status');
      if (!res.ok) throw new Error('Failed to fetch bot status');
      return await res.json();
    },
    refetchInterval: 3000,
  });
}

export function useMultiStrategyPositions() {
  return useQuery({
    queryKey: ['/api/multi-strategy/positions'],
    queryFn: async () => {
      const res = await fetch('/api/multi-strategy/positions');
      if (!res.ok) throw new Error('Failed to fetch positions');
      return await res.json();
    },
    refetchInterval: 5000,
  });
}

