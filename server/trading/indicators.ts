import { EMA, RSI, MACD, BollingerBands, ATR, Stochastic } from 'technicalindicators';

export interface IndicatorValues {
  ema20: number | undefined;
  ema50: number | undefined;
  macdLine: number | undefined;
  macdSignal: number | undefined;
  macdHistogram: number | undefined;
  rsi14: number | undefined;
  bollingerUpper: number | undefined;
  bollingerMiddle: number | undefined;
  bollingerLower: number | undefined;
  atr14: number | undefined;
  stochasticK: number | undefined;
  stochasticD: number | undefined;
}

export function calculateIndicators(closes: number[], highs: number[], lows: number[]): IndicatorValues {
  const result: IndicatorValues = {
    ema20: undefined,
    ema50: undefined,
    macdLine: undefined,
    macdSignal: undefined,
    macdHistogram: undefined,
    rsi14: undefined,
    bollingerUpper: undefined,
    bollingerMiddle: undefined,
    bollingerLower: undefined,
    atr14: undefined,
    stochasticK: undefined,
    stochasticD: undefined,
  };

  if (closes.length < 50) return result;

  try {
    // EMA 20 & 50
    const ema20Array = EMA.calculate({ values: closes, period: 20 });
    const ema50Array = EMA.calculate({ values: closes, period: 50 });
    if (ema20Array.length > 0) result.ema20 = ema20Array[ema20Array.length - 1];
    if (ema50Array.length > 0) result.ema50 = ema50Array[ema50Array.length - 1];

    // MACD
    const macdResult = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
    if (macdResult.length > 0) {
      const lastMACD = macdResult[macdResult.length - 1];
      result.macdLine = lastMACD.MACD;
      result.macdSignal = lastMACD.signal;
      result.macdHistogram = lastMACD.histogram;
    }

    // RSI 14
    const rsiArray = RSI.calculate({ values: closes, period: 14 });
    if (rsiArray.length > 0) result.rsi14 = rsiArray[rsiArray.length - 1];

    // Bollinger Bands
    const bbResult = BollingerBands.calculate({
      period: 20,
      values: closes,
      stdDev: 2,
    });
    if (bbResult.length > 0) {
      const lastBB = bbResult[bbResult.length - 1];
      result.bollingerUpper = lastBB.upper;
      result.bollingerMiddle = lastBB.middle;
      result.bollingerLower = lastBB.lower;
    }

    // ATR 14
    const atrResult = ATR.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: 14,
    });
    if (atrResult.length > 0) result.atr14 = atrResult[atrResult.length - 1];

    // Stochastic
    const stochResult = Stochastic.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: 14,
      signalPeriod: 3,
    });
    if (stochResult.length > 0) {
      const lastStoch = stochResult[stochResult.length - 1];
      result.stochasticK = lastStoch.k;
      result.stochasticD = lastStoch.d;
    }
  } catch (error) {
    console.error('[Indicators] Error calculating technical indicators:', error);
  }

  return result;
}

export function calculateVolatilityScore(atr: number | undefined, price: number, bollingerWidth: number | undefined): number {
  if (!atr || !bollingerWidth) return 0.5;
  const atrPercent = (atr / price) * 100;
  const volatilityScore = Math.min(atrPercent / 5, 1); // 5% ATR = 1.0 volatility
  return volatilityScore;
}

export function calculateLiquidityDensity(bids: [string, string][], asks: [string, string][], topLevels: number = 5): number {
  if (!bids || !asks || bids.length === 0 || asks.length === 0) return 0;
  
  const topBidVolume = bids.slice(0, topLevels).reduce((sum, [_, vol]) => sum + parseFloat(vol), 0);
  const topAskVolume = asks.slice(0, topLevels).reduce((sum, [_, vol]) => sum + parseFloat(vol), 0);
  
  const totalVolume = topBidVolume + topAskVolume;
  const liquidityScore = Math.min(totalVolume / 1000, 1); // Scale to 1.0
  
  return liquidityScore;
}
