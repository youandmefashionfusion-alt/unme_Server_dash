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

function loadProjectEnv() {
  const root = process.cwd();
  loadEnvFile(path.join(root, ".env"));
  loadEnvFile(path.join(root, ".env.local"));
}

function parseBoolean(value, fallback) {
  if (value == null || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

function normalizeUrl(url) {
  if (!url || typeof url !== "string") return "";
  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";
    const normalizedPath = decodeURIComponent(parsed.pathname).replace(/\/{2,}/g, "/");
    const host = parsed.host.toLowerCase();
    return `https://${host}${normalizedPath}`;
  } catch {
    return String(url).trim();
  }
}

function extractPublicIdFromCloudinaryUrl(url) {
  if (!url || typeof url !== "string") return "";
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("cloudinary.com")) return "";

    const marker = "/upload/";
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return "";

    let tail = parsed.pathname.slice(idx + marker.length);
    tail = decodeURIComponent(tail).replace(/^\/+/, "");
    if (!tail) return "";

    const segments = tail.split("/").filter(Boolean);
    if (segments.length === 0) return "";

    const versionIdx = segments.findIndex((part) => /^v\d+$/.test(part));
    const publicSegments =
      versionIdx >= 0 ? segments.slice(versionIdx + 1) : segments.slice(Math.min(1, segments.length));

    if (publicSegments.length === 0) return "";
    const joined = publicSegments.join("/");
    return joined.replace(/\.[^.\/]+$/, "");
  } catch {
    return "";
  }
}

function resolveMappingPath() {
  if (process.env.MAPPING_FILE) {
    const custom = path.isAbsolute(process.env.MAPPING_FILE)
      ? process.env.MAPPING_FILE
      : path.join(process.cwd(), process.env.MAPPING_FILE);
    return custom;
  }

  const folder = path.join(process.cwd(), "backups", "cloudinary-to-s3");
  if (!fs.existsSync(folder)) return "";

  const mappingFiles = fs
    .readdirSync(folder)
    .filter((name) => /^mapping-.*\.ndjson$/i.test(name))
    .map((name) => path.join(folder, name));

  if (mappingFiles.length === 0) return "";

  mappingFiles.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return mappingFiles[0];
}

function loadMapping(mappingPath) {
  const raw = fs.readFileSync(mappingPath, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);

  const urlMap = new Map();
  const publicIdMap = new Map();
  let totalLines = 0;
  let acceptedLines = 0;

  for (const line of lines) {
    totalLines += 1;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }

    const status = String(parsed.status || "").toLowerCase();
    if (!["uploaded", "skipped"].includes(status)) continue;

    const cloudinaryUrl = normalizeUrl(parsed.cloudinaryUrl || "");
    const s3Url = String(parsed.s3Url || "").trim();
    const publicId = String(parsed.publicId || "").trim();

    if (!s3Url) continue;
    acceptedLines += 1;

    if (cloudinaryUrl) {
      urlMap.set(cloudinaryUrl, s3Url);
    }
    if (publicId) {
      publicIdMap.set(publicId, s3Url);
    }
  }

  return {
    totalLines,
    acceptedLines,
    urlMap,
    publicIdMap,
  };
}

function createRunFiles() {
  const outputDir = path.join(process.cwd(), "backups", "cloudinary-to-s3");
  fs.mkdirSync(outputDir, { recursive: true });

  const runId = new Date().toISOString().replace(/[.:]/g, "-");
  const summaryFilePath = path.join(outputDir, `db-migration-summary-${runId}.json`);
  const missesFilePath = path.join(outputDir, `db-migration-misses-${runId}.ndjson`);

  fs.writeFileSync(missesFilePath, "", "utf8");

  return { runId, outputDir, summaryFilePath, missesFilePath };
}

function appendMiss(missesFilePath, payload) {
  fs.appendFileSync(missesFilePath, `${JSON.stringify(payload)}\n`, "utf8");
}

function createResolver(urlMap, publicIdMap) {
  return (url) => {
    if (!url || typeof url !== "string") {
      return { matched: false, nextUrl: url, reason: "invalid_url" };
    }

    if (!url.includes("cloudinary.com")) {
      return { matched: false, nextUrl: url, reason: "not_cloudinary" };
    }

    const normalized = normalizeUrl(url);
    if (urlMap.has(normalized)) {
      return { matched: true, nextUrl: urlMap.get(normalized), reason: "url_map" };
    }

    const publicId = extractPublicIdFromCloudinaryUrl(url);
    if (publicId && publicIdMap.has(publicId)) {
      return { matched: true, nextUrl: publicIdMap.get(publicId), reason: "public_id_map" };
    }

    return { matched: false, nextUrl: url, reason: "mapping_not_found", publicId };
  };
}

function updateImageArray(images, resolver, misses, context) {
  if (!Array.isArray(images)) return { changed: false, value: images, replacedCount: 0 };

  let changed = false;
  let replacedCount = 0;

  const next = images.map((item, index) => {
    if (typeof item === "string") {
      const resolved = resolver(item);
      if (resolved.matched && resolved.nextUrl !== item) {
        changed = true;
        replacedCount += 1;
        return resolved.nextUrl;
      }
      if (!resolved.matched && item.includes("cloudinary.com")) {
        misses.push({
          ...context,
          field: `${context.field}[${index}]`,
          url: item,
          reason: resolved.reason,
          publicId: resolved.publicId || null,
        });
      }
      return item;
    }

    if (item && typeof item === "object" && typeof item.url === "string") {
      const resolved = resolver(item.url);
      if (resolved.matched && resolved.nextUrl !== item.url) {
        changed = true;
        replacedCount += 1;
        return { ...item, url: resolved.nextUrl };
      }
      if (!resolved.matched && item.url.includes("cloudinary.com")) {
        misses.push({
          ...context,
          field: `${context.field}[${index}].url`,
          url: item.url,
          reason: resolved.reason,
          publicId: resolved.publicId || null,
        });
      }
      return item;
    }

    return item;
  });

  return { changed, value: next, replacedCount };
}

function updateStringUrl(value, resolver, misses, context) {
  if (typeof value !== "string") return { changed: false, value, replacedCount: 0 };

  const resolved = resolver(value);
  if (resolved.matched && resolved.nextUrl !== value) {
    return { changed: true, value: resolved.nextUrl, replacedCount: 1 };
  }

  if (!resolved.matched && value.includes("cloudinary.com")) {
    misses.push({
      ...context,
      field: context.field,
      url: value,
      reason: resolved.reason,
      publicId: resolved.publicId || null,
    });
  }

  return { changed: false, value, replacedCount: 0 };
}

async function processCollection({
  db,
  collectionName,
  handler,
  dryRun,
  missesFilePath,
  maxMissesLogged,
}) {
  const collection = db.collection(collectionName);
  const cursor = collection.find({});

  let docsScanned = 0;
  let docsChanged = 0;
  let urlsChanged = 0;
  let misses = 0;
  let missesLogged = 0;

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    docsScanned += 1;

    const localMisses = [];
    const { changed, update, replacedCount } = handler(doc, localMisses);

    misses += localMisses.length;
    for (const miss of localMisses) {
      if (missesLogged < maxMissesLogged) {
        appendMiss(missesFilePath, miss);
        missesLogged += 1;
      }
    }

    if (!changed) continue;

    docsChanged += 1;
    urlsChanged += replacedCount;

    if (!dryRun) {
      await collection.updateOne({ _id: doc._id }, { $set: update });
    }
  }

  return { docsScanned, docsChanged, urlsChanged, misses, missesLogged };
}

async function main() {
  loadProjectEnv();

  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    console.error("MONGO_URL is required.");
    process.exit(1);
  }

  const mappingPath = resolveMappingPath();
  if (!mappingPath || !fs.existsSync(mappingPath)) {
    console.error(
      "Mapping file not found. Provide MAPPING_FILE or run backup first to generate mapping-*.ndjson"
    );
    process.exit(1);
  }

  const dryRun = parseBoolean(process.env.DB_MIGRATION_DRY_RUN, true);
  const maxMissesLogged = Number.parseInt(process.env.DB_MIGRATION_MAX_MISSES || "1000", 10);

  const mapping = loadMapping(mappingPath);
  if (mapping.urlMap.size === 0 && mapping.publicIdMap.size === 0) {
    console.error("No usable mapping records found (uploaded/skipped).");
    process.exit(1);
  }

  const resolver = createResolver(mapping.urlMap, mapping.publicIdMap);
  const { runId, summaryFilePath, missesFilePath } = createRunFiles();

  console.log("Starting DB URL migration...");
  console.log(`Run ID: ${runId}`);
  console.log(`Dry Run: ${dryRun}`);
  console.log(`Mapping: ${mappingPath}`);
  console.log(`Mapping lines: ${mapping.totalLines}, usable: ${mapping.acceptedLines}`);

  await mongoose.connect(mongoUrl);
  const db = mongoose.connection.db;

  const summary = {
    runId,
    dryRun,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    mapping: {
      filePath: mappingPath,
      totalLines: mapping.totalLines,
      acceptedLines: mapping.acceptedLines,
      urlMapSize: mapping.urlMap.size,
      publicIdMapSize: mapping.publicIdMap.size,
    },
    collections: {},
    totals: {
      docsScanned: 0,
      docsChanged: 0,
      urlsChanged: 0,
      misses: 0,
    },
    output: {
      summaryFilePath,
      missesFilePath,
    },
  };

  const jobs = [
    {
      name: "products",
      handler: (doc, misses) => {
        const update = {};
        let changed = false;
        let replacedCount = 0;

        const imagesResult = updateImageArray(doc.images, resolver, misses, {
          collection: "products",
          docId: String(doc._id),
          field: "images",
        });
        if (imagesResult.changed) {
          update.images = imagesResult.value;
          changed = true;
          replacedCount += imagesResult.replacedCount;
        }

        if (Array.isArray(doc.ratings)) {
          let ratingsChanged = false;
          const nextRatings = doc.ratings.map((rating, idx) => {
            if (!rating || typeof rating !== "object" || typeof rating.image !== "string") {
              return rating;
            }
            const resolved = resolver(rating.image);
            if (resolved.matched && resolved.nextUrl !== rating.image) {
              ratingsChanged = true;
              replacedCount += 1;
              return { ...rating, image: resolved.nextUrl };
            }
            if (!resolved.matched && rating.image.includes("cloudinary.com")) {
              misses.push({
                collection: "products",
                docId: String(doc._id),
                field: `ratings[${idx}].image`,
                url: rating.image,
                reason: resolved.reason,
                publicId: resolved.publicId || null,
              });
            }
            return rating;
          });
          if (ratingsChanged) {
            update.ratings = nextRatings;
            changed = true;
          }
        }

        return { changed, update, replacedCount };
      },
    },
    {
      name: "collections",
      handler: (doc, misses) => {
        const imagesResult = updateImageArray(doc.images, resolver, misses, {
          collection: "collections",
          docId: String(doc._id),
          field: "images",
        });
        return {
          changed: imagesResult.changed,
          update: imagesResult.changed ? { images: imagesResult.value } : {},
          replacedCount: imagesResult.replacedCount,
        };
      },
    },
    {
      name: "salecollections",
      handler: (doc, misses) => {
        const imagesResult = updateImageArray(doc.images, resolver, misses, {
          collection: "salecollections",
          docId: String(doc._id),
          field: "images",
        });
        return {
          changed: imagesResult.changed,
          update: imagesResult.changed ? { images: imagesResult.value } : {},
          replacedCount: imagesResult.replacedCount,
        };
      },
    },
    {
      name: "blogs",
      handler: (doc, misses) => {
        const imageResult = updateStringUrl(doc.image, resolver, misses, {
          collection: "blogs",
          docId: String(doc._id),
          field: "image",
        });
        return {
          changed: imageResult.changed,
          update: imageResult.changed ? { image: imageResult.value } : {},
          replacedCount: imageResult.replacedCount,
        };
      },
    },
    {
      name: "banners",
      handler: (doc, misses) => {
        const update = {};
        let changed = false;
        let replacedCount = 0;

        const fields = [
          "desktopBanners",
          "mobileBanners",
          "otherBanners",
          "budgetBanners",
        ];

        for (const field of fields) {
          if (!Array.isArray(doc[field])) continue;
          let fieldChanged = false;
          const next = doc[field].map((item, idx) => {
            if (!item || typeof item !== "object" || typeof item.url !== "string") return item;
            const resolved = resolver(item.url);
            if (resolved.matched && resolved.nextUrl !== item.url) {
              fieldChanged = true;
              replacedCount += 1;
              return { ...item, url: resolved.nextUrl };
            }
            if (!resolved.matched && item.url.includes("cloudinary.com")) {
              misses.push({
                collection: "banners",
                docId: String(doc._id),
                field: `${field}[${idx}].url`,
                url: item.url,
                reason: resolved.reason,
                publicId: resolved.publicId || null,
              });
            }
            return item;
          });
          if (fieldChanged) {
            update[field] = next;
            changed = true;
          }
        }

        return { changed, update, replacedCount };
      },
    },
    {
      name: "users",
      handler: (doc, misses) => {
        if (!doc.image || typeof doc.image !== "object") {
          return { changed: false, update: {}, replacedCount: 0 };
        }
        const imageResult = updateStringUrl(doc.image.url, resolver, misses, {
          collection: "users",
          docId: String(doc._id),
          field: "image.url",
        });
        if (!imageResult.changed) {
          return { changed: false, update: {}, replacedCount: 0 };
        }
        return {
          changed: true,
          update: { image: { ...doc.image, url: imageResult.value } },
          replacedCount: imageResult.replacedCount,
        };
      },
    },
  ];

  for (const job of jobs) {
    console.log(`Processing collection: ${job.name}`);
    const stats = await processCollection({
      db,
      collectionName: job.name,
      handler: job.handler,
      dryRun,
      missesFilePath,
      maxMissesLogged,
    });
    summary.collections[job.name] = stats;
    summary.totals.docsScanned += stats.docsScanned;
    summary.totals.docsChanged += stats.docsChanged;
    summary.totals.urlsChanged += stats.urlsChanged;
    summary.totals.misses += stats.misses;
  }

  summary.finishedAt = new Date().toISOString();
  fs.writeFileSync(summaryFilePath, JSON.stringify(summary, null, 2), "utf8");

  await mongoose.disconnect();

  console.log("DB URL migration completed.");
  console.log(`Dry Run: ${dryRun}`);
  console.log(`Docs scanned: ${summary.totals.docsScanned}`);
  console.log(`Docs changed: ${summary.totals.docsChanged}`);
  console.log(`URLs changed: ${summary.totals.urlsChanged}`);
  console.log(`Misses: ${summary.totals.misses}`);
  console.log(`Summary: ${summaryFilePath}`);
  console.log(`Misses: ${missesFilePath}`);
}

main().catch(async (error) => {
  console.error("DB migration crashed:", error);
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  } catch {
    // noop
  }
  process.exit(1);
});
