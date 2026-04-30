#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const firstEqual = trimmed.indexOf("=");
    if (firstEqual <= 0) continue;

    const key = trimmed.slice(0, firstEqual).trim();
    let value = trimmed.slice(firstEqual + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    value = value.replace(/\\n/g, "\n");
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];
    if (!part.startsWith("--")) continue;

    if (part.includes("=")) {
      const [k, ...rest] = part.slice(2).split("=");
      args[k] = rest.join("=");
      continue;
    }

    const key = part.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }

  return args;
}

const toSeoHandle = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function ensureUniqueHandle(baseHandle, usedHandles) {
  const safeBase = baseHandle || "collection";
  let candidate = safeBase;
  let suffix = 2;

  while (usedHandles.has(candidate)) {
    candidate = `${safeBase}-${suffix}`;
    suffix += 1;
  }

  usedHandles.add(candidate);
  return candidate;
}

function toObjectId(value) {
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node scripts/migrate-seo-slugs.js [--apply] [--scope all|collections|sale]",
      "",
      "Examples:",
      "  node scripts/migrate-seo-slugs.js",
      "  node scripts/migrate-seo-slugs.js --apply",
      "  node scripts/migrate-seo-slugs.js --apply --scope=collections",
      "",
      "Notes:",
      "  - Default is dry-run (preview only).",
      "  - Use --apply to write changes to DB.",
    ].join("\n")
  );
}

async function migrateHandles(dbCollection, label, applyChanges) {
  const docs = await dbCollection
    .find({}, { projection: { title: 1, handle: 1, createdAt: 1 } })
    .sort({ createdAt: 1, _id: 1 })
    .toArray();

  const usedHandles = new Set();
  const changes = [];

  for (const doc of docs) {
    const currentHandle = String(doc?.handle || "").trim();
    const base = toSeoHandle(currentHandle || doc?.title || String(doc?._id || ""));
    const nextHandle = ensureUniqueHandle(base, usedHandles);

    if (currentHandle !== nextHandle) {
      changes.push({
        _id: doc._id,
        title: doc?.title || "",
        oldHandle: currentHandle,
        newHandle: nextHandle,
      });
    }
  }

  if (!applyChanges || changes.length === 0) {
    return {
      label,
      scanned: docs.length,
      updated: 0,
      changes,
      applied: false,
    };
  }

  const now = new Date();
  const ops = changes.map((item) => ({
    updateOne: {
      filter: { _id: item._id },
      update: {
        $set: {
          handle: item.newHandle,
          updatedAt: now,
        },
      },
    },
  }));

  const result = await dbCollection.bulkWrite(ops, { ordered: false });
  return {
    label,
    scanned: docs.length,
    updated: result.modifiedCount || 0,
    changes,
    applied: true,
  };
}

async function syncProductCollectionHandles(collectionChanges, applyChanges) {
  const products = mongoose.connection.collection("products");
  let totalMatched = 0;
  let totalModified = 0;

  for (const item of collectionChanges) {
    const collectionId = toObjectId(item._id);
    if (!collectionId) continue;

    const now = new Date();
    const batchOperations = [];

    // Always sync canonical collectionHandle for products tied by collectionName ObjectId.
    batchOperations.push(
      products.updateMany(
        { collectionName: collectionId },
        { $set: { collectionHandle: item.newHandle, updatedAt: now } }
      )
    );

    // Legacy: some products still store collectionName as old handle string.
    if (item.oldHandle && item.oldHandle !== item.newHandle) {
      batchOperations.push(
        products.updateMany(
          { collectionName: item.oldHandle },
          {
            $set: {
              collectionName: collectionId,
              collectionHandle: item.newHandle,
              updatedAt: now,
            },
          }
        )
      );

      batchOperations.push(
        products.updateMany(
          { collectionHandle: item.oldHandle },
          { $set: { collectionHandle: item.newHandle, updatedAt: now } }
        )
      );
    }

    if (!applyChanges) {
      const [idMatchCount, nameMatchCount, handleMatchCount] = await Promise.all([
        products.countDocuments({ collectionName: collectionId }),
        item.oldHandle
          ? products.countDocuments({ collectionName: item.oldHandle })
          : Promise.resolve(0),
        item.oldHandle
          ? products.countDocuments({ collectionHandle: item.oldHandle })
          : Promise.resolve(0),
      ]);
      totalMatched += idMatchCount + nameMatchCount + handleMatchCount;
      continue;
    }

    const results = await Promise.all(batchOperations);
    for (const result of results) {
      totalMatched += result.matchedCount || 0;
      totalModified += result.modifiedCount || 0;
    }
  }

  return {
    matchedProducts: totalMatched,
    modifiedProducts: applyChanges ? totalModified : 0,
    applied: applyChanges,
  };
}

async function run() {
  const rootDir = process.cwd();
  loadEnvFile(path.join(rootDir, ".env.local"));
  loadEnvFile(path.join(rootDir, ".env"));

  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    printUsage();
    process.exit(0);
  }

  const dbUrl = process.env.MONGO_URL || process.env.MONGODB_URI;
  if (!dbUrl) {
    throw new Error("Missing MONGO_URL or MONGODB_URI in environment.");
  }

  const applyChanges = Boolean(args.apply);
  const scopeRaw = String(args.scope || "all").trim().toLowerCase();
  const scope = ["all", "collections", "sale"].includes(scopeRaw)
    ? scopeRaw
    : "all";

  await mongoose.connect(dbUrl);

  const collections = mongoose.connection.collection("collections");
  const saleCollections = mongoose.connection.collection("salecollections");

  const summaries = [];

  if (scope === "all" || scope === "collections") {
    const collectionSummary = await migrateHandles(
      collections,
      "collections",
      applyChanges
    );
    summaries.push(collectionSummary);

    const productSyncSummary = await syncProductCollectionHandles(
      collectionSummary.changes,
      applyChanges
    );
    summaries.push({
      label: "products-collection-handle-sync",
      ...productSyncSummary,
    });
  }

  if (scope === "all" || scope === "sale") {
    const saleSummary = await migrateHandles(
      saleCollections,
      "sale-collections",
      applyChanges
    );
    summaries.push(saleSummary);
  }

  console.log(
    `\nSEO slug migration ${applyChanges ? "APPLY MODE" : "DRY-RUN MODE"}`
  );
  console.log("------------------------------------------------------------");
  for (const summary of summaries) {
    if (summary.label === "products-collection-handle-sync") {
      console.log(
        `${summary.label}: matched=${summary.matchedProducts}, modified=${summary.modifiedProducts}`
      );
      continue;
    }

    console.log(
      `${summary.label}: scanned=${summary.scanned}, handle-changes=${summary.changes.length}, updated=${summary.updated}`
    );
  }

  if (!applyChanges) {
    const previewRows = summaries
      .filter((item) => Array.isArray(item.changes))
      .flatMap((item) =>
        item.changes.slice(0, 20).map((change) => ({
          scope: item.label,
          id: String(change._id),
          title: change.title,
          oldHandle: change.oldHandle || "(empty)",
          newHandle: change.newHandle,
        }))
      );

    if (previewRows.length > 0) {
      console.log("\nPreview of first 20 handle changes:");
      console.table(previewRows);
    } else {
      console.log("\nNo handle changes required.");
    }

    console.log("\nTo apply these changes:");
    console.log("  node scripts/migrate-seo-slugs.js --apply");
  }

  await mongoose.disconnect();
}

run()
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error("Slug migration failed:", error.message || error);
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
    process.exit(1);
  });
