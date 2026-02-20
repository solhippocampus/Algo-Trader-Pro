import { MARKETS } from "./multi-strategy-engine";

export interface MarketRotationData {
  symbol: string;
  volume24h: number;
  volatility: number;
  volatilityPercentile: number;
  priceChange24h: number;
  liquidityScore: number;
  allocationWeight: number;
}

export class MarketRotationEngine {
  private marketData: Map<string, MarketRotationData> = new Map();
  private updateInterval: number = 60000; // 1 minute

  async fetchMarketData(): Promise<void> {
    try {
      // In production, fetch from Binance 24hr stats & ticker endpoints
      // For now, using mock data structure
      for (const symbol of MARKETS) {
        const data = await this.getMarketStats(symbol);
        this.marketData.set(symbol, data);
      }
    } catch (error) {
      console.error("[MarketRotation] Error fetching market data:", error);
    }
  }

  private async getMarketStats(symbol: string): Promise<MarketRotationData> {
    // Mock implementation - replace with real Binance API calls
    const volume24h = Math.random() * 1000000000;
    const volatility = Math.random() * 0.1;
    const priceChange24h = (Math.random() - 0.5) * 0.2;

    const volatilityPercentile = this.getPercentile(volatility);
    const liquidityScore = this.calculateLiquidity(volume24h, volatility);

    return {
      symbol,
      volume24h,
      volatility,
      volatilityPercentile,
      priceChange24h,
      liquidityScore,
      allocationWeight: 0, // Will be updated by rebalance
    };
  }

  private getPercentile(volatility: number): number {
    // Calculate percentile rank of volatility among all markets
    const allVolatilities = Array.from(this.marketData.values()).map(d => d.volatility);
    const sorted = allVolatilities.sort((a, b) => a - b);
    const index = sorted.indexOf(volatility);
    return (index / sorted.length) * 100;
  }

  private calculateLiquidity(volume24h: number, volatility: number): number {
    // Liquidity score: high volume + manageable volatility = high score
    const volumeScore = Math.min(volume24h / 1000000000, 1);
    const volatilityScore = Math.max(1 - volatility * 10, 0);
    return (volumeScore * 0.7) + (volatilityScore * 0.3);
  }

  rebalanceAllocations(): MarketRotationData[] {
    const data = Array.from(this.marketData.values());

    // Sort by liquidity score
    data.sort((a, b) => b.liquidityScore - a.liquidityScore);

    // Allocate weights: high liquidity = high weight, but cap at 20% per coin
    const totalLiquidity = data.reduce((sum, d) => sum + d.liquidityScore, 0);
    for (const d of data) {
      let weight = (d.liquidityScore / totalLiquidity) * 0.8; // 80% liquidity-based
      weight += 0.2 / data.length; // 20% equal distribution
      d.allocationWeight = Math.min(weight, 0.2); // Cap at 20%
    }

    // Normalize to 100%
    const totalWeight = data.reduce((sum, d) => sum + d.allocationWeight, 0);
    for (const d of data) {
      d.allocationWeight /= totalWeight;
    }

    return data;
  }

  getTopCoins(count: number = 3): MarketRotationData[] {
    return Array.from(this.marketData.values())
      .sort((a, b) => b.liquidityScore - a.liquidityScore)
      .slice(0, count);
  }

  getVolatilityRankedCoins(): MarketRotationData[] {
    return Array.from(this.marketData.values())
      .sort((a, b) => b.volatility - a.volatility);
  }

  getAllMarketData(): MarketRotationData[] {
    return Array.from(this.marketData.values());
  }
}

export const marketRotationEngine = new MarketRotationEngine();
