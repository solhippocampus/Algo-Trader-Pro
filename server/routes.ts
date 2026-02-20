import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api, errorSchemas } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Config
  app.get(api.config.get.path, async (req, res) => {
    const config = await storage.getConfig();
    res.json(config);
  });

  app.patch(api.config.update.path, async (req, res) => {
    try {
      // Validate with zod
      const inputSchema = z.object({
        isRunning: z.boolean().optional(),
        apiEnabled: z.boolean().optional(),
        maxPositionSize: z.string().optional(),
        stopLossPercentage: z.string().optional(),
        strategyWeights: z.any().optional(),
      });
      const input = inputSchema.parse(req.body);
      const updated = await storage.updateConfig(input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Bot Control
  app.post(api.bot.start.path, async (req, res) => {
    await storage.updateConfig({ isRunning: true });
    res.json({ isRunning: true, message: "Bot started successfully" });
  });

  app.post(api.bot.stop.path, async (req, res) => {
    await storage.updateConfig({ isRunning: false });
    res.json({ isRunning: false, message: "Bot stopped successfully" });
  });

  app.get(api.bot.status.path, async (req, res) => {
    const config = await storage.getConfig();
    res.json({
      isRunning: config.isRunning,
      activeStrategy: config.isRunning ? "Reinforcement Learning (Exploitation)" : null,
      lastUpdate: new Date().toISOString(),
      binanceConnected: config.apiEnabled
    });
  });

  // Trades and Stats
  app.get(api.trades.list.path, async (req, res) => {
    const tradesList = await storage.getTrades(50);
    res.json(tradesList);
  });

  app.get(api.stats.get.path, async (req, res) => {
    const stats = await storage.getStats();
    res.json(stats);
  });

  // Seed DB if empty
  setTimeout(async () => {
    try {
      const existingTrades = await storage.getTrades(1);
      if (existingTrades.length === 0) {
        // Seed
        await storage.insertTrade({ symbol: "BTCUSDT", side: "BUY", price: "45000.50", amount: "0.01", strategyUsed: "Momentum", confidenceScore: "85.5", pnl: "0.00" });
        await storage.insertTrade({ symbol: "ETHUSDT", side: "SELL", price: "2400.10", amount: "0.5", strategyUsed: "Bayes + Monte Carlo", confidenceScore: "92.0", pnl: "12.50" });
        await storage.insertTrade({ symbol: "SOLUSDT", side: "BUY", price: "105.20", amount: "10.0", strategyUsed: "Arbitrage", confidenceScore: "99.1", pnl: "5.20" });
      }
    } catch (e) {
      console.error("Failed to seed trades", e);
    }
  }, 2000);

  // Background mock trading engine
  setInterval(async () => {
    try {
      const config = await storage.getConfig();
      if (!config.isRunning) return;

      // Simulate a trade
      const strategies = ["Market Making", "Arbitrage", "Momentum", "Bayes + Monte Carlo", "Reinforcement Learning"];
      const strategy = strategies[Math.floor(Math.random() * strategies.length)];
      const side = Math.random() > 0.5 ? "BUY" : "SELL";
      const price = (Math.random() * 50000 + 20000).toFixed(2);
      const amount = (Math.random() * 2 + 0.01).toFixed(4);
      const confidence = Math.random() * 30 + 70; // 70-100%
      const pnl = side === "SELL" ? ((Math.random() * 100) - 40).toFixed(2) : "0.00"; // Random PnL for sells

      await storage.insertTrade({
        symbol: "BTCUSDT",
        side,
        price,
        amount,
        strategyUsed: strategy,
        confidenceScore: confidence.toFixed(2),
        pnl: pnl
      });
    } catch (e) {
      console.error("Bot engine error:", e);
    }
  }, 10000); // Create a trade every 10 seconds if running

  return httpServer;
}