export interface Position {
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  riskAmount: number;
  potentialReward: number;
  riskRewardRatio: number;
  createdAt: number;
  initialSignal?: number;
  dynamicStop?: number;
  lastAtr?: number;
  trailingStopPrice?: number;  // Current trailing stop price
  highestPrice?: number;       // Highest price reached (for LONG positions)
  lowestPrice?: number;        // Lowest price reached (for SHORT positions)
  partialClosedQuantity?: number;  // Quantity closed at first profit tier
}

export interface RiskMetrics {
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  profitFactor: number;
  maxRiskPerTrade: number;
}

export class RiskManager {
  private portfolio: Map<string, Position> = new Map();
  private accountBalance: number = 0;
  private tradeHistory: any[] = [];
  private maxPositionRisk: number = 0.015; // 1.5% per trade (optimized)
  private maxTotalRisk: number = 0.10; // 10% max total risk
  private riskRewardRatioMin: number = 1.3; // Minimum 1.3:1 ratio (more realistic)
  private isDemoMode: boolean = false; // Live trading
  private atrMultiplier: number = 1.2; // ATR multiplier for dynamic stop-loss (balanced)

  constructor(initialBalance: number = 10000) {
    this.accountBalance = initialBalance;
  }

  calculatePositionSize(
    entryPrice: number,
    stopLoss: number,
    signal: number,
    confidence: number,
    volatility: number = 0.5,  // Optional volatility factor (0-1)
    sentimentRiskAdjustment: number = 1.0  // Optional sentiment adjustment (0.5-1.2)
  ): number {
    const riskPerTrade = this.accountBalance * this.maxPositionRisk; // Amount in USD to risk
    const priceRisk = Math.abs(entryPrice - stopLoss); // Price difference per unit

    if (priceRisk === 0 || entryPrice === 0) return 0;

    // Calculate quantity: how many coins can we buy with risk amount
    let quantity = riskPerTrade / priceRisk; // Quantity based on risk

    // Adjust by confidence - more aggressive with high confidence
    quantity *= (0.4 + confidence * 0.6); // scale: 40-100% based on confidence

    // Adjust by signal strength - prioritize clear trends
    const signalStrength = Math.abs(signal - 0.5) * 2; // 0-1 scale
    quantity *= (0.6 + signalStrength * 0.4); // 60-100% based on signal strength

    // Volatility-based sizing: reduce size in high volatility
    const volatilityAdjustment = 1 - (volatility * 0.25); // Up to 25% reduction in high volatility
    quantity *= volatilityAdjustment;

    // Apply sentiment-based risk adjustment (fear = larger sizes, greed = smaller)
    quantity *= sentimentRiskAdjustment;

    // Cap quantity to not exceed 2.5% of account balance in position value
    const maxPositionValue = this.accountBalance * 0.025;
    if (quantity * entryPrice > maxPositionValue) {
      quantity = maxPositionValue / entryPrice;
    }

    return Math.floor(quantity * 100) / 100; // Return with 2 decimal places
  }

  calculateStopLoss(
    entryPrice: number,
    signal: number,
    volatility: number,
    atr: number | undefined
  ): number {
    const direction = signal > 0.5 ? 1 : -1;

    // Use ATR-based stop loss
    if (atr) {
      const stopLoss = entryPrice - direction * atr * this.atrMultiplier; // ATR-based stop using multiplier
      return parseFloat(stopLoss.toFixed(8));
    }

    // Fallback: percentage-based stop loss
    const stopLossPercent = 0.02 + volatility * 0.03; // 2-5% based on volatility
    const stopLoss = entryPrice * (1 - direction * stopLossPercent);
    return parseFloat(stopLoss.toFixed(8));
  }

  calculateTakeProfit(
    entryPrice: number,
    stopLoss: number,
    riskRewardRatio: number = 2.5
  ): number {
    const riskAmount = Math.abs(entryPrice - stopLoss);
    const rewardAmount = riskAmount * riskRewardRatio;
    const direction = entryPrice > stopLoss ? 1 : -1;
    const takeProfit = entryPrice + direction * rewardAmount;
    return parseFloat(takeProfit.toFixed(8));
  }

  validateTrade(
    entryPrice: number,
    stopLoss: number,
    takeProfit: number,
    quantity: number,
    signal: number
  ): { valid: boolean; reason?: string } {
    // Check position size (allow 10% of balance per position)
    const positionValue = entryPrice * quantity;
    if (positionValue > this.accountBalance * 0.1) {
      return { valid: false, reason: `Position size ${positionValue.toFixed(2)} exceeds 10% of balance ${(this.accountBalance * 0.1).toFixed(2)}` };
    }

    // Check risk/reward ratio
    const riskAmount = Math.abs(entryPrice - stopLoss);
    const rewardAmount = Math.abs(takeProfit - entryPrice);
    const ratio = rewardAmount / riskAmount;

    if (ratio < this.riskRewardRatioMin) {
      return { valid: false, reason: `Risk/Reward ratio ${ratio.toFixed(2)} below minimum ${this.riskRewardRatioMin}` };
    }

    // Check signal validity
    if (signal > 0.5 && stopLoss > entryPrice) {
      return { valid: false, reason: 'LONG signal but stop-loss above entry' };
    }
    if (signal < 0.5 && stopLoss < entryPrice) {
      return { valid: false, reason: 'SHORT signal but stop-loss below entry' };
    }

    // Check total portfolio risk
    const totalRisk = Array.from(this.portfolio.values()).reduce((sum, pos) => sum + pos.riskAmount, 0);
    if (totalRisk > this.accountBalance * this.maxTotalRisk) {
      return { valid: false, reason: 'Total portfolio risk exceeded' };
    }

    return { valid: true };
  }

  openPosition(
    symbol: string,
    entryPrice: number,
    quantity: number,
    stopLoss: number,
    takeProfit: number,
    signal: number
  ): Position | null {
    const side = signal > 0.5 ? 'LONG' : 'SHORT';
    const riskAmount = Math.abs(entryPrice - stopLoss) * quantity;
    const potentialReward = Math.abs(takeProfit - entryPrice) * quantity;
    const riskRewardRatio = potentialReward / riskAmount;

    const validation = this.validateTrade(entryPrice, stopLoss, takeProfit, quantity, signal);
    if (!validation.valid) {
      console.warn(`[RiskManager] Trade validation failed: ${validation.reason}`);
      return null;
    }

    const position: Position = {
      symbol,
      side,
      entryPrice,
      quantity,
      stopLoss,
      takeProfit,
      riskAmount,
      potentialReward,
      riskRewardRatio,
      createdAt: Date.now(),
      initialSignal: signal,
      dynamicStop: stopLoss,
      lastAtr: undefined,
    };

    this.portfolio.set(`${symbol}_${position.createdAt}`, position);
    return position;
  }

  updatePositionStop(positionId: string, newStop: number, atr?: number) {
    const position = this.portfolio.get(positionId);
    if (!position) return null;

    // For LONG, tighten stop if newStop is greater (closer to price). For SHORT, tighten if newStop is lower.
    if (position.side === 'LONG') {
      if (newStop > position.stopLoss) {
        position.stopLoss = newStop;
        position.dynamicStop = newStop;
        position.lastAtr = atr;
      }
    } else {
      if (newStop < position.stopLoss) {
        position.stopLoss = newStop;
        position.dynamicStop = newStop;
        position.lastAtr = atr;
      }
    }

    this.portfolio.set(positionId, position);
    return position;
  }

  // Calculate trailing stop based on current price and ATR
  calculateTrailingStop(position: Position, currentPrice: number, atr: number = 5): number {
    const trailingDistance = atr * 1.2; // Use ATR for trailing distance

    if (position.side === 'LONG') {
      // For LONG: trailing stop is below current price
      const newTrailingStop = currentPrice - trailingDistance;
      return Math.max(newTrailingStop, position.stopLoss); // Never go below hard stop
    } else {
      // For SHORT: trailing stop is above current price
      const newTrailingStop = currentPrice + trailingDistance;
      return Math.min(newTrailingStop, position.stopLoss); // Never go above hard stop
    }
  }

  // Update trailing stops and track highest/lowest prices
  updateTrailingStop(positionId: string, currentPrice: number, atr: number = 5): void {
    const position = this.portfolio.get(positionId);
    if (!position) return;

    if (position.side === 'LONG') {
      // Track highest price for LONG positions
      if (!position.highestPrice || currentPrice > position.highestPrice) {
        position.highestPrice = currentPrice;
      }
      // Update trailing stop
      const newTrailingStop = this.calculateTrailingStop(position, currentPrice, atr);
      position.trailingStopPrice = newTrailingStop;
      if (newTrailingStop > position.stopLoss) {
        position.stopLoss = newTrailingStop;
      }
    } else {
      // Track lowest price for SHORT positions
      if (!position.lowestPrice || currentPrice < position.lowestPrice) {
        position.lowestPrice = currentPrice;
      }
      // Update trailing stop
      const newTrailingStop = this.calculateTrailingStop(position, currentPrice, atr);
      position.trailingStopPrice = newTrailingStop;
      if (newTrailingStop < position.stopLoss) {
        position.stopLoss = newTrailingStop;
      }
    }

    this.portfolio.set(positionId, position);
  }

  // Check if position has hit profit-taking target (0.5% or 1%)
  checkProfitTargets(positionId: string, currentPrice: number): { level: '0.5%' | '1%' | null; shouldClose: boolean } {
    const position = this.portfolio.get(positionId);
    if (!position) return { level: null, shouldClose: false };

    const priceChange = (currentPrice - position.entryPrice) / position.entryPrice;

    if (position.side === 'LONG') {
      // For LONG: positive price change
      if (priceChange >= 0.01 && !position.partialClosedQuantity) {
        return { level: '1%', shouldClose: true };
      }
      if (priceChange >= 0.005 && !position.partialClosedQuantity) {
        return { level: '0.5%', shouldClose: true };
      }
    } else {
      // For SHORT: negative price change
      if (priceChange <= -0.01 && !position.partialClosedQuantity) {
        return { level: '1%', shouldClose: true };
      }
      if (priceChange <= -0.005 && !position.partialClosedQuantity) {
        return { level: '0.5%', shouldClose: true };
      }
    }

    return { level: null, shouldClose: false };
  }

  getOpenPositionsWithIds(): { id: string; position: Position }[] {
    return Array.from(this.portfolio.entries()).map(([id, pos]) => ({ id, position: pos }));
  }

  closePosition(positionId: string, exitPrice: number, quantityToClose?: number): any {
    const position = this.portfolio.get(positionId);
    if (!position) return null;

    const closingQuantity = quantityToClose || position.quantity;
    const remainingQuantity = position.quantity - closingQuantity;
    const pnl = (exitPrice - position.entryPrice) * closingQuantity * (position.side === 'LONG' ? 1 : -1);
    const pnlPercent = (pnl / (position.entryPrice * closingQuantity)) * 100;

    this.accountBalance += pnl;

    if (remainingQuantity <= 0) {
      // Full close
      this.tradeHistory.push({
        ...position,
        exitPrice,
        pnl,
        pnlPercent,
        closedAt: Date.now(),
      });
      this.portfolio.delete(positionId);
    } else {
      // Partial close
      position.quantity = remainingQuantity;
      position.partialClosedQuantity = (position.partialClosedQuantity || 0) + closingQuantity;
      this.portfolio.set(positionId, position);
    }

    return {
      positionId,
      pnl,
      pnlPercent,
      newBalance: this.accountBalance,
      fullyClosed: remainingQuantity <= 0,
    };
  }

  updatePosition(positionId: string, currentPrice: number, atr?: number): Position | null {
    const position = this.portfolio.get(positionId);
    if (!position) return null;

    // Update trailing stop
    if (atr) {
      this.updateTrailingStop(positionId, currentPrice, atr);
    }

    // Check stop-loss and take-profit
    if (position.side === 'LONG') {
      if (currentPrice <= position.stopLoss) {
        console.log(`[RiskManager] Stop-loss hit on ${position.symbol}`);
        this.closePosition(positionId, position.stopLoss);
        return null;
      }
      if (currentPrice >= position.takeProfit) {
        console.log(`[RiskManager] Take-profit hit on ${position.symbol}`);
        this.closePosition(positionId, position.takeProfit);
        return null;
      }
    } else {
      if (currentPrice >= position.stopLoss) {
        console.log(`[RiskManager] Stop-loss hit on ${position.symbol}`);
        this.closePosition(positionId, position.stopLoss);
        return null;
      }
      if (currentPrice <= position.takeProfit) {
        console.log(`[RiskManager] Take-profit hit on ${position.symbol}`);
        this.closePosition(positionId, position.takeProfit);
        return null;
      }
    }

    return position;
  }

  getOpenPositions(): Position[] {
    return Array.from(this.portfolio.values());
  }

  getAccountState() {
    return {
      balance: this.accountBalance,
      openPositions: this.portfolio.size,
      totalRisk: Array.from(this.portfolio.values()).reduce((sum, pos) => sum + pos.riskAmount, 0),
    };
  }

  calculateMetrics(): RiskMetrics {
    if (this.tradeHistory.length === 0) {
      return {
        maxDrawdown: 0,
        sharpeRatio: 0,
        winRate: 0,
        profitFactor: 0,
        maxRiskPerTrade: this.maxPositionRisk,
      };
    }

    const wins = this.tradeHistory.filter(t => t.pnl > 0);
    const losses = this.tradeHistory.filter(t => t.pnl < 0);

    const winRate = (wins.length / this.tradeHistory.length) * 100;
    const totalWins = wins.reduce((sum, t) => sum + t.pnl, 0);
    const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;

    // Simplified Sharpe Ratio
    const returns = this.tradeHistory.map(t => t.pnlPercent);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + (b - avgReturn) ** 2, 0) / returns.length;
    const stddev = Math.sqrt(variance);
    const sharpeRatio = stddev > 0 ? (avgReturn / stddev) * Math.sqrt(252) : 0; // Annualized

    return {
      maxDrawdown: 0, // Simplified
      sharpeRatio,
      winRate,
      profitFactor,
      maxRiskPerTrade: this.maxPositionRisk,
    };
  }

  getTradeHistory() {
    return this.tradeHistory;
  }

  setMaxRiskPerTrade(risk: number) {
    this.maxPositionRisk = risk;
  }

  setMaxTotalRisk(risk: number) {
    this.maxTotalRisk = risk;
  }

  setAccountBalance(balance: number) {
    this.accountBalance = balance;
  }

  getAccountBalance(): number {
    return this.accountBalance;
  }

  setAtrMultiplier(mult: number) {
    if (mult <= 0) return;
    this.atrMultiplier = mult;
  }

  getAtrMultiplier(): number {
    return this.atrMultiplier;
  }
}
