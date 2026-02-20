import { binanceClient, Kline, OrderBook } from './binance-client';
import { calculateIndicators, IndicatorValues } from './indicators';

export interface MarketData {
  symbol: string;
  currentPrice: number;
  timestamp: number;
  indicators: IndicatorValues;
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
  orderBook: OrderBook | null;
}

export class MarketDataFetcher {
  private cache: Map<string, MarketData> = new Map();
  private updateInterval: number = 60000; // 1 minute
  private lastUpdate: Map<string, number> = new Map();

  async fetchMarketData(symbol: string, interval: string = '1m', limit: number = 100): Promise<MarketData | null> {
    try {
      // Check if we should update cache
      const lastUpdateTime = this.lastUpdate.get(symbol) || 0;
      const now = Date.now();

      if (now - lastUpdateTime < this.updateInterval && this.cache.has(symbol)) {
        return this.cache.get(symbol)!;
      }

      // Fetch candles
      const candles = await binanceClient.getCandles(symbol, interval, limit);
      if (candles.length === 0) {
        console.warn(`[MarketDataFetcher] No candles data for ${symbol}`);
        return null;
      }

      // Extract OHLCV
      const closes = candles.map(c => parseFloat(c.close));
      const highs = candles.map(c => parseFloat(c.high));
      const lows = candles.map(c => parseFloat(c.low));
      const volumes = candles.map(c => parseFloat(c.volume));

      // Calculate indicators
      const indicators = calculateIndicators(closes, highs, lows);

      // Fetch order book
      const orderBook = await binanceClient.getOrderBook(symbol, 20);

      // Get current price
      const currentPrice = closes[closes.length - 1];

      const marketData: MarketData = {
        symbol,
        currentPrice,
        timestamp: Date.now(),
        indicators,
        closes,
        highs,
        lows,
        volumes,
        orderBook,
      };

      // Cache
      this.cache.set(symbol, marketData);
      this.lastUpdate.set(symbol, now);

      return marketData;
    } catch (error) {
      console.error(`[MarketDataFetcher] Error fetching market data for ${symbol}:`, error);
      return null;
    }
  }

  async fetchMultipleSymbols(symbols: string[]): Promise<Map<string, MarketData>> {
    const results = new Map<string, MarketData>();

    for (const symbol of symbols) {
      const data = await this.fetchMarketData(symbol);
      if (data) {
        results.set(symbol, data);
      }
    }

    return results;
  }

  getCachedData(symbol: string): MarketData | undefined {
    return this.cache.get(symbol);
  }

  clearCache() {
    this.cache.clear();
    this.lastUpdate.clear();
  }

  setUpdateInterval(intervalMs: number) {
    this.updateInterval = intervalMs;
  }
}

export const marketDataFetcher = new MarketDataFetcher();
