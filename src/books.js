"use strict";

const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("./db");

const router = express.Router();

const VALID_STATUSES = ["to-read", "reading", "done"];

function collection() {
  return getDb().collection("books");
}

// Shape a raw Mongo document into the JSON we expose to clients. We convert the
// ObjectId to a string so the frontend can treat _id as a plain value.
function serialize(doc) {
  return {
    _id: doc._id.toString(),
    title: doc.title,
    author: doc.author,
    status: doc.status,
    rating: doc.rating ?? null,
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };
}

// Validate and normalize a book payload. When partial is true (PUT) only the
// provided fields are checked, so callers can update a subset. Returns either
// { errors: [...] } or { value: {...normalized fields...} }.
function validate(body, { partial } = { partial: false }) {
  const errors = [];
  const value = {};

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { errors: ["Request body must be a JSON object"] };
  }

  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);

  // title
  if (has("title") || !partial) {
    if (typeof body.title !== "string" || body.title.trim() === "") {
      errors.push("title is required and must be a non-empty string");
    } else {
      value.title = body.title.trim();
    }
  }

  // author
  if (has("author") || !partial) {
    if (typeof body.author !== "string" || body.author.trim() === "") {
      errors.push("author is required and must be a non-empty string");
    } else {
      value.author = body.author.trim();
    }
  }

  // status
  if (has("status") || !partial) {
    if (!VALID_STATUSES.includes(body.status)) {
      errors.push(`status must be one of: ${VALID_STATUSES.join(", ")}`);
    } else {
      value.status = body.status;
    }
  }

  // rating (nullable, integer 0..5)
  if (has("rating")) {
    if (body.rating === null) {
      value.rating = null;
    } else if (
      typeof body.rating !== "number" ||
      !Number.isInteger(body.rating) ||
      body.rating < 0 ||
      body.rating > 5
    ) {
      errors.push("rating must be null or an integer between 0 and 5");
    } else {
      value.rating = body.rating;
    }
  } else if (!partial) {
    value.rating = null;
  }

  // tags (array of non-empty strings)
  if (has("tags")) {
    if (!Array.isArray(body.tags)) {
      errors.push("tags must be an array of strings");
    } else if (body.tags.some((t) => typeof t !== "string")) {
      errors.push("tags must contain only strings");
    } else {
      // Trim, drop empties, and de-duplicate.
      value.tags = [
        ...new Set(body.tags.map((t) => t.trim()).filter((t) => t !== "")),
      ];
    }
  } else if (!partial) {
    value.tags = [];
  }

  if (errors.length > 0) {
    return { errors };
  }
  return { value };
}

function parseId(id) {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  return new ObjectId(id);
}

// GET /api/books  (optional ?status= filter)
router.get("/", async (req, res, next) => {
  try {
    const query = {};
    const { status } = req.query;
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res
          .status(400)
          .json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
      }
      query.status = status;
    }
    const docs = await collection()
      .find(query)
      .sort({ created_at: -1 })
      .toArray();
    res.json(docs.map(serialize));
  } catch (err) {
    next(err);
  }
});

// POST /api/books
router.post("/", async (req, res, next) => {
  try {
    const { errors, value } = validate(req.body, { partial: false });
    if (errors) {
      return res.status(400).json({ errors });
    }
    const now = new Date().toISOString();
    const doc = { ...value, created_at: now, updated_at: now };
    const result = await collection().insertOne(doc);
    res.status(201).json(serialize({ ...doc, _id: result.insertedId }));
  } catch (err) {
    next(err);
  }
});

// GET /api/books/:id
router.get("/:id", async (req, res, next) => {
  try {
    const _id = parseId(req.params.id);
    if (!_id) {
      return res.status(400).json({ error: "Invalid book id" });
    }
    const doc = await collection().findOne({ _id });
    if (!doc) {
      return res.status(404).json({ error: "Book not found" });
    }
    res.json(serialize(doc));
  } catch (err) {
    next(err);
  }
});

// PUT /api/books/:id
router.put("/:id", async (req, res, next) => {
  try {
    const _id = parseId(req.params.id);
    if (!_id) {
      return res.status(400).json({ error: "Invalid book id" });
    }
    const { errors, value } = validate(req.body, { partial: true });
    if (errors) {
      return res.status(400).json({ errors });
    }
    if (Object.keys(value).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }
    value.updated_at = new Date().toISOString();
    const result = await collection().findOneAndUpdate(
      { _id },
      { $set: value },
      { returnDocument: "after" }
    );
    const updated = result && result.value ? result.value : result;
    if (!updated || !updated._id) {
      return res.status(404).json({ error: "Book not found" });
    }
    res.json(serialize(updated));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/books/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const _id = parseId(req.params.id);
    if (!_id) {
      return res.status(400).json({ error: "Invalid book id" });
    }
    const result = await collection().deleteOne({ _id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Book not found" });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
