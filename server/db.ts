import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

let db: any = null;
let pool: any = null;

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')) {
  try {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle(pool, { schema });
    console.log('[DB] Connected to PostgreSQL database');
  } catch (error) {
    console.warn('[DB] Failed to connect to database, will use in-memory storage', error);
  }
} else {
  console.log('[DB] DATABASE_URL not set or using localhost, in-memory storage will be used');
}

export { pool, db };