import { MotifEnsemble, MotifSignal } from './motifs';
import { marketDataFetcher, MarketData } from './market-data';
import { AdaptiveLearningEngine } from './learning-system';
import { RiskManager, Position } from './risk-manager';
import { calculateVolatilityScore } from './indicators';
import { v4 as uuidv4 } from 'uuid';

export interface TradeDecision {
  symbol: string;
  signal: number; // 0-1
  confidence: number; // 0-1
  action: 'LONG' | 'SHORT' | 'NEUTRAL' | 'CLOSE_POSITION';
  position?: Position;
  motifs: MotifSignal[];
  timestamp: number;
  reasoning: string;
}

export interface StrategyExecution {
  decisionId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  executedAt: number;
  positionId?: string;
}

export class StrategyEngine {
  private motifEnsemble: MotifEnsemble;
  private learningEngine: AdaptiveLearningEngine;
  private riskManager: RiskManager;
  private priceHistory: Map<string, number[]> = new Map();
  private maxHistoryLength: number = 200;
  private trades: StrategyExecution[] = [];
  private decisions: TradeDecision[] = [];

  constructor(initialBalance: number = 10000) {
    this.motifEnsemble = new MotifEnsemble();
    this.learningEngine = new AdaptiveLearningEngine();
    this.riskManager = new RiskManager(initialBalance);
  }

  async analyzeAndDecide(symbol: string): Promise<TradeDecision | null> {
    try {
      // Fetch market data
      const marketData = await marketDataFetcher.fetchMarketData(symbol);
      if (!marketData) {
        console.warn(`[StrategyEngine] Unable to fetch market data for ${symbol}`);
        return null;
      }

      // Update price history
      if (!this.priceHistory.has(symbol)) {
        this.priceHistory.set(symbol, []);
      }
      const history = this.priceHistory.get(symbol)!;
      history.push(marketData.currentPrice);
      if (history.length > this.maxHistoryLength) {
        history.shift();
      }

      // Get ensemble signal
      const ensembleResult = this.motifEnsemble.analyze(
        marketData.indicators,
        marketData.currentPrice,
        symbol,
        marketData.orderBook,
        history
      );

      // Determine action
      let action: 'LONG' | 'SHORT' | 'NEUTRAL' | 'CLOSE_POSITION' = 'NEUTRAL';
      let reasoning = '';

      if (ensembleResult.signal > 0.58 && ensembleResult.confidence > 0.4) {
        action = 'LONG';
        reasoning = `Strong LONG signal (${(ensembleResult.signal * 100).toFixed(1)}%) with good confidence (${(ensembleResult.confidence * 100).toFixed(1)}%)`;
      } else if (ensembleResult.signal < 0.42 && ensembleResult.confidence > 0.4) {
        action = 'SHORT';
        reasoning = `Strong SHORT signal (${((1 - ensembleResult.signal) * 100).toFixed(1)}%) with good confidence (${(ensembleResult.confidence * 100).toFixed(1)}%)`;
      } else if (ensembleResult.signal > 0.52 && ensembleResult.signal <= 0.58) {
        action = 'LONG';
        reasoning = `Weak LONG signal (${(ensembleResult.signal * 100).toFixed(1)}%), considering confidence`;
      } else if (ensembleResult.signal < 0.48 && ensembleResult.signal >= 0.42) {
        action = 'SHORT';
        reasoning = `Weak SHORT signal (${((1 - ensembleResult.signal) * 100).toFixed(1)}%), considering confidence`;
      } else {
        action = 'NEUTRAL';
        reasoning = `Neutral market condition (signal: ${ensembleResult.signal.toFixed(3)})`;
      }

      // Check for position closure
      const openPositions = this.riskManager.getOpenPositions();
      if (openPositions.length > 0 && action !== 'NEUTRAL') {
        const position = openPositions[0];
        if ((action === 'LONG' && position.side === 'SHORT') || (action === 'SHORT' && position.side === 'LONG')) {
          action = 'CLOSE_POSITION';
          reasoning = `Reversal signal: closing ${position.side} position to open ${action}`;
        }
      }

      const decision: TradeDecision = {
        symbol,
        signal: ensembleResult.signal,
        confidence: ensembleResult.confidence,
        action,
        motifs: ensembleResult.motifs,
        timestamp: Date.now(),
        reasoning,
      };

      this.decisions.push(decision);
      console.log(`[StrategyEngine] ${symbol}: ${action} (signal: ${ensembleResult.signal.toFixed(3)}, confidence: ${ensembleResult.confidence.toFixed(3)})`);

      return decision;
    } catch (error) {
      console.error(`[StrategyEngine] Error analyzing ${symbol}:`, error);
      return null;
    }
  }

  executeDecision(decision: TradeDecision, marketData: MarketData): StrategyExecution | null {
    try {
      if (decision.action === 'NEUTRAL') {
        return null;
      }

      if (decision.action === 'CLOSE_POSITION') {
        const positions = this.riskManager.getOpenPositions();
        if (positions.length > 0) {
          const pos = positions[0];
          const result = this.riskManager.closePosition(`${pos.symbol}_${pos.createdAt}`, marketData.currentPrice);
          console.log(`[StrategyEngine] Position closed:`, result);
        }
        return null;
      }

      // Calculate position parameters
      const stopLoss = this.riskManager.calculateStopLoss(
        marketData.currentPrice,
        decision.signal,
        marketData.indicators.atr14 ? (marketData.indicators.atr14 / marketData.currentPrice) : 0.02,
        marketData.indicators.atr14
      );

      const takeProfit = this.riskManager.calculateTakeProfit(
        marketData.currentPrice,
        stopLoss,
        2.5 // Risk/reward ratio
      );

      const quantity = this.riskManager.calculatePositionSize(
        marketData.currentPrice,
        stopLoss,
        decision.signal,
        decision.confidence
      );

      if (quantity === 0) {
        console.warn(`[StrategyEngine] Calculated quantity is 0 for ${decision.symbol}`);
        return null;
      }

      // Open position
      const position = this.riskManager.openPosition(
        decision.symbol,
        marketData.currentPrice,
        quantity,
        stopLoss,
        takeProfit,
        decision.signal
      );

      if (!position) {
        console.warn(`[StrategyEngine] Failed to open position for ${decision.symbol}`);
        return null;
      }

      const execution: StrategyExecution = {
        decisionId: uuidv4(),
        symbol: decision.symbol,
        side: decision.action as 'LONG' | 'SHORT',
        entryPrice: marketData.currentPrice,
        quantity,
        stopLoss,
        takeProfit,
        executedAt: Date.now(),
        positionId: `${decision.symbol}_${position.createdAt}`,
      };

      this.trades.push(execution);
      console.log(`[StrategyEngine] Trade executed:`, execution);

      return execution;
    } catch (error) {
      console.error(`[StrategyEngine] Error executing decision:`, error);
      return null;
    }
  }

  recordTradeOutcome(symbol: string, exitPrice: number, motifType: 'trend' | 'momentum' | 'volatility' | 'sentiment') {
    const positions = this.riskManager.getOpenPositions();
    const position = positions.find(p => p.symbol === symbol);

    if (position) {
      const pnl = (exitPrice - position.entryPrice) * position.quantity * (position.side === 'LONG' ? 1 : -1);
      const success = pnl > 0;
      const currentState = this.motifEnsemble.analyze({} as any, exitPrice, symbol, null, []).signal.toFixed(2);
      const nextState = (exitPrice * 1.01).toString();

      this.learningEngine.recordTradeOutcome(
        motifType,
        success,
        currentState,
        nextState,
        pnl
      );

      const positionId = `${symbol}_${position.createdAt}`;
      this.riskManager.closePosition(positionId, exitPrice);

      console.log(`[StrategyEngine] Trade outcome recorded: ${motifType}, PnL: ${pnl}, Success: ${success}`);
    }
  }

  updateMotifWeights() {
    const weights = this.learningEngine.getUpdatedWeights();
    this.motifEnsemble.updateWeights(weights);
    console.log(`[StrategyEngine] Motif weights updated:`, weights);
  }

  getAccountState() {
    return this.riskManager.getAccountState();
  }

  getOpenPositions(): Position[] {
    return this.riskManager.getOpenPositions();
  }

  getMetrics() {
    return this.riskManager.calculateMetrics();
  }

  getRecentDecisions(limit: number = 10): TradeDecision[] {
    return this.decisions.slice(-limit);
  }

  getTrades(limit: number = 50): StrategyExecution[] {
    return this.trades.slice(-limit);
  }

  getLearningStats() {
    return this.learningEngine.getStats();
  }

  getMotifWeights() {
    return this.motifEnsemble.getWeights();
  }

  async refreshDynamicStops() {
    try {
      const open = this.getOpenPositions();
      if (open.length === 0) return [];
      const symbols = Array.from(new Set(open.map(p => p.symbol)));
      const dataMap = await marketDataFetcher.fetchMultipleSymbols(symbols);

      const updated: any[] = [];
      const openWithIds = this.riskManager.getOpenPositionsWithIds();
      for (const { id, position } of openWithIds) {
        const md = dataMap.get(position.symbol);
        const atr = md?.indicators?.atr14;
        const bollWidth = md && md.indicators && md.indicators.bollingerUpper && md.indicators.bollingerLower
          ? Math.abs(md.indicators.bollingerUpper - md.indicators.bollingerLower)
          : undefined;
        const volatility = calculateVolatilityScore(atr, position.entryPrice, bollWidth);
        const newStop = this.riskManager.calculateStopLoss(position.entryPrice, position.initialSignal ?? 0.5, volatility, atr);
        const result = this.riskManager.updatePositionStop(id, newStop, atr);
        if (result) updated.push({ id, position: result });
      }
      return updated;
    } catch (err) {
      console.error('[StrategyEngine] refreshDynamicStops error', err);
      return [];
    }
  }
}

export const strategyEngine = new StrategyEngine(10000); // Initialize with $10k
