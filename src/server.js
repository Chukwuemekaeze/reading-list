"use strict";

const path = require("path");
const express = require("express");
const db = require("./db");
const booksRouter = require("./books");

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 8080;

app.use(express.json());

// Serve the static single-page UI.
app.use(express.static(path.join(__dirname, "..", "public")));

// Health check. Returns 200 only when Mongo is reachable.
app.get("/healthz", async (req, res) => {
  const ok = await db.ping();
  if (ok) {
    return res.status(200).json({ status: "ok" });
  }
  return res.status(503).json({ status: "unavailable" });
});

app.use("/api/books", booksRouter);

// JSON 404 for unknown API routes.
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Centralized error handler so route handlers can just call next(err).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  res.status(500).json({ error: "Internal server error" });
});

async function start() {
  await db.connect();
  await db.ensureIndexes();

  const server = app.listen(PORT, () => {
    console.log(`Reading List app listening on port ${PORT}`);
  });

  // Graceful shutdown so container stops are clean.
  const shutdown = async (signal) => {
    console.log(`Received ${signal}, shutting down`);
    server.close(async () => {
      await db.close();
      process.exit(0);
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
