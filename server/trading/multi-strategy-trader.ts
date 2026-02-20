import { ensembleEngine, MARKETS, StrategySignal } from './multi-strategy-engine';
import { marketRotationEngine } from './market-rotation';
import { dynamicRiskManager } from './dynamic-risk-manager';
import { binanceClient } from './binance-client';
import { marketDataFetcher } from './market-data';

export interface MultiStrategyBotConfig {
  activeMarkets: string[];
  checkInterval: number;
  maxConcurrentPositions: number;
}

export class MultiStrategyTradingBot {
  private isRunning: boolean = false;
  private config: MultiStrategyBotConfig;
  private tradingLoop: NodeJS.Timeout | null = null;
  private decisionsCount: number = 0;
  private tradesCount: number = 0;
  private openPositions: Map<string, any> = new Map();

  constructor(config: Partial<MultiStrategyBotConfig> = {}) {
    this.config = {
      activeMarkets: config.activeMarkets || MARKETS,
      checkInterval: config.checkInterval || 60000,
      maxConcurrentPositions: config.maxConcurrentPositions || 5,
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[MultiStrategyBot] Bot is already running');
      return;
    }

    this.isRunning = true;
    console.log(`[MultiStrategyBot] ========== STARTING MULTI-STRATEGY BOT ==========`);
    console.log(`[MultiStrategyBot] Markets: ${this.config.activeMarkets.join(', ')}`);
    console.log(`[MultiStrategyBot] Check interval: ${this.config.checkInterval}ms`);

    // Initial setup
    await marketRotationEngine.fetchMarketData();

    // Start main trading loop
    await this.executeTradingCycle();
    this.tradingLoop = setInterval(() => {
      this.executeTradingCycle().catch(error => {
        console.error('[MultiStrategyBot] Error in trading cycle:', error);
      });
    }, this.config.checkInterval);

    console.log(`[MultiStrategyBot] ========== BOT STARTED SUCCESSFULLY ==========`);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn('[MultiStrategyBot] Bot is not running');
      return;
    }

    this.isRunning = false;
    if (this.tradingLoop) {
      clearInterval(this.tradingLoop);
      this.tradingLoop = null;
    }

    console.log(`[MultiStrategyBot] Stopped successfully. Total trades: ${this.tradesCount}`);
  }

  private async executeTradingCycle(): Promise<void> {
    try {
      console.log(`\n[MultiStrategyBot] ========== CYCLE ${this.decisionsCount + 1} ==========`);

      // Step 1: Fetch latest market data
      await marketRotationEngine.fetchMarketData();
      const topCoins = marketRotationEngine.getTopCoins(this.config.maxConcurrentPositions);

      console.log(`[MultiStrategyBot] Top coins by liquidity:`, topCoins.map(c => c.symbol).join(', '));

      // Step 2: Generate signals for each active market
      for (const coin of topCoins) {
        const symbol = coin.symbol;
        try {
          const signals = await this.generateSignals(symbol);
          const ensembleDecision = await ensembleEngine.makeEnsembleDecision(symbol, signals);

          if (ensembleDecision && ensembleDecision.action !== 'HOLD') {
            this.decisionsCount++;
            console.log(`[MultiStrategyBot] ${symbol}: ${ensembleDecision.action} (confidence: ${(ensembleDecision.confidence * 100).toFixed(1)}%)`);

            // Step 3: Apply dynamic risk management
            const riskConfig = dynamicRiskManager.calculateDynamicRisk(symbol, coin.volatility, 10000);
            console.log(`[MultiStrategyBot] ${symbol} Risk Config:`, {
              maxPosition: (riskConfig.maxPositionSize * 100).toFixed(1) + '%',
              stopLoss: (riskConfig.stopLossPercentage * 100).toFixed(2) + '%',
              takeProfit: (riskConfig.takeProfitPercentage * 100).toFixed(2) + '%',
            });

            // Step 4: Execute trade
            await this.executeTrade(symbol, ensembleDecision, riskConfig);

            // Step 5: Update motif patterns (learning)
            ensembleEngine.mutateMotifsForCoin(symbol);
          }
        } catch (error) {
          console.error(`[MultiStrategyBot] Error processing ${symbol}:`, error);
        }
      }

      // Step 6: Log ensemble weights every 5 cycles
      if (this.decisionsCount % 5 === 0) {
        const weights = ensembleEngine.getEnsembleWeights();
        console.log(`[MultiStrategyBot] Current ensemble weights:`, JSON.stringify(weights, null, 2));
      }

      console.log(`[MultiStrategyBot] Cycle complete. Positions: ${this.openPositions.size}`);
    } catch (error) {
      console.error('[MultiStrategyBot] Error in trading cycle:', error);
    }
  }

  private async generateSignals(symbol: string): Promise<StrategySignal[]> {
    const signals: StrategySignal[] = [];

    try {
      // Fetch price history
      const candles = await binanceClient.getCandles(symbol, '1h', 100);
      if (!candles || candles.length === 0) return signals;

      const prices = candles.map(c => parseFloat(c.close));
      const currentPrice = prices[prices.length - 1];

      // Generate trend signal
      const trendSignal = await ensembleEngine.analyzeTrend(symbol, prices);
      if (trendSignal) signals.push(trendSignal);

      // Generate volatility signal
      const volatilitySignal = await ensembleEngine.analyzeVolatility(symbol, prices);
      if (volatilitySignal) signals.push(volatilitySignal);

      // Generate Monte Carlo signal
      const volatility = this.calculateVolatility(prices);
      const mcSignal = await ensembleEngine.analyzeMonteCarlo(symbol, currentPrice, volatility);
      if (mcSignal) signals.push(mcSignal);
    } catch (error) {
      console.error(`[MultiStrategyBot] Error generating signals for ${symbol}:`, error);
    }

    return signals;
  }

  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sq, r) => sq + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  private async executeTrade(symbol: string, signal: StrategySignal, riskConfig: any): Promise<void> {
    try {
      console.log(`[Trade] Executing ${signal.action} for ${symbol} at ${signal.price}`);

      // Track position
      const positionId = `${symbol}_${Date.now()}`;
      this.openPositions.set(positionId, {
        symbol,
        action: signal.action,
        entryPrice: signal.price,
        stopLoss: signal.price * (1 - riskConfig.stopLossPercentage),
        takeProfit: signal.price * (1 + riskConfig.takeProfitPercentage),
        size: riskConfig.maxPositionSize,
        timestamp: new Date(),
      });

      this.tradesCount++;

      // Update RL agent
      const agent = ensembleEngine.getRLAgent();
      const state = `${symbol}_${signal.confidence > 0.7 ? 'HIGH' : 'LOW'}`;
      const reward = signal.confidence > 0.5 ? 1 : -0.5;
      agent.updateQValue(state, signal.action, reward, state, ['BUY', 'SELL', 'HOLD']);

      console.log(`[Trade] Position opened: ${positionId}`);
    } catch (error) {
      console.error(`[Trade] Error executing trade for ${symbol}:`, error);
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      decisionsCount: this.decisionsCount,
      tradesCount: this.tradesCount,
      openPositions: this.openPositions.size,
      activeMarkets: this.config.activeMarkets,
    };
  }

  getOpenPositions() {
    return Array.from(this.openPositions.values());
  }
}

export const multiStrategyBot = new MultiStrategyTradingBot();
