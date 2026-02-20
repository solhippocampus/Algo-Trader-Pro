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
  private baseUrl = 'https://api.binance.com/api';
  private isDemoMode: boolean = process.env.TRADING_MODE === 'DEMO' || !process.env.BINANCE_API_KEY;

  constructor() {
    this.apiKey = process.env.BINANCE_API_KEY || '';
    this.apiSecret = process.env.BINANCE_SECRET_KEY || '';

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

  setDemoMode(demo: boolean) {
    this.isDemoMode = demo;
    console.log(`[Binance] Mode changed to: ${this.isDemoMode ? 'DEMO' : 'LIVE'}`);
  }

  async getCandles(symbol: string, interval: string = '1m', limit: number = 100): Promise<Kline[]> {
    try {
      // Use real Binance API
      const response = await axios.get(`${this.baseUrl}/v3/klines`, {
        params: { symbol, interval, limit },
      });

      return response.data.map((candle: any[]) => ({
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
      const response = await axios.get(`${this.baseUrl}/v3/depth`, {
        params: { symbol, limit },
      });

      return {
        symbol,
        bids: response.data.bids,
        asks: response.data.asks,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.warn(`[Binance] Error fetching order book for ${symbol}, using demo data`);
      return this.generateDemoOrderBook(symbol);
    }
  }

  async getCurrentPrice(symbol: string): Promise<number | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/v3/ticker/price`, {
        params: { symbol },
      });

      return parseFloat(response.data.price);
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
      const timestamp = Date.now();
      const params = `timestamp=${timestamp}`;
      const signature = this.hmacSha256(params, this.apiSecret);
      const url = `${this.baseUrl}/v3/account?${params}&signature=${signature}`;

      const response = await axios.get(url, {
        headers: { 'X-MBX-APIKEY': this.apiKey },
      });

      return response.data;
    } catch (error: any) {
      console.error(`[Binance] Error fetching account balance:`, error.response?.data || error.message);
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
