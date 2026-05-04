import "server-only";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Check .env.local");
}

const globalForDb = globalThis as unknown as {
  client?: Client;
};

const client =
  globalForDb.client ??
  createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.client = client;
}

await client.execute("PRAGMA foreign_keys = ON");

export const db = drizzle(client, {
  schema,
  logger: process.env.NODE_ENV !== "production",
});