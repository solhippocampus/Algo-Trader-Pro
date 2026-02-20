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
