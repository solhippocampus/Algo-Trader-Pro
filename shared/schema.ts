import { pgTable, text, serial, integer, boolean, timestamp, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const botConfig = pgTable("bot_config", {
  id: serial("id").primaryKey(),
  isRunning: boolean("is_running").default(false).notNull(),
  apiEnabled: boolean("api_enabled").default(false).notNull(),
  maxPositionSize: numeric("max_position_size").notNull().default('100'),
  stopLossPercentage: numeric("stop_loss_percentage").notNull().default('5'),
  strategyWeights: jsonb("strategy_weights").notNull().default({
    marketMaking: 0.2,
    arbitrage: 0.2,
    momentum: 0.2,
    bayes: 0.2,
    rl: 0.2
  }),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(), // 'BUY' or 'SELL'
  price: numeric("price").notNull(),
  amount: numeric("amount").notNull(),
  strategyUsed: text("strategy_used").notNull(),
  confidenceScore: numeric("confidence_score").notNull(),
  pnl: numeric("pnl"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const marketData = pgTable("market_data", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  price: numeric("price").notNull(),
  volatility: numeric("volatility"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertBotConfigSchema = createInsertSchema(botConfig).omit({ id: true, updatedAt: true });
export const insertTradeSchema = createInsertSchema(trades).omit({ id: true, createdAt: true });

export type BotConfig = typeof botConfig.$inferSelect;
export type InsertBotConfig = z.infer<typeof insertBotConfigSchema>;
export type UpdateBotConfigRequest = Partial<InsertBotConfig>;

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;

export type MarketData = typeof marketData.$inferSelect;

export interface BotStatusResponse {
  isRunning: boolean;
  activeStrategy: string | null;
  lastUpdate: string;
  binanceConnected: boolean;
}

export interface StatsResponse {
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  activePositions: number;
}
