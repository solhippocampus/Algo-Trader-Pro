import { IndicatorValues, calculateVolatilityScore } from './indicators';
import { v4 as uuidv4 } from 'uuid';

export type MotifType = 'trend' | 'momentum' | 'volatility' | 'sentiment';
export type TradeSignal = 'STRONG_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG_SHORT';

export interface MotifSignal {
  motifId: string;
  type: MotifType;
  signal: number; // 0 = strong short, 0.5 = neutral, 1 = strong long
  confidence: number; // 0-1
  details: Record<string, any>;
  timestamp: number;
}

export interface MotifMutation {
  motifId: string;
  successCount: number;
  failureCount: number;
  weight: number; // Bayes updated weight
  lastMutationTime: number;
}

export class TrendMotif {
  private motifId: string = uuidv4();

  analyze(indicators: IndicatorValues, price: number): MotifSignal {
    const signal = this.calculateSignal(indicators, price);
    const confidence = this.calculateConfidence(indicators);

    return {
      motifId: this.motifId,
      type: 'trend',
      signal,
      confidence,
      details: {
        ema20: indicators.ema20,
        ema50: indicators.ema50,
        macdHistogram: indicators.macdHistogram,
      },
      timestamp: Date.now(),
    };
  }

  private calculateSignal(indicators: IndicatorValues, price: number): number {
    if (!indicators.ema20 || !indicators.ema50) return 0.5;

    // Trend: EMA20 > EMA50 = Uptrend (Long), vice versa = Downtrend (Short)
    const emai20Above = indicators.ema20 > indicators.ema50;
    const priceAboveEma = price > indicators.ema20;

    let signal = 0.5;
    if (emai20Above && priceAboveEma) {
      // Strong uptrend
      signal = 0.8 + (indicators.ema20 > price ? 0.2 : 0);
    } else if (!emai20Above && !priceAboveEma) {
      // Strong downtrend
      signal = 0.2 - (indicators.ema20 < price ? 0.2 : 0);
    } else if (emai20Above) {
      signal = 0.6; // Mild uptrend
    } else {
      signal = 0.4; // Mild downtrend
    }

    // MACD confirmation
    if (indicators.macdHistogram !== undefined) {
      if (indicators.macdHistogram > 0 && signal > 0.5) signal += 0.05;
      if (indicators.macdHistogram < 0 && signal < 0.5) signal -= 0.05;
    }

    return Math.min(Math.max(signal, 0), 1);
  }

  private calculateConfidence(indicators: IndicatorValues): number {
    let confidence = 0.5;
    if (indicators.ema20 && indicators.ema50) confidence += 0.3;
    if (indicators.macdHistogram !== undefined) confidence += 0.2;
    return Math.min(confidence, 1);
  }
}

export class MomentumMotif {
  private motifId: string = uuidv4();

  analyze(indicators: IndicatorValues): MotifSignal {
    const signal = this.calculateSignal(indicators);
    const confidence = this.calculateConfidence(indicators);

    return {
      motifId: this.motifId,
      type: 'momentum',
      signal,
      confidence,
      details: {
        rsi14: indicators.rsi14,
        stochasticK: indicators.stochasticK,
        stochasticD: indicators.stochasticD,
      },
      timestamp: Date.now(),
    };
  }

  private calculateSignal(indicators: IndicatorValues): number {
    let signal = 0.5;

    // RSI Momentum
    if (indicators.rsi14 !== undefined) {
      if (indicators.rsi14 > 70) {
        signal = 0.7; // Overbought but momentum is high
      } else if (indicators.rsi14 > 60) {
        signal = 0.65;
      } else if (indicators.rsi14 > 50) {
        signal = 0.55;
      } else if (indicators.rsi14 > 40) {
        signal = 0.45;
      } else if (indicators.rsi14 > 30) {
        signal = 0.35; // Oversold
      } else {
        signal = 0.3;
      }
    }

    // Stochastic confirmation
    if (indicators.stochasticK !== undefined && indicators.stochasticD !== undefined) {
      const stochAvg = (indicators.stochasticK + indicators.stochasticD) / 200; // Normalize to 0.5
      signal = signal * 0.7 + stochAvg * 0.3;
    }

    return Math.min(Math.max(signal, 0), 1);
  }

  private calculateConfidence(indicators: IndicatorValues): number {
    let confidence = 0.3;
    if (indicators.rsi14 !== undefined) confidence += 0.4;
    if (indicators.stochasticK !== undefined) confidence += 0.2;
    return Math.min(confidence, 1);
  }
}

export class VolatilityMotif {
  private motifId: string = uuidv4();

  analyze(indicators: IndicatorValues, price: number, orderBook: any): MotifSignal {
    const signal = this.calculateSignal(indicators, price, orderBook);
    const confidence = this.calculateConfidence(indicators, orderBook);

    return {
      motifId: this.motifId,
      type: 'volatility',
      signal,
      confidence,
      details: {
        atr14: indicators.atr14,
        bollingerWidth: indicators.bollingerUpper && indicators.bollingerLower 
          ? indicators.bollingerUpper - indicators.bollingerLower 
          : undefined,
        volatilityLevel: signal < 0.4 ? 'low' : signal < 0.7 ? 'medium' : 'high',
      },
      timestamp: Date.now(),
    };
  }

  private calculateSignal(indicators: IndicatorValues, price: number, orderBook: any): number {
    if (!indicators.atr14) return 0.5;

    const volatilityScore = calculateVolatilityScore(
      indicators.atr14,
      price,
      indicators.bollingerUpper && indicators.bollingerLower
        ? indicators.bollingerUpper - indicators.bollingerLower
        : undefined
    );

    // High volatility = reduce trade size (signal closer to 0.5)
    // Low volatility = increase confidence in trend (signal moves away from 0.5)
    const signal = 0.5 + (volatilityScore - 0.5) * 0.3;
    return Math.min(Math.max(signal, 0), 1);
  }

  private calculateConfidence(indicators: IndicatorValues, orderBook: any): number {
    let confidence = 0.4;
    if (indicators.atr14) confidence += 0.3;
    if (indicators.bollingerUpper) confidence += 0.3;
    return Math.min(confidence, 1);
  }
}

export class SentimentMotif {
  private motifId: string = uuidv4();
  private sentimentCache: Map<string, number> = new Map();

  analyze(symbol: string, priceHistory: number[]): MotifSignal {
    const signal = this.calculateSignal(symbol, priceHistory);
    const confidence = this.calculateConfidence(priceHistory);

    return {
      motifId: this.motifId,
      type: 'sentiment',
      signal,
      confidence,
      details: {
        priceChangePercent: priceHistory.length > 1 
          ? ((priceHistory[priceHistory.length - 1] - priceHistory[0]) / priceHistory[0]) * 100
          : 0,
        momentum: this.calculatePriceMomentum(priceHistory),
      },
      timestamp: Date.now(),
    };
  }

  private calculateSignal(symbol: string, priceHistory: number[]): number {
    if (priceHistory.length < 2) return 0.5;

    // Price change sentiment
    const priceChange = (priceHistory[priceHistory.length - 1] - priceHistory[0]) / priceHistory[0];
    let sentimentScore = 0.5 + Math.tanh(priceChange * 10) * 0.3; // Sigmoid-like

    // Mock sentiment from social/news
    const cachedSentiment = this.sentimentCache.get(symbol) || 0.5;
    sentimentScore = sentimentScore * 0.6 + cachedSentiment * 0.4;

    return Math.min(Math.max(sentimentScore, 0), 1);
  }

  private calculateConfidence(priceHistory: number[]): number {
    // More price history = higher confidence
    return Math.min(0.3 + (priceHistory.length / 100) * 0.3, 0.7);
  }

  private calculatePriceMomentum(priceHistory: number[]): number {
    if (priceHistory.length < 2) return 0;
    const recentChange = (priceHistory[priceHistory.length - 1] - priceHistory[Math.max(0, priceHistory.length - 10)]) / 
                         priceHistory[Math.max(0, priceHistory.length - 10)];
    return recentChange;
  }

  setSentimentScore(symbol: string, score: number) {
    this.sentimentCache.set(symbol, Math.min(Math.max(score, 0), 1));
  }
}

export class MotifEnsemble {
  private trendMotif: TrendMotif;
  private momentumMotif: MomentumMotif;
  private volatilityMotif: VolatilityMotif;
  private sentimentMotif: SentimentMotif;
  private weights: Record<MotifType, number>;

  constructor() {
    this.trendMotif = new TrendMotif();
    this.momentumMotif = new MomentumMotif();
    this.volatilityMotif = new VolatilityMotif();
    this.sentimentMotif = new SentimentMotif();

    // Initial equal weights
    this.weights = {
      trend: 0.35,
      momentum: 0.25,
      volatility: 0.20,
      sentiment: 0.20,
    };
  }

  analyze(
    indicators: IndicatorValues,
    price: number,
    symbol: string,
    orderBook: any,
    priceHistory: number[]
  ): { signal: number; confidence: number; motifs: MotifSignal[] } {
    const motifs: MotifSignal[] = [
      this.trendMotif.analyze(indicators, price),
      this.momentumMotif.analyze(indicators),
      this.volatilityMotif.analyze(indicators, price, orderBook),
      this.sentimentMotif.analyze(symbol, priceHistory),
    ];

    // Weighted ensemble
    let weightedSignal = 0;
    let averageConfidence = 0;

    motifs.forEach(motif => {
      weightedSignal += motif.signal * this.weights[motif.type];
      averageConfidence += motif.confidence * this.weights[motif.type];
    });

    return {
      signal: Math.min(Math.max(weightedSignal, 0), 1),
      confidence: averageConfidence,
      motifs,
    };
  }

  updateWeights(updates: Partial<Record<MotifType, number>>) {
    Object.assign(this.weights, updates);
    // Normalize weights
    const sum = Object.values(this.weights).reduce((a, b) => a + b, 0);
    Object.keys(this.weights).forEach(key => {
      this.weights[key as MotifType] /= sum;
    });
  }

  getWeights(): Record<MotifType, number> {
    return { ...this.weights };
  }
}
