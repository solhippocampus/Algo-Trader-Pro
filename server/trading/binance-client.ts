import axios from 'axios';
import crypto from 'crypto';

export interface Kline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteAssetVolume: string;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: string;
  takerBuyQuoteAssetVolume: string;
}

export interface OrderBook {
  symbol: string;
  bids: [string, string][];
  asks: [string, string][];
  timestamp: number;
}

export class BinanceAPIClient {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;
  private marketDataBaseUrl: string;
  private region: 'GLOBAL' | 'US' | 'TR';
  private isDemoMode: boolean = process.env.TRADING_MODE === 'DEMO' || !process.env.BINANCE_API_KEY;
  private lastApiError: string | null = null;

  constructor() {
    this.apiKey = process.env.BINANCE_API_KEY || '';
    this.apiSecret = process.env.BINANCE_API_SECRET || process.env.BINANCE_SECRET_KEY || '';
    this.region = this.resolveRegion();
    this.baseUrl = this.resolveBaseUrl();
    this.marketDataBaseUrl = this.resolveMarketDataBaseUrl();

    console.log(`[Binance] Region: ${this.region}, API base URL: ${this.baseUrl}, market data URL: ${this.marketDataBaseUrl}`);

    if (!this.apiKey || !this.apiSecret) {
      console.warn('[Binance] API keys not configured - DEMO MODE ENABLED');
      this.isDemoMode = true;
    } else {
      this.isDemoMode = false;
      console.log('[Binance] ✅ Real Binance Account Connected');
    }
  }

  getMode(): string {
    return this.isDemoMode ? 'DEMO' : 'LIVE';
  }

  getLastApiError(): string | null {
    return this.lastApiError;
  }

  setDemoMode(demo: boolean) {
    this.isDemoMode = demo;
    console.log(`[Binance] Mode changed to: ${this.isDemoMode ? 'DEMO' : 'LIVE'}`);
  }

  private resolveRegion(): 'GLOBAL' | 'US' | 'TR' {
    const region = (process.env.BINANCE_REGION || 'GLOBAL').trim().toUpperCase();
    if (region === 'TR') return 'TR';
    if (region === 'US') return 'US';
    return 'GLOBAL';
  }

  private resolveBaseUrl(): string {
    const explicitBaseUrl = process.env.BINANCE_BASE_URL?.trim();
    if (explicitBaseUrl) {
      return explicitBaseUrl.replace(/\/+$/, '');
    }

    if (this.region === 'TR') {
      return 'https://www.binance.tr';
    }

    if (this.region === 'US') {
      return 'https://api.binance.us/api';
    }

    return 'https://api.binance.com/api';
  }

  private resolveMarketDataBaseUrl(): string {
    const explicitMarketDataUrl = process.env.BINANCE_MARKET_DATA_BASE_URL?.trim();
    if (explicitMarketDataUrl) {
      return explicitMarketDataUrl.replace(/\/+$/, '');
    }

    if (this.region === 'TR') {
      return 'https://api.binance.me';
    }

    return this.baseUrl;
  }

  private isTrRegion(): boolean {
    return this.region === 'TR';
  }

  private unwrapResponseData(payload: any): any {
    if (payload && typeof payload === 'object' && 'code' in payload && 'data' in payload) {
      return payload.data;
    }
    return payload;
  }

  private toTrSymbol(symbol: string): string {
    if (symbol.includes('_')) return symbol;
    const quoteAssets = ['FDUSD', 'USDT', 'USDC', 'BUSD', 'TRY', 'BTC', 'ETH', 'BNB'];
    const quote = quoteAssets.find((item) => symbol.endsWith(item));
    if (!quote) return symbol;
    const base = symbol.slice(0, symbol.length - quote.length);
    return `${base}_${quote}`;
  }

  async getCandles(symbol: string, interval: string = '1m', limit: number = 100): Promise<Kline[]> {
    try {
      const marketSymbol = this.isTrRegion() ? this.toTrSymbol(symbol).replace('_', '') : symbol;
      const endpoint = this.isTrRegion()
        ? `${this.marketDataBaseUrl}/api/v1/klines`
        : `${this.baseUrl}/v3/klines`;

      // Use real Binance API
      const response = await axios.get(endpoint, {
        params: { symbol: marketSymbol, interval, limit },
      });

      const candlesPayload = this.unwrapResponseData(response.data);
      const candles = Array.isArray(candlesPayload) ? candlesPayload : [];

      return candles.map((candle: any[]) => ({
        openTime: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[7],
        closeTime: candle[6],
        quoteAssetVolume: candle[7],
        numberOfTrades: candle[8],
        takerBuyBaseAssetVolume: candle[9],
        takerBuyQuoteAssetVolume: candle[10],
      }));
    } catch (error) {
      console.warn(`[Binance] Error fetching candles for ${symbol}, using demo data:`, error);
      // Return demo data
      return this.generateDemoCandles(symbol, limit);
    }
  }

  async getOrderBook(symbol: string, limit: number = 20): Promise<OrderBook | null> {
    try {
      const marketSymbol = this.isTrRegion() ? this.toTrSymbol(symbol).replace('_', '') : symbol;
      const endpoint = this.isTrRegion()
        ? `${this.marketDataBaseUrl}/api/v3/depth`
        : `${this.baseUrl}/v3/depth`;

      const response = await axios.get(endpoint, {
        params: { symbol: marketSymbol, limit },
      });

      const payload = this.unwrapResponseData(response.data) || {};

      return {
        symbol,
        bids: payload.bids || [],
        asks: payload.asks || [],
        timestamp: Date.now(),
      };
    } catch (error) {
      console.warn(`[Binance] Error fetching order book for ${symbol}, using demo data`);
      return this.generateDemoOrderBook(symbol);
    }
  }

  async getCurrentPrice(symbol: string): Promise<number | null> {
    try {
      const marketSymbol = this.isTrRegion() ? this.toTrSymbol(symbol).replace('_', '') : symbol;
      const endpoint = this.isTrRegion()
        ? `${this.marketDataBaseUrl}/api/v3/ticker/price`
        : `${this.baseUrl}/v3/ticker/price`;

      const response = await axios.get(endpoint, {
        params: { symbol: marketSymbol },
      });

      const payload = this.unwrapResponseData(response.data);

      return parseFloat(payload?.price);
    } catch (error) {
      console.warn(`[Binance] Error fetching price for ${symbol}, using demo data`);
      return this.getBasePriceForSymbol(symbol);
    }
  }

  private hmacSha256(message: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(message).digest('hex');
  }

  async placeLimitOrder(symbol: string, side: 'BUY' | 'SELL', quantity: number, price: number) {
    if (this.isDemoMode) {
      console.log(`[Binance DEMO] LIMIT order: ${side} ${quantity} ${symbol} @ ${price}`);
      return {
        orderId: Math.floor(Math.random() * 1000000),
        symbol,
        side,
        quantity,
        price,
        status: 'NEW',
        timestamp: Date.now(),
      };
    }

    try {
      if (this.isTrRegion()) {
        const timestamp = Date.now();
        const trSymbol = this.toTrSymbol(symbol);
        const trSide = side === 'BUY' ? 0 : 1;
        const params = `symbol=${trSymbol}&side=${trSide}&type=1&quantity=${quantity}&price=${price}&recvWindow=5000&timestamp=${timestamp}`;
        const signature = this.hmacSha256(params, this.apiSecret);
        const url = `${this.baseUrl}/open/v1/orders?${params}&signature=${signature}`;

        const response = await axios.post(url, null, {
          headers: { 'X-MBX-APIKEY': this.apiKey },
        });

        const data = this.unwrapResponseData(response.data) || response.data;
        console.log(`[Binance TR LIVE] ✅ LIMIT order executed: ${side} ${quantity} ${symbol} @ ${price}`);
        return data;
      }

      const timestamp = Date.now();
      const params = `symbol=${symbol}&side=${side}&type=LIMIT&timeInForce=GTC&quantity=${quantity}&price=${price}&timestamp=${timestamp}`;
      const signature = this.hmacSha256(params, this.apiSecret);
      const url = `${this.baseUrl}/v3/order?${params}&signature=${signature}`;

      // Use `null` as the POST body to avoid sending an extra empty JSON body
      // which can sometimes alter how the Binance API counts parameters.
      const response = await axios.post(url, null, {
        headers: { 'X-MBX-APIKEY': this.apiKey },
      });

      console.log(`[Binance LIVE] ✅ LIMIT order executed: ${side} ${quantity} ${symbol} @ ${price}`);
      return response.data;
    } catch (error: any) {
      console.error(`[Binance] Error placing limit order:`, error.response?.data || error.message);
      // If API returns permission or invalid key errors, switch to demo mode
      const errCode = error?.response?.data?.code;
      if (errCode === -2015 || errCode === -2014 || errCode === -1022) {
        console.warn('[Binance] Detected API permission/invalid key error, switching to DEMO mode to avoid further live orders');
        this.setDemoMode(true);
      }
      return null;
    }
  }

  async placeMarketOrder(symbol: string, side: 'BUY' | 'SELL', quantity: number) {
    if (this.isDemoMode) {
      console.log(`[Binance DEMO] MARKET order: ${side} ${quantity} ${symbol}`);
      const price = await this.getCurrentPrice(symbol) || this.getBasePriceForSymbol(symbol);
      return {
        orderId: Math.floor(Math.random() * 1000000),
        symbol,
        side,
        quantity,
        price,
        status: 'FILLED',
        timestamp: Date.now(),
      };
    }

    try {
      if (this.isTrRegion()) {
        const timestamp = Date.now();
        const trSymbol = this.toTrSymbol(symbol);
        const trSide = side === 'BUY' ? 0 : 1;
        const params = `symbol=${trSymbol}&side=${trSide}&type=2&quantity=${quantity}&recvWindow=5000&timestamp=${timestamp}`;
        const signature = this.hmacSha256(params, this.apiSecret);
        const url = `${this.baseUrl}/open/v1/orders?${params}&signature=${signature}`;

        const response = await axios.post(url, null, {
          headers: { 'X-MBX-APIKEY': this.apiKey },
        });

        const data = this.unwrapResponseData(response.data) || response.data;
        console.log(`[Binance TR LIVE] ✅ MARKET order executed: ${side} ${quantity} ${symbol}`);
        return data;
      }

      const timestamp = Date.now();
      const params = `symbol=${symbol}&side=${side}&type=MARKET&quantity=${quantity}&timestamp=${timestamp}`;
      const signature = this.hmacSha256(params, this.apiSecret);
      const url = `${this.baseUrl}/v3/order?${params}&signature=${signature}`;

      const response = await axios.post(url, null, {
        headers: { 'X-MBX-APIKEY': this.apiKey },
      });

      console.log(`[Binance LIVE] ✅ MARKET order executed: ${side} ${quantity} ${symbol}`);
      return response.data;
    } catch (error: any) {
      console.error(`[Binance] Error placing market order:`, error.response?.data || error.message);
      const errCode = error?.response?.data?.code;
      if (errCode === -2015 || errCode === -2014 || errCode === -1022) {
        console.warn('[Binance] Detected API permission/invalid key error, switching to DEMO mode to avoid further live orders');
        this.setDemoMode(true);
      }
      return null;
    }
  }

  async getOpenOrders(symbol: string) {
    return [];
  }

  async cancelOrder(symbol: string, orderId: number) {
    return { symbol, orderId, status: 'CANCELLED' };
  }

  async getAccountBalance() {
    if (this.isDemoMode) {
      return {
        balances: [
          { asset: 'USDT', free: '10000', locked: '0' },
          { asset: 'ETH', free: '1.5', locked: '0' },
        ],
      };
    }

    try {
      if (this.isTrRegion()) {
        const timestamp = Date.now();
        const params = `recvWindow=5000&timestamp=${timestamp}`;
        const signature = this.hmacSha256(params, this.apiSecret);
        const url = `${this.baseUrl}/open/v1/account/spot?${params}&signature=${signature}`;

        const response = await axios.get(url, {
          headers: { 'X-MBX-APIKEY': this.apiKey },
        });

        const accountData = this.unwrapResponseData(response.data) || {};
        const balances = Array.isArray(accountData.accountAssets)
          ? accountData.accountAssets.map((asset: any) => ({
              asset: asset.asset,
              free: asset.free,
              locked: asset.locked,
            }))
          : [];

        this.lastApiError = null;
        return {
          ...accountData,
          balances,
        };
      }

      const timestamp = Date.now();
      const params = `timestamp=${timestamp}`;
      const signature = this.hmacSha256(params, this.apiSecret);
      const url = `${this.baseUrl}/v3/account?${params}&signature=${signature}`;

      const response = await axios.get(url, {
        headers: { 'X-MBX-APIKEY': this.apiKey },
      });

      this.lastApiError = null;

      return response.data;
    } catch (error: any) {
      const details = error.response?.data || error.message;
      this.lastApiError = typeof details === 'string' ? details : JSON.stringify(details);
      console.error(`[Binance] Error fetching account balance:`, details);
      return null;
    }
  }

  async getTradeHistory(symbol: string, limit: number = 100) {
    return [];
  }

  // Demo data generators
  private generateDemoCandles(symbol: string, limit: number): Kline[] {
    const candles: Kline[] = [];
    let basePrice = this.getBasePriceForSymbol(symbol);
    const now = Date.now();
    const interval = 60000; // 1 minute

    for (let i = limit - 1; i >= 0; i--) {
      const openTime = now - i * interval;
      const open = basePrice;
      const change = (Math.random() - 0.5) * basePrice * 0.02; // ±1% random change
      basePrice = basePrice + change;
      const high = Math.max(open, basePrice) * (1 + Math.random() * 0.005  );
      const low = Math.min(open, basePrice) * (1 - Math.random() * 0.005);
      const close = low + Math.random() * (high - low);

      candles.push({
        openTime,
        open: open.toFixed(8),
        high: high.toFixed(8),
        low: low.toFixed(8),
        close: close.toFixed(8),
        volume: (Math.random() * 1000 + 100).toFixed(4),
        closeTime: openTime + interval - 1,
        quoteAssetVolume: (Math.random() * 1000000).toFixed(2),
        numberOfTrades: Math.floor(Math.random() * 100 + 10),
        takerBuyBaseAssetVolume: (Math.random() * 500).toFixed(4),
        takerBuyQuoteAssetVolume: (Math.random() * 500000).toFixed(2),
      });
    }

    return candles;
  }

  private generateDemoOrderBook(symbol: string): OrderBook {
    const midPrice = this.getBasePriceForSymbol(symbol);
    const bids: [string, string][] = [];
    const asks: [string, string][] = [];

    for (let i = 1; i <= 10; i++) {
      bids.push([
        (midPrice * (1 - i * 0.001)).toFixed(8),
        (Math.random() * 10).toFixed(4),
      ]);
      asks.push([
        (midPrice * (1 + i * 0.001)).toFixed(8),
        (Math.random() * 10).toFixed(4),
      ]);
    }

    return {
      symbol,
      bids,
      asks,
      timestamp: Date.now(),
    };
  }

  private getBasePriceForSymbol(symbol: string): number {
    const prices: Record<string, number> = {
      'ETHUSDT': 2400,
      'BTCUSDT': 45000,
      'BNBUSDT': 650,
      'ADAUSDT': 1.2,
      'SOLUSDT': 105,
      'XRPUSDT': 3.2,
    };
    return prices[symbol] || 100;
  }
}

export const binanceClient = new BinanceAPIClient();
