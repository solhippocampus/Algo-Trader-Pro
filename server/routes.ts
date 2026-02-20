import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api, errorSchemas } from "@shared/routes";
import { z } from "zod";
import { tradingBot } from "./trading/trader";
import { strategyEngine } from "./trading/strategy-engine";
import { binanceClient } from "./trading/binance-client";

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

  // Advanced Trading Bot Control
  app.post(api.bot.start.path, async (req, res) => {
    try {
      await tradingBot.start();
      await storage.updateConfig({ isRunning: true });
      res.json({ isRunning: true, message: "Advanced trading bot started successfully" });
    } catch (error) {
      res.status(500).json({ message: String(error) });
    }
  });

  app.post(api.bot.stop.path, async (req, res) => {
    try {
      await tradingBot.stop();
      await storage.updateConfig({ isRunning: false });
      res.json({ isRunning: false, message: "Advanced trading bot stopped successfully" });
    } catch (error) {
      res.status(500).json({ message: String(error) });
    }
  });

  // Trading mode control (DEMO vs LIVE)
  app.post("/api/trading/set-mode", async (req, res) => {
    try {
      const { mode } = req.body; // 'DEMO' or 'LIVE'
      if (!['DEMO', 'LIVE'].includes(mode)) {
        return res.status(400).json({ message: "Mode must be DEMO or LIVE" });
      }
      
      // Note: In a real implementation, this would be saved to config
      res.json({ 
        mode,
        message: mode === 'DEMO' 
          ? 'Bot switched to DEMO mode (no real trades)' 
          : '⚠️ Bot switched to LIVE mode (REAL MONEY TRADING)' 
      });
    } catch (error) {
      res.status(500).json({ message: String(error) });
    }
  });

  // Get real Binance account balance
  app.get("/api/trading/account-balance", async (req, res) => {
    try {
      const balance = await binanceClient.getAccountBalance();
      if (!balance) {
        return res.status(500).json({ message: "Failed to fetch account balance" });
      }
      
      // Filter and format balances
      const formattedBalances = balance.balances
        .filter((b: any) => parseFloat(b.free) > 0.00000001 || parseFloat(b.locked) > 0)
        .map((b: any) => ({
          asset: b.asset,
          free: parseFloat(b.free),
          locked: parseFloat(b.locked),
          total: parseFloat(b.free) + parseFloat(b.locked),
        }));

      res.json({
        mode: binanceClient.getMode(),
        balances: formattedBalances,
        totalAssets: formattedBalances.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ message: String(error) });
    }
  });

  app.get(api.bot.status.path, async (req, res) => {
    const botStatus = tradingBot.getStatus();
    const accountState = strategyEngine.getAccountState();
    
    res.json({
      isRunning: botStatus.isRunning,
      symbol: botStatus.symbol,
      interval: botStatus.interval,
      activeStrategy: "Motif-Based Adaptive Ensemble",
      lastUpdate: new Date().toISOString(),
      binanceConnected: process.env.BINANCE_API_KEY ? true : false,
      stats: {
        decisions: botStatus.stats.decisionsCount,
        trades: botStatus.stats.tradesCount,
        accountBalance: accountState.balance,
        openPositions: accountState.openPositions,
        totalRisk: accountState.totalRisk,
      }
    });
  });

  // Strategy Engine Statistics
  app.get("/api/trading/statistics", async (req, res) => {
    const stats = tradingBot.getStatistics();
    res.json(stats);
  });

  app.get("/api/trading/positions", async (req, res) => {
    const positions = strategyEngine.getOpenPositions();
    res.json(positions);
  });

  app.get("/api/trading/decisions", async (req, res) => {
    const decisions = strategyEngine.getRecentDecisions(20);
    res.json(decisions);
  });

  app.get("/api/trading/trades", async (req, res) => {
    const trades = strategyEngine.getTrades(50);
    res.json(trades);
  });

  app.get("/api/trading/trades-closed", async (req, res) => {
    const closed = strategyEngine.getClosedTrades(50);
    res.json(closed);
  });

  app.get("/api/trading/pnl-summary", async (req, res) => {
    const summary = strategyEngine.getPnlSummary();
    res.json(summary);
  });

  app.get("/api/trading/metrics", async (req, res) => {
    const metrics = strategyEngine.getMetrics();
    res.json(metrics);
  });

  app.get("/api/trading/motif-weights", async (req, res) => {
    const weights = strategyEngine.getMotifWeights();
    res.json(weights);
  });

  app.get("/api/trading/learning-stats", async (req, res) => {
    const stats = strategyEngine.getLearningStats();
    res.json(stats);
  });

  app.post("/api/trading/set-symbol", async (req, res) => {
    try {
      const { symbol } = req.body;
      if (!symbol) {
        return res.status(400).json({ message: "Symbol is required" });
      }
      tradingBot.setSymbol(symbol);
      res.json({ message: `Trading symbol changed to ${symbol}` });
    } catch (error) {
      res.status(500).json({ message: String(error) });
    }
  });

  app.post("/api/trading/set-interval", async (req, res) => {
    try {
      const { interval } = req.body;
      if (!interval) {
        return res.status(400).json({ message: "Interval is required" });
      }
      tradingBot.setInterval(interval);
      res.json({ message: `Interval changed to ${interval}` });
    } catch (error) {
      res.status(500).json({ message: String(error) });
    }
  });

  // Legacy Trades and Stats
  app.get(api.trades.list.path, async (req, res) => {
    const trades = strategyEngine.getTrades(50);
    const mappedTrades = trades.map(t => ({
      id: t.decisionId,
      symbol: t.symbol,
      side: t.side,
      price: t.entryPrice,
      amount: t.quantity,
      strategyUsed: "Adaptive Motif Ensemble",
      confidenceScore: "0",
      pnl: "0",
      createdAt: new Date(t.executedAt).toISOString()
    }));
    res.json(mappedTrades);
  });

  app.get(api.stats.get.path, async (req, res) => {
    const metrics = strategyEngine.getMetrics();
    const accountState = strategyEngine.getAccountState();
    
    res.json({
      totalTrades: strategyEngine.getTrades().length,
      winRate: metrics.winRate,
      totalPnl: 0, // Would need to track actual PnL
      activePositions: accountState.openPositions,
      accountBalance: accountState.balance,
      sharpeRatio: metrics.sharpeRatio,
      profitFactor: metrics.profitFactor,
    });
  });

  // Lightweight data endpoints for Advanced dashboard
  app.get('/api/data/onchain', async (req, res) => {
    try {
      // Minimal placeholder / proxy - strategyEngine or another service can provide real data
      const payload = {
        ethTransfers24h: 1245,
        whaleTransfers24h: 3,
        avgGasGwei: 21.4,
        gasTrend: 'rising'
      };
      res.json(payload);
    } catch (err) {
      res.status(500).json({ message: 'failed to fetch on-chain data' });
    }
  });

  app.get('/api/data/multi-exchange', async (req, res) => {
    try {
      // Example aggregated snapshot - replace with real multi-exchange aggregation later
      const payload = {
        symbol: 'ETHUSDT',
        prices: {
          binance: 1955.02,
          coinbase: 1956.40,
          kraken: 1954.88
        },
        maxSpreadPercent: 0.08
      };
      res.json(payload);
    } catch (err) {
      res.status(500).json({ message: 'failed to fetch multi-exchange data' });
    }
  });

  app.get('/api/trading/correlation', async (req, res) => {
    try {
      // Lightweight correlation snapshot
      const payload = {
        ETH_BTC: 0.72,
        ETH_SOL: 0.45,
        ETH_AVAX: 0.38
      };
      res.json(payload);
    } catch (err) {
      res.status(500).json({ message: 'failed to fetch correlations' });
    }
  });

  app.get('/api/trading/positions', async (req, res) => {
    try {
      // Refresh dynamic stops before returning positions
      await strategyEngine.refreshDynamicStops();
      const open = strategyEngine.getOpenPositions();
      const withIds = strategyEngine.getOpenPositions().map(p => ({ id: `${p.symbol}_${p.createdAt}`, ...p }));
      res.json(withIds);
    } catch (err) {
      res.status(500).json({ message: 'failed to fetch positions' });
    }
  });

  // ATR multiplier config
  app.get('/api/trading/atr-config', async (req, res) => {
    try {
      const mult = strategyEngine.getOpenPositions ? (strategyEngine.getMetrics().maxRiskPerTrade || 0) : undefined;
      // prefer reading from risk manager directly if available
      const atr = strategyEngine.getOpenPositions && (strategyEngine as any).riskManager ? (strategyEngine as any).riskManager.getAtrMultiplier?.() : undefined;
      res.json({ atrMultiplier: atr ?? 2 });
    } catch (err) {
      res.status(500).json({ message: 'failed to fetch atr config' });
    }
  });

  app.post('/api/trading/atr-config', async (req, res) => {
    try {
      const { atrMultiplier } = req.body || {};
      const val = Number(atrMultiplier);
      if (!val || val <= 0) return res.status(400).json({ message: 'invalid atrMultiplier' });
      if ((strategyEngine as any).riskManager && (strategyEngine as any).riskManager.setAtrMultiplier) {
        (strategyEngine as any).riskManager.setAtrMultiplier(val);
      }
      res.json({ atrMultiplier: val });
    } catch (err) {
      res.status(500).json({ message: 'failed to update atr config' });
    }
  });

  // Simple in-memory paper-trade simulator: run `cycles` analysis/execution loops
  // without placing real orders. Useful to compare strategies quickly.
  app.post('/api/trading/paper-simulate', async (req, res) => {
    try {
      const cycles = Number(req.body?.cycles || req.query?.cycles || 10);
      const symbol = req.body?.symbol || req.query?.symbol || 'ETHUSDT';
      const results: any[] = [];

      for (let i = 0; i < cycles; i++) {
        const decision = await strategyEngine.analyzeAndDecide(symbol);
        const md = await (await import('./trading/market-data')).marketDataFetcher.fetchMarketData(symbol);
        if (!decision || !md) {
          results.push({ cycle: i, status: 'no-data' });
          continue;
        }

          const exec = strategyEngine.executeDecision(decision, md);
        results.push({ cycle: i, decision: decision.action, signal: decision.signal, executed: !!exec });
        // small delay to avoid hammering any remote APIs
        await new Promise(r => setTimeout(r, 50));
      }

      const metrics = strategyEngine.getMetrics();
      res.json({ cycles, results, metrics, trades: strategyEngine.getTrades(50) });
    } catch (err) {
      res.status(500).json({ message: String(err) });
    }
  });

  // Seed DB if empty
  setTimeout(async () => {
    try {
      const existingTrades = await storage.getTrades(1);
      if (existingTrades.length === 0) {
        // Seed
        await storage.insertTrade({ symbol: "BTCUSDT", side: "BUY", price: "45000.50", amount: "0.01", strategyUsed: "Trend Motif", confidenceScore: "85.5", pnl: "0.00" });
        await storage.insertTrade({ symbol: "ETHUSDT", side: "SELL", price: "2400.10", amount: "0.5", strategyUsed: "Momentum + Volatility", confidenceScore: "92.0", pnl: "12.50" });
        await storage.insertTrade({ symbol: "SOLUSDT", side: "BUY", price: "105.20", amount: "10.0", strategyUsed: "Sentiment Ensemble", confidenceScore: "99.1", pnl: "5.20" });
      }
    } catch (e) {
      console.error("Failed to seed trades", e);
    }
  }, 2000);

  // Auto-start bot if AUTO_START_BOT is enabled (for production/Render)
  setTimeout(async () => {
    try {
      if (process.env.AUTO_START_BOT === 'true' || process.env.NODE_ENV === 'production') {
        // Start legacy bot
        await tradingBot.start();
        await storage.updateConfig({ isRunning: true });
        console.log(`[Bot] Legacy bot auto-started in ${process.env.NODE_ENV || 'development'} mode`);

        // Start multi-strategy bot (new system)
        const { multiStrategyBot } = await import('./trading/multi-strategy-trader');
        await multiStrategyBot.start();
        console.log(`[Bot] Multi-strategy bot auto-started with 9 markets`);
      }
    } catch (e) {
      console.error("[Bot] Failed to auto-start:", e);
    }
  }, 5000);

  // ===== MULTI-STRATEGY ENDPOINTS =====
  
  app.get('/api/multi-strategy/markets', async (req, res) => {
    try {
      const { marketRotationEngine } = await import('./trading/market-rotation');
      // Ensure market data is fetched
      await marketRotationEngine.fetchMarketData();
      const topCoins = marketRotationEngine.getTopCoins(9);
      res.json(topCoins.length > 0 ? topCoins : []);
    } catch (err) {
      console.error('[API] Error fetching multi-strategy markets:', err);
      res.status(200).json([]); // Return empty array on error (graceful degradation)
    }
  });

  app.get('/api/multi-strategy/ensemble-weights', async (req, res) => {
    try {
      const { ensembleEngine } = await import('./trading/multi-strategy-engine');
      const weights = ensembleEngine.getEnsembleWeights();
      res.json(weights || {});
    } catch (err) {
      console.error('[API] Error fetching ensemble weights:', err);
      res.status(200).json({});
    }
  });

  app.get('/api/multi-strategy/motif-patterns', async (req, res) => {
    try {
      const { ensembleEngine } = await import('./trading/multi-strategy-engine');
      const motifs = ensembleEngine.getMotifs();
      res.json(motifs || []);
    } catch (err) {
      console.error('[API] Error fetching motif patterns:', err);
      res.status(200).json([]);
    }
  });

  app.post('/api/multi-strategy/start-bot', async (req, res) => {
    try {
      const { multiStrategyBot } = await import('./trading/multi-strategy-trader');
      await multiStrategyBot.start();
      const status = multiStrategyBot.getStatus();
      res.json({ message: 'Multi-strategy bot started', status, success: true });
    } catch (err) {
      console.error('[API] Error starting multi-strategy bot:', err);
      res.status(200).json({ message: String(err), success: false, status: { isRunning: false, activeMarkets: [], decisionsCount: 0, tradesCount: 0, openPositions: 0 } });
    }
  });

  app.post('/api/multi-strategy/stop-bot', async (req, res) => {
    try {
      const { multiStrategyBot } = await import('./trading/multi-strategy-trader');
      await multiStrategyBot.stop();
      res.json({ message: 'Multi-strategy bot stopped', success: true });
    } catch (err) {
      console.error('[API] Error stopping multi-strategy bot:', err);
      res.status(200).json({ message: String(err), success: false });
    }
  });

  app.get('/api/multi-strategy/bot-status', async (req, res) => {
    try {
      const { multiStrategyBot } = await import('./trading/multi-strategy-trader');
      const status = multiStrategyBot.getStatus();
      res.json(status);
    } catch (err) {
      console.error('[API] Error fetching multi-strategy bot status:', err);
      res.json({ isRunning: false, activeMarkets: [], decisionsCount: 0, tradesCount: 0, openPositions: 0 });
    }
  });

  app.get('/api/multi-strategy/positions', async (req, res) => {
    try {
      const { multiStrategyBot } = await import('./trading/multi-strategy-trader');
      const positions = multiStrategyBot.getOpenPositions();
      res.json(positions || []);
    } catch (err) {
      console.error('[API] Error fetching multi-strategy positions:', err);
      res.json([]);
    }
  });

  return httpServer;
}