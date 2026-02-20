import { coinmarketClient, CoinmarketData } from './coinmarket-client';

export interface SentimentSignal {
  signal: number; // -1 to 1 (extreme fear to extreme greed)
  confidence: number; // 0 to 1
  fearGreedIndex: number;
  riskAdjustment: number; // 0.5 to 1.5 (multiplier for position size)
  details: {
    trend: string;
    btcDominance: number;
    marketCap: number;
    confidence: number;
  };
}

export class SentimentMotif {
  async analyze(): Promise<SentimentSignal> {
    try {
      const marketData = await coinmarketClient.getMarketIntelligence();
      
      if (!marketData) {
        return this.getNeutralSignal();
      }

      // Fear & Greed Index: 0-100
      // Convert to signal: -1 (extreme fear) to +1 (extreme greed)
      const fgSignal = (marketData.fearGreedIndex - 50) / 50; // -1 to +1

      // Bitcoin Dominance: 30-70 typical range
      // High dominance = stronger market (more stable)
      const domFactor = (marketData.btcDominance - 50) / 20; // Normalized around 50%

      // Market Cap trend (would need historical data for proper trend)
      // For now: neutral multiplier
      const capFactor = 0;

      // Combined signal - heavily dampened to prevent false signals
      const signal = (fgSignal * 0.6 + domFactor * 0.4) * 0.3; // Reduced influence (0.3x multiplier)
      
      // Confidence higher when Fear & Greed is extreme
      const extremeness = Math.abs(marketData.fearGreedIndex - 50);
      const confidence = Math.min(0.95, 0.5 + (extremeness / 100) * 0.5);

      // Risk adjustment based on market sentiment - more aggressive in neutral/fear
      let riskAdjustment = 1.0;
      if (marketData.fearGreedIndex <= 20) {
        // Extreme fear: buy the dip (1.2x size)
        riskAdjustment = 1.2;
      } else if (marketData.fearGreedIndex <= 40) {
        // Fear: slight increase (0.9x)
        riskAdjustment = 0.9;
      } else if (marketData.fearGreedIndex >= 80) {
        // Greed: reduce position size (bubble risk)
        riskAdjustment = 0.7;
      } else if (marketData.fearGreedIndex >= 90) {
        // Extreme greed: higher reduction (crash protection)
        riskAdjustment = 0.5;
      }

      return {
        signal: Math.max(-1, Math.min(1, signal)), // Clamp to [-1, 1]
        confidence: Math.max(0, Math.min(1, confidence)),
        fearGreedIndex: marketData.fearGreedIndex,
        riskAdjustment,
        details: {
          trend: marketData.fearGreedTrend,
          btcDominance: marketData.btcDominance,
          marketCap: marketData.globalMarketCap,
          confidence,
          riskAdjustment,  // Include in details for strategy engine access
        },
      };
    } catch (error) {
      console.error('[SentimentMotif] Error analyzing sentiment:', error);
      return this.getNeutralSignal();
    }
  }

  private getNeutralSignal(): SentimentSignal {
    return {
      signal: 0,
      confidence: 0.3,
      fearGreedIndex: 50,
      riskAdjustment: 1.0,
      details: {
        trend: 'neutral',
        btcDominance: 42,
        marketCap: 0,
        confidence: 0.3,
      },
    };
  }
}

export const sentimentMotif = new SentimentMotif();
