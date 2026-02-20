import axios from 'axios';

export interface CoinmarketData {
  btcDominance: number;
  globalMarketCap: number;
  globalVolume24h: number;
  fearGreedIndex: number;
  fearGreedTrend: 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed';
  bitcoinPrice: number;
  ethPrice: number;
  timestamp: number;
}

export class CoinmarketClient {
  private apiKey: string;
  private baseUrl: string = 'https://pro-api.coinmarketcap.com/v1';
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheValidityMs: number = 300000; // 5 minutes

  constructor(apiKey: string = '') {
    this.apiKey = apiKey || process.env.COINMARKET_API_KEY || '';
  }

  // Get Fear & Greed Index from alternative source (CoinmarketCap alternative API)
  async getFearGreedIndex(): Promise<{ index: number; trend: string } | null> {
    try {
      // Using alternative endpoint that doesn't require premium subscription
      const res = await axios.get('https://api.alternative.me/fng/?limit=1', {
        timeout: 5000,
      });

      if (res.data?.data?.[0]) {
        const index = parseInt(res.data.data[0].value);
        const trend = this.getTrend(index);
        return { index, trend };
      }

      return null;
    } catch (error) {
      console.error('[CoinmarketClient] Error fetching Fear & Greed:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  // Get Bitcoin Dominance and market cap
  async getGlobalMetrics(): Promise<Partial<CoinmarketData> | null> {
    try {
      if (!this.apiKey) {
        console.warn('[CoinmarketClient] No API key configured - using fallback data');
        return this.getFallbackMetrics();
      }

      const cacheKey = 'global_metrics';
      const cached = this.cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.cacheValidityMs) {
        return cached.data;
      }

      const res = await axios.get(`${this.baseUrl}/global/quotes/latest`, {
        headers: {
          'X-CMC_PRO_API_KEY': this.apiKey,
        },
        timeout: 5000,
      });

      if (res.data?.data) {
        const data = {
          btcDominance: res.data.data.btc_dominance || 42,
          globalMarketCap: res.data.data.quote?.USD?.total_market_cap || 0,
          globalVolume24h: res.data.data.quote?.USD?.total_volume_24h || 0,
          timestamp: Date.now(),
        };

        this.cache.set(cacheKey, { data, timestamp: Date.now() });
        return data;
      }

      return null;
    } catch (error) {
      console.error('[CoinmarketClient] Error fetching global metrics:', error instanceof Error ? error.message : error);
      return this.getFallbackMetrics();
    }
  }

  // Get specific coin data
  async getCoinData(symbol: string): Promise<{ price: number; change24h: number } | null> {
    try {
      if (!this.apiKey) {
        return null;
      }

      const cacheKey = `coin_${symbol}`;
      const cached = this.cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.cacheValidityMs) {
        return cached.data;
      }

      const res = await axios.get(`${this.baseUrl}/cryptocurrency/quotes/latest`, {
        params: {
          symbol,
          convert: 'USD',
        },
        headers: {
          'X-CMC_PRO_API_KEY': this.apiKey,
        },
        timeout: 5000,
      });

      if (res.data?.data?.[symbol]) {
        const coinData = res.data.data[symbol];
        const data = {
          price: coinData.quote?.USD?.price || 0,
          change24h: coinData.quote?.USD?.percent_change_24h || 0,
        };

        this.cache.set(cacheKey, { data, timestamp: Date.now() });
        return data;
      }

      return null;
    } catch (error) {
      console.error('[CoinmarketClient] Error fetching coin data:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  // Compile comprehensive market intelligence
  async getMarketIntelligence(): Promise<CoinmarketData | null> {
    try {
      const [fearGreed, metrics, btc, eth] = await Promise.all([
        this.getFearGreedIndex(),
        this.getGlobalMetrics(),
        this.getCoinData('BTC'),
        this.getCoinData('ETH'),
      ]);

      return {
        btcDominance: metrics?.btcDominance || 42,
        globalMarketCap: metrics?.globalMarketCap || 0,
        globalVolume24h: metrics?.globalVolume24h || 0,
        fearGreedIndex: fearGreed?.index || 50,
        fearGreedTrend: (fearGreed?.trend as any) || 'neutral',
        bitcoinPrice: btc?.price || 0,
        ethPrice: eth?.price || 0,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('[CoinmarketClient] Error compiling market intelligence:', error);
      return null;
    }
  }

  private getTrend(index: number): string {
    if (index <= 25) return 'extreme_fear';
    if (index <= 45) return 'fear';
    if (index <= 55) return 'neutral';
    if (index <= 75) return 'greed';
    return 'extreme_greed';
  }

  private getFallbackMetrics() {
    return {
      btcDominance: 42 + Math.random() * 8 - 4, // 38-46 range
      globalMarketCap: 1200000000000,
      globalVolume24h: 50000000000,
      timestamp: Date.now(),
    };
  }
}

// Export singleton instance
export const coinmarketClient = new CoinmarketClient(process.env.COINMARKET_API_KEY || '');
