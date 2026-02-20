import { z } from 'zod';
import { insertBotConfigSchema, botConfig, trades, marketData } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  config: {
    get: {
      method: 'GET' as const,
      path: '/api/config' as const,
      responses: {
        200: z.custom<typeof botConfig.$inferSelect>(),
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/config' as const,
      input: insertBotConfigSchema.partial(),
      responses: {
        200: z.custom<typeof botConfig.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  bot: {
    start: {
      method: 'POST' as const,
      path: '/api/bot/start' as const,
      responses: {
        200: z.object({ isRunning: z.boolean(), message: z.string() }),
      },
    },
    stop: {
      method: 'POST' as const,
      path: '/api/bot/stop' as const,
      responses: {
        200: z.object({ isRunning: z.boolean(), message: z.string() }),
      },
    },
    status: {
      method: 'GET' as const,
      path: '/api/bot/status' as const,
      responses: {
        200: z.object({
          isRunning: z.boolean(),
          activeStrategy: z.string().nullable(),
          lastUpdate: z.string(),
          binanceConnected: z.boolean()
        }),
      },
    },
  },
  trades: {
    list: {
      method: 'GET' as const,
      path: '/api/trades' as const,
      responses: {
        200: z.array(z.custom<typeof trades.$inferSelect>()),
      },
    },
  },
  stats: {
    get: {
      method: 'GET' as const,
      path: '/api/stats' as const,
      responses: {
        200: z.object({
          totalTrades: z.number(),
          winRate: z.number(),
          totalPnl: z.number(),
          activePositions: z.number()
        }),
      },
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
