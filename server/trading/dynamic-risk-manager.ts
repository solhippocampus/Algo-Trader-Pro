export interface DynamicRiskConfig {
  symbol: string;
  volatility: number;
  maxPositionSize: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
  allocation: number;
}

export class DynamicRiskManager {
  private baseMaxPosition: number = 0.1; // 10% per position normally
  private baseStopLoss: number = 0.05; // 5% stop loss baseline
  private baseTakeProfit: number = 0.1; // 10% take profit baseline

  calculateDynamicRisk(symbol: string, volatility: number, portfolioSize: number): DynamicRiskConfig {
    // Volatility ranges from 0 to ~1 (need normalization in real scenario)
    const volatilityRatio = Math.min(volatility / 0.1, 2); // Normalize to ~1 at 10% daily volatility

    // High volatility → smaller position, tighter stops
    // Low volatility → larger position, wider stops
    const positionFactor = 1 / (1 + volatilityRatio);
    const maxPosition = this.baseMaxPosition * positionFactor;

    // Scale stops based on volatility
    const stopLossFactor = Math.min(this.baseStopLoss * (1 + volatilityRatio), 0.15); // Cap at 15%
    const takeProfitFactor = this.baseTakeProfit * (1 + volatilityRatio * 0.5); // Modest scaling

    return {
      symbol,
      volatility,
      maxPositionSize: maxPosition,
      stopLossPercentage: stopLossFactor,
      takeProfitPercentage: takeProfitFactor,
      allocation: maxPosition,
    };
  }

  // Adjust allocation based on portfolio risk level
  adjustAllocationForPortfolioRisk(currentRisk: number, targetRisk: number): number {
    if (currentRisk > targetRisk) {
      return 0.5; // Reduce allocation by half if risk is high
    } else if (currentRisk < targetRisk * 0.5) {
      return 1.5; // Increase allocation by 50% if risk is low
    }
    return 1.0; // Normal allocation
  }

  calculatePortfolioRisk(positions: Array<{ symbol: string; volatility: number; size: number }>): number {
    if (positions.length === 0) return 0;

    // Portfolio risk = sqrt(sum of position risks)
    const positionRisks = positions.map(p => Math.pow(p.volatility * p.size, 2));
    const totalRiskSquared = positionRisks.reduce((a, b) => a + b, 0);

    return Math.sqrt(totalRiskSquared);
  }

  // Reduce positions if portfolio risk exceeds threshold
  getReducePositionsRecommendation(portfolioRisk: number, riskThreshold: number): string[] {
    if (portfolioRisk <= riskThreshold) {
      return [];
    }

    // Return symbols to reduce (could be dynamic)
    return ["AVAXUSDT", "TONUSDT"]; // Reduce volatile small caps first
  }
}

export const dynamicRiskManager = new DynamicRiskManager();
