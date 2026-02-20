import { strategyEngine } from './strategy-engine';
import { binanceClient } from './binance-client';

export interface TradeBot {
  isRunning: boolean;
  symbol: string;
  interval: string;
  lastCheckTime: number;
  stats: {
    decisionsCount: number;
    tradesCount: number;
    successTradesCount: number;
  };
}

export class TradingBot {
  private isRunning: boolean = false;
  private symbol: string = 'ETHUSDT';
  private interval: string = '15m'; // 15 minute candles
  private checkInterval: number = 60000; // Check every 1 minute
  private lastCheckTime: number = 0;
  private tradingLoop: NodeJS.Timeout | null = null;
  private decisionsCount: number = 0;
  private tradesCount: number = 0;

  constructor(symbol: string = 'ETHUSDT') {
    this.symbol = symbol;
  }

  async start() {
    if (this.isRunning) {
      console.warn('[TradingBot] Bot is already running');
      return;
    }

    this.isRunning = true;
    console.log(`[TradingBot] ========== STARTING TRADING BOT FOR ${this.symbol} ==========`);
    console.log(`[TradingBot] Interval: ${this.interval}, Check every: ${this.checkInterval}ms`);

    // Initial check
    console.log('[TradingBot] Running initial trading cycle...');
    await this.executeTradingCycle();

    // Set up interval
    this.tradingLoop = setInterval(() => {
      this.executeTradingCycle().catch(error => {
        console.error('[TradingBot] Error in trading cycle:', error);
      });
    }, this.checkInterval);

    console.log(`[TradingBot] ========== BOT STARTED SUCCESSFULLY ==========`);
  }

  async stop() {
    if (!this.isRunning) {
      console.warn('[TradingBot] Bot is not running');
      return;
    }

    this.isRunning = false;
    if (this.tradingLoop) {
      clearInterval(this.tradingLoop);
      this.tradingLoop = null;
    }

    // Close all open positions
    const positions = strategyEngine.getOpenPositions();
    for (const position of positions) {
      const currentPrice = await binanceClient.getCurrentPrice(this.symbol);
      if (currentPrice) {
        strategyEngine.recordTradeOutcome(position.symbol, currentPrice, 'trend');
      }
    }

    console.log(`[TradingBot] Stopped trading bot for ${this.symbol}`);
  }

  private async executeTradingCycle() {
    try {
      const now = Date.now();
      this.lastCheckTime = now;
      console.log(`[TradingBot] === CYCLE ${this.decisionsCount + 1} ===`);

      // Analyze market
      const decision = await strategyEngine.analyzeAndDecide(this.symbol);
      if (!decision) {
        console.log('[TradingBot] No decision returned');
        return;
      }

      this.decisionsCount++;
      console.log(`[TradingBot] Decision: action=${decision.action}, signal=${decision.signal.toFixed(3)}, confidence=${decision.confidence.toFixed(3)}`);

      // Get market data for execution
      const { marketDataFetcher } = await import('./market-data');
      const marketData = await marketDataFetcher.fetchMarketData(this.symbol, this.interval);
      if (!marketData) {
        console.log('[TradingBot] No market data available');
        return;
      }

      console.log(`[TradingBot] Market data: price=${marketData.currentPrice}`);

      // Check positions and updates
      const positions = strategyEngine.getOpenPositions();
      for (const position of positions) {
        // Check profit-taking levels (0.5% or 1%)
        const profitTarget = strategyEngine.checkProfitTargets(
          `${position.symbol}_${position.createdAt}`,
          marketData.currentPrice
        );
        
        if (profitTarget.shouldClose) {
          console.log(`[TradingBot] 💰 PROFIT TARGET HIT: ${profitTarget.level} - Closing position`);
          strategyEngine.recordTradeOutcome(position.symbol, marketData.currentPrice, 'momentum');
        } else {
          // Regular update (stops, checks)
          strategyEngine.recordTradeOutcome(position.symbol, marketData.currentPrice, 'trend');
        }
      }

      // Execute if signal is strong enough
      console.log(`[TradingBot] Checking execution conditions: action=${decision.action}, signal=${decision.signal}, confidence=${decision.confidence}`);
      // Require HIGHER confidence and CLEARER signal separation for better win rate
      const strongSignal = (decision.action === 'LONG' && decision.signal > 0.55) || (decision.action === 'SHORT' && decision.signal < 0.45);
      if (decision.action !== 'NEUTRAL' && decision.confidence > 0.60 && strongSignal) {
        console.log('[TradingBot] EXECUTING TRADE');
        const execution = strategyEngine.executeDecision(decision, marketData);
        if (execution) {
          this.tradesCount++;
          console.log(`[TradingBot] Trade execution created, quantity=${execution.quantity}`);

          // Place actual order on Binance (REAL TRADING)
          await this.placeActualOrder(execution);
        } else {
          console.log('[TradingBot] executeDecision returned null');
        }
      } else {
        console.log(`[TradingBot] Execution skipped: action=${decision.action}, confidence=${decision.confidence} (need >0.60 and strong signal)`);
      }

      // Update learning
      strategyEngine.updateMotifWeights();
      console.log('[TradingBot] === CYCLE END ===');
    } catch (error) {
      console.error('[TradingBot] Error in trading cycle:', error);
    }
  }

  private async placeActualOrder(execution: any) {
    try {
      const orderSide = execution.side === 'LONG' ? 'BUY' : 'SELL';
      const order = await binanceClient.placeLimitOrder(
        execution.symbol,
        orderSide,
        execution.quantity,
        execution.entryPrice
      );

      if (order) {
        console.log(`[TradingBot] Order placed on Binance:`, order);
      }
    } catch (error) {
      console.error('[TradingBot] Error placing order on Binance:', error);
    }
  }

  getStatus(): TradeBot {
    return {
      isRunning: this.isRunning,
      symbol: this.symbol,
      interval: this.interval,
      lastCheckTime: this.lastCheckTime,
      stats: {
        decisionsCount: this.decisionsCount,
        tradesCount: this.tradesCount,
        successTradesCount: strategyEngine.getMetrics().winRate,
      },
    };
  }

  getStatistics() {
    return {
      symbol: this.symbol,
      isRunning: this.isRunning,
      decisions: strategyEngine.getRecentDecisions(10),
      trades: strategyEngine.getTrades(20),
      accountState: strategyEngine.getAccountState(),
      metrics: strategyEngine.getMetrics(),
      learningStats: strategyEngine.getLearningStats(),
      motifWeights: strategyEngine.getMotifWeights(),
    };
  }

  setSymbol(symbol: string) {
    this.symbol = symbol;
    console.log(`[TradingBot] Symbol changed to ${symbol}`);
  }

  setInterval(interval: string) {
    this.interval = interval;
    console.log(`[TradingBot] Interval changed to ${interval}`);
  }

  setCheckInterval(intervalMs: number) {
    this.checkInterval = intervalMs;
    console.log(`[TradingBot] Check interval changed to ${intervalMs}ms`);
  }
}

export const tradingBot = new TradingBot('ETHUSDT');
