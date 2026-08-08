"use strict";

const { MongoClient } = require("mongodb");

let client = null;
let db = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Connect to MongoDB with exponential backoff so the app can start before the
// database is fully ready (for example during docker compose up).
async function connect() {
  const url = process.env.MONGO_URL;
  const dbName = process.env.MONGO_DB;

  if (!url) {
    throw new Error("MONGO_URL environment variable is required");
  }
  if (!dbName) {
    throw new Error("MONGO_DB environment variable is required");
  }

  const maxDelayMs = 10000;
  let attempt = 0;

  // Retry forever with capped backoff. The container orchestrator decides when
  // to give up by restarting the app, so we keep trying to reach the db.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt += 1;
    try {
      const candidate = new MongoClient(url, {
        serverSelectionTimeoutMS: 5000,
      });
      await candidate.connect();
      // Force a round trip so we fail fast if the server is not actually ready.
      await candidate.db(dbName).command({ ping: 1 });

      client = candidate;
      db = candidate.db(dbName);
      console.log(`Connected to MongoDB (database "${dbName}")`);
      return db;
    } catch (err) {
      const delay = Math.min(maxDelayMs, 500 * 2 ** (attempt - 1));
      console.warn(
        `MongoDB connection attempt ${attempt} failed: ${err.message}. ` +
          `Retrying in ${delay}ms`
      );
      await sleep(delay);
    }
  }
}

// Create indexes we rely on. Creating an index is idempotent in MongoDB, so
// calling this on every boot is safe.
async function ensureIndexes() {
  if (!db) {
    throw new Error("Database not connected");
  }
  await db.collection("books").createIndex({ status: 1 });
  console.log("Ensured index on books.status");
}

function getDb() {
  if (!db) {
    throw new Error("Database not connected");
  }
  return db;
}

// Lightweight readiness check used by the /healthz endpoint.
async function ping() {
  if (!db) {
    return false;
  }
  try {
    await db.command({ ping: 1 });
    return true;
  } catch (err) {
    return false;
  }
}

async function close() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

module.exports = { connect, ensureIndexes, getDb, ping, close };
