import { db } from "./db";
import { botConfig, trades, marketData, type InsertBotConfig, type UpdateBotConfigRequest, type InsertTrade } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getConfig(): Promise<typeof botConfig.$inferSelect>;
  updateConfig(updates: UpdateBotConfigRequest): Promise<typeof botConfig.$inferSelect>;
  
  getTrades(limit?: number): Promise<typeof trades.$inferSelect[]>;
  insertTrade(trade: InsertTrade): Promise<typeof trades.$inferSelect>;
  
  getStats(): Promise<{ totalTrades: number, winRate: number, totalPnl: number, activePositions: number }>;
}

export class DatabaseStorage implements IStorage {
  async getConfig() {
    let [config] = await db.select().from(botConfig).limit(1);
    if (!config) {
      [config] = await db.insert(botConfig).values({
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
    const [updated] = await db.update(botConfig)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(botConfig.id, current.id))
      .returning();
    return updated;
  }

  async getTrades(limit = 100) {
    return await db.select().from(trades).orderBy(desc(trades.createdAt)).limit(limit);
  }

  async insertTrade(trade: InsertTrade) {
    const [newTrade] = await db.insert(trades).values(trade).returning();
    return newTrade;
  }

  async getStats() {
    const allTrades = await db.select().from(trades);
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
      activePositions: totalTrades > 0 ? 1 : 0 // Mocking active positions
    };
  }
}

export const storage = new DatabaseStorage();