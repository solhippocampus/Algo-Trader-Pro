import type { UpdateBotConfigRequest, InsertTrade } from "@shared/schema";

export interface IStorage {
  getConfig(): Promise<any>;
  updateConfig(updates: UpdateBotConfigRequest): Promise<any>;
  
  getTrades(limit?: number): Promise<any[]>;
  insertTrade(trade: InsertTrade): Promise<any>;
  
  getStats(): Promise<{ totalTrades: number, winRate: number, totalPnl: number, activePositions: number }>;
}

// In-memory storage for development when database is not available
export class InMemoryStorage implements IStorage {
  private config: any = {
    id: 1,
    isRunning: false,
    apiEnabled: false,
    maxPositionSize: '100',
    stopLossPercentage: '5',
    strategyWeights: {
      marketMaking: 0.2,
      arbitrage: 0.2,
      momentum: 0.2,
      bayes: 0.2,
      rl: 0.2
    },
    updatedAt: new Date(),
  };

  private tradesList: any[] = [
    { id: 1, symbol: "BTCUSDT", side: "BUY", price: "45000.50", amount: "0.01", strategyUsed: "Momentum", confidenceScore: "85.5", pnl: "0.00", createdAt: new Date(Date.now() - 86400000) },
    { id: 2, symbol: "ETHUSDT", side: "SELL", price: "2400.10", amount: "0.5", strategyUsed: "Bayes + Monte Carlo", confidenceScore: "92.0", pnl: "12.50", createdAt: new Date(Date.now() - 43200000) },
    { id: 3, symbol: "SOLUSDT", side: "BUY", price: "105.20", amount: "10.0", strategyUsed: "Arbitrage", confidenceScore: "99.1", pnl: "5.20", createdAt: new Date(Date.now() - 3600000) },
  ];

  async getConfig() {
    return this.config;
  }

  async updateConfig(updates: UpdateBotConfigRequest) {
    this.config = { ...this.config, ...updates, updatedAt: new Date() };
    return this.config;
  }

  async getTrades(limit = 100) {
    return this.tradesList.slice(0, limit);
  }

  async insertTrade(trade: InsertTrade) {
    const newTrade = {
      id: this.tradesList.length + 1,
      ...trade,
      createdAt: new Date(),
    };
    this.tradesList.unshift(newTrade);
    return newTrade;
  }

  async getStats() {
    const total = this.tradesList.length;
    let winning = 0;
    let totalPnl = 0;
    
    for (const t of this.tradesList) {
      const pnl = parseFloat(t.pnl?.toString() || '0');
      if (pnl > 0) winning++;
      totalPnl += pnl;
    }
    
    return {
      totalTrades: total,
      winRate: total > 0 ? (winning / total) * 100 : 0,
      totalPnl,
      activePositions: total > 0 ? 1 : 0,
    };
  }
}

let storage: IStorage;

// Check if database is available
async function initStorage() {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.startsWith('file:')) {
      console.log('[Storage] Using In-Memory Storage (database not available or using SQLite)');
      storage = new InMemoryStorage();
    } else {
      const { db } = await import("./db");
      const { botConfig, trades } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");
      
      // Try to connect and use database
      storage = new DatabaseStorage(db, botConfig, trades, eq, desc);
      console.log('[Storage] Using Database Storage');
    }
  } catch (e) {
    console.log('[Storage] Database connection failed, using In-Memory Storage');
    storage = new InMemoryStorage();
  }
}

export class DatabaseStorage implements IStorage {
  constructor(private db: any, private botConfig: any, private trades: any, private eq: any, private desc: any) {}

  async getConfig() {
    let [config] = await this.db.select().from(this.botConfig).limit(1);
    if (!config) {
      [config] = await this.db.insert(this.botConfig).values({
        isRunning: false,
        apiEnabled: false,
        maxPositionSize: '100',
        stopLossPercentage: '5',
        strategyWeights: {
          marketMaking: 0.2,
          arbitrage: 0.2,
          momentum: 0.2,
          bayes: 0.2,
          rl: 0.2
        }
      }).returning();
    }
    return config;
  }

  async updateConfig(updates: UpdateBotConfigRequest) {
    const current = await this.getConfig();
    const [updated] = await this.db.update(this.botConfig)
      .set({ ...updates, updatedAt: new Date() })
      .where(this.eq(this.botConfig.id, current.id))
      .returning();
    return updated;
  }

  async getTrades(limit = 100) {
    return await this.db.select().from(this.trades).orderBy(this.desc(this.trades.createdAt)).limit(limit);
  }

  async insertTrade(trade: InsertTrade) {
    const [newTrade] = await this.db.insert(this.trades).values(trade).returning();
    return newTrade;
  }

  async getStats() {
    const allTrades = await this.db.select().from(this.trades);
    const totalTrades = allTrades.length;
    let winningTrades = 0;
    let totalPnl = 0;
    
    for (const t of allTrades) {
      const pnl = parseFloat(t.pnl?.toString() || '0');
      if (pnl > 0) winningTrades++;
      totalPnl += pnl;
    }
    
    return {
      totalTrades,
      winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
      totalPnl,
      activePositions: totalTrades > 0 ? 1 : 0
    };
  }
}

// Initialize storage
initStorage();

export { storage };