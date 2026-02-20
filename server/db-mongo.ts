import mongoose from 'mongoose';

// Trade document schema
const tradeSchema = new mongoose.Schema({
  symbol: { type: String, required: true, index: true },
  side: { type: String, enum: ['BUY', 'SELL'], required: true },
  entryPrice: { type: Number, required: true },
  exitPrice: { type: Number, default: null },
  quantity: { type: Number, required: true },
  strategy: { type: String, required: true },
  confidence: { type: Number, min: 0, max: 1 },
  pnl: { type: Number, default: 0 },
  pnlPercent: { type: Number, default: 0 },
  status: { type: String, enum: ['OPEN', 'CLOSED', 'STOPPED_OUT'], default: 'OPEN' },
  stopLoss: { type: Number, default: null },
  takeProfit: { type: Number, default: null },
  openedAt: { type: Date, default: Date.now, index: true },
  closedAt: { type: Date, default: null },
  notes: { type: String, default: '' },
});

// Motif evolution schema
const motifSchema = new mongoose.Schema({
  symbol: { type: String, required: true, index: true },
  strategy: { type: String, required: true },
  pattern: { type: String, required: true },
  performance: { type: Number, default: 0.5 },
  mutations: { type: Number, default: 0 },
  successRate: { type: Number, default: 0 },
  totalApplied: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  history: [
    {
      timestamp: Date,
      performance: Number,
      mutation: String,
    },
  ],
});

// Portfolio metrics schema
const metricsSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now, index: true },
  totalPnl: { type: Number, default: 0 },
  winRate: { type: Number, default: 0 },
  sharpeRatio: { type: Number, default: 0 },
  maxDrawdown: { type: Number, default: 0 },
  activePositions: { type: Number, default: 0 },
  totalTrades: { type: Number, default: 0 },
  coinBreakdown: {
    type: Map,
    of: {
      trades: Number,
      pnl: Number,
      winRate: Number,
    },
  },
});

// Market rotation snapshot schema
const marketSnapshotSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now, index: true },
  topCoins: [
    {
      symbol: String,
      volume24h: Number,
      volatility: Number,
      liquidityScore: Number,
      allocation: Number,
    },
  ],
});

// Initialize models
let Trade: mongoose.Model<any>;
let Motif: mongoose.Model<any>;
let Metrics: mongoose.Model<any>;
let MarketSnapshot: mongoose.Model<any>;

export function initializeModels() {
  Trade = mongoose.model('Trade', tradeSchema);
  Motif = mongoose.model('Motif', motifSchema);
  Metrics = mongoose.model('Metrics', metricsSchema);
  MarketSnapshot = mongoose.model('MarketSnapshot', marketSnapshotSchema);
}

export { Trade, Motif, Metrics, MarketSnapshot };

// Database connection
export async function connectMongoDB(): Promise<void> {
  const mongoUrl = process.env.MONGODB_URL || process.env.DATABASE_URL;
  
  if (!mongoUrl) {
    console.warn('[MongoDB] No connection string found - using in-memory cache');
    return;
  }

  try {
    await mongoose.connect(mongoUrl);
    console.log('[MongoDB] Connected successfully');
    initializeModels();
  } catch (error) {
    console.error('[MongoDB] Connection failed:', error);
  }
}

// Data access layer
export class DatabaseService {
  static async recordTrade(tradeData: any): Promise<any> {
    try {
      if (!Trade) return null;
      const trade = new Trade(tradeData);
      return await trade.save();
    } catch (error) {
      console.error('[DatabaseService] Error recording trade:', error);
      return null;
    }
  }

  static async getTrades(symbol?: string, limit: number = 100): Promise<any[]> {
    try {
      if (!Trade) return [];
      const query = symbol ? { symbol } : {};
      return await Trade.find(query).sort({ openedAt: -1 }).limit(limit);
    } catch (error) {
      console.error('[DatabaseService] Error fetching trades:', error);
      return [];
    }
  }

  static async recordMotif(motifData: any): Promise<any> {
    try {
      if (!Motif) return null;
      const motif = new Motif(motifData);
      return await motif.save();
    } catch (error) {
      console.error('[DatabaseService] Error recording motif:', error);
      return null;
    }
  }

  static async updateMotif(motifId: string, updates: any): Promise<any> {
    try {
      if (!Motif) return null;
      return await Motif.findByIdAndUpdate(motifId, updates, { new: true });
    } catch (error) {
      console.error('[DatabaseService] Error updating motif:', error);
      return null;
    }
  }

  static async recordMetrics(metricsData: any): Promise<any> {
    try {
      if (!Metrics) return null;
      const metrics = new Metrics(metricsData);
      return await metrics.save();
    } catch (error) {
      console.error('[DatabaseService] Error recording metrics:', error);
      return null;
    }
  }

  static async getMetricsHistory(days: number = 30): Promise<any[]> {
    try {
      if (!Metrics) return [];
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      return await Metrics.find({ timestamp: { $gte: startDate } }).sort({ timestamp: 1 });
    } catch (error) {
      console.error('[DatabaseService] Error fetching metrics history:', error);
      return [];
    }
  }

  static async recordMarketSnapshot(snapshotData: any): Promise<any> {
    try {
      if (!MarketSnapshot) return null;
      const snapshot = new MarketSnapshot(snapshotData);
      return await snapshot.save();
    } catch (error) {
      console.error('[DatabaseService] Error recording market snapshot:', error);
      return null;
    }
  }
}
