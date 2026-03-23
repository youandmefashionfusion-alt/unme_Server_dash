#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { v2: cloudinary } = require("cloudinary");
const {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");

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

function parseInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function sanitizeSegment(value) {
  return String(value || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
}

function getExtension(resource) {
  if (resource?.format) return String(resource.format).toLowerCase();
  try {
    const pathname = new URL(resource?.secure_url || "").pathname;
    const ext = path.extname(pathname).replace(".", "").toLowerCase();
    return ext || "";
  } catch {
    return "";
  }
}

function buildS3Key(resource, s3Prefix, resourceType) {
  const cleanPrefix = sanitizeSegment(s3Prefix || "cloudinary-backup");
  const cleanType = sanitizeSegment(resourceType || "image");
  const publicId = String(resource?.public_id || "unknown")
    .replace(/^\/+/, "")
    .replace(/\.\./g, "");
  const ext = getExtension(resource);
  let key = `${cleanPrefix}/${cleanType}/${publicId}`;
  if (ext && !key.toLowerCase().endsWith(`.${ext}`)) {
    key = `${key}.${ext}`;
  }
  return key;
}

function createS3Client() {
  const region = process.env.AWS_S3_REGION || process.env.AWS_REGION;
  const accessKeyId =
    process.env.AWS_S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.AWS_S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

  return new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

function getS3PublicBaseUrl() {
  const custom = process.env.AWS_S3_PUBLIC_BASE_URL;
  if (custom) return custom.replace(/\/$/, "");

  const bucket = process.env.AWS_S3_BUCKET || process.env.AWS_S3_BUCKET_NAME;
  const region = process.env.AWS_S3_REGION || process.env.AWS_REGION;
  return `https://${bucket}.s3.${region}.amazonaws.com`;
}

function getRequiredConfig() {
  const cfg = {
    cloudName:
      process.env.CLOUDINARY_CLOUD_NAME ||
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
    cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
    s3Bucket: process.env.AWS_S3_BUCKET || process.env.AWS_S3_BUCKET_NAME,
    s3Region: process.env.AWS_S3_REGION || process.env.AWS_REGION,
    s3AccessKeyId:
      process.env.AWS_S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
    s3SecretAccessKey:
      process.env.AWS_S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
  };

  const missing = [];
  if (!cfg.cloudName) missing.push("CLOUDINARY_CLOUD_NAME or NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME");
  if (!cfg.cloudinaryApiKey) missing.push("CLOUDINARY_API_KEY");
  if (!cfg.cloudinaryApiSecret) missing.push("CLOUDINARY_API_SECRET");
  if (!cfg.s3Bucket) missing.push("AWS_S3_BUCKET or AWS_S3_BUCKET_NAME");
  if (!cfg.s3Region) missing.push("AWS_S3_REGION or AWS_REGION");
  if (!cfg.s3AccessKeyId) missing.push("AWS_S3_ACCESS_KEY_ID or AWS_ACCESS_KEY_ID");
  if (!cfg.s3SecretAccessKey) missing.push("AWS_S3_SECRET_ACCESS_KEY or AWS_SECRET_ACCESS_KEY");

  return { cfg, missing };
}

async function withRetries(taskFn, maxAttempts, baseDelayMs) {
  let attempt = 0;
  let lastError;
  while (attempt < maxAttempts) {
    try {
      return await taskFn();
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt >= maxAttempts) break;
      const delay = baseDelayMs * attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

async function objectExists(s3Client, bucket, key) {
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    return true;
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode;
    const notFound =
      status === 404 ||
      error?.name === "NotFound" ||
      error?.Code === "NotFound" ||
      error?.code === "NotFound";
    if (notFound) return false;
    throw error;
  }
}

async function downloadAsBuffer(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Download failed (${response.status}) for ${url}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timeoutId);
  }
}

function createOutputFiles() {
  const outputDir = path.join(process.cwd(), "backups", "cloudinary-to-s3");
  fs.mkdirSync(outputDir, { recursive: true });

  const runId = new Date().toISOString().replace(/[.:]/g, "-");
  const mappingFilePath = path.join(outputDir, `mapping-${runId}.ndjson`);
  const summaryFilePath = path.join(outputDir, `summary-${runId}.json`);

  fs.writeFileSync(mappingFilePath, "", "utf8");

  return { runId, outputDir, mappingFilePath, summaryFilePath };
}

function appendMapping(mappingFilePath, payload) {
  fs.appendFileSync(mappingFilePath, `${JSON.stringify(payload)}\n`, "utf8");
}

async function listCloudinaryResources({ resourceType, nextCursor, pageSize, prefix }) {
  const options = {
    resource_type: resourceType,
    type: "upload",
    max_results: pageSize,
  };
  if (nextCursor) options.next_cursor = nextCursor;
  if (prefix) options.prefix = prefix;

  return cloudinary.api.resources(options);
}

async function main() {
  loadProjectEnv();

  const { cfg, missing } = getRequiredConfig();
  if (missing.length > 0) {
    console.error("Missing required env vars:");
    for (const item of missing) console.error(`- ${item}`);
    process.exit(1);
  }

  const s3Bucket = cfg.s3Bucket;
  const s3Prefix = sanitizeSegment(process.env.S3_BACKUP_PREFIX || "cloudinary-backup");
  const cloudinaryPrefix = sanitizeSegment(process.env.CLOUDINARY_PREFIX || "");
  const pageSize = parseInteger(process.env.BACKUP_PAGE_SIZE, 500, 1, 500);
  const maxAssets = parseInteger(process.env.BACKUP_MAX_ASSETS, 0, 0, 100000000);
  const timeoutMs = parseInteger(process.env.BACKUP_DOWNLOAD_TIMEOUT_MS, 60000, 5000, 300000);
  const dryRun = parseBoolean(process.env.BACKUP_DRY_RUN, false);
  const skipExisting = parseBoolean(process.env.BACKUP_SKIP_EXISTING, true);
  const resourceTypes = String(process.env.CLOUDINARY_RESOURCE_TYPES || "image,video,raw")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  cloudinary.config({
    cloud_name: cfg.cloudName,
    api_key: cfg.cloudinaryApiKey,
    api_secret: cfg.cloudinaryApiSecret,
  });

  const s3Client = createS3Client();
  const s3PublicBaseUrl = getS3PublicBaseUrl();
  const { runId, mappingFilePath, summaryFilePath } = createOutputFiles();

  const startedAt = new Date();
  const summary = {
    runId,
    startedAt: startedAt.toISOString(),
    finishedAt: null,
    durationSeconds: null,
    config: {
      s3Bucket,
      s3Prefix,
      cloudinaryPrefix: cloudinaryPrefix || null,
      pageSize,
      maxAssets,
      resourceTypes,
      dryRun,
      skipExisting,
      timeoutMs,
    },
    totals: {
      discovered: 0,
      uploaded: 0,
      skipped: 0,
      failed: 0,
      bytesUploaded: 0,
      planned: 0,
    },
    byResourceType: {},
    output: {
      mappingFilePath,
      summaryFilePath,
    },
  };

  for (const resourceType of resourceTypes) {
    summary.byResourceType[resourceType] = {
      discovered: 0,
      uploaded: 0,
      skipped: 0,
      failed: 0,
      bytesUploaded: 0,
      planned: 0,
    };
  }

  console.log("Starting Cloudinary -> S3 backup...");
  console.log(`Run ID: ${runId}`);
  console.log(`S3 Bucket: ${s3Bucket}`);
  console.log(`S3 Prefix: ${s3Prefix}`);
  console.log(`Resource Types: ${resourceTypes.join(", ")}`);
  if (cloudinaryPrefix) {
    console.log(`Cloudinary Prefix Filter: ${cloudinaryPrefix}`);
  }
  if (dryRun) {
    console.log("DRY RUN ENABLED: files will not be uploaded.");
  }

  let processedCount = 0;
  let stopByLimit = false;

  for (const resourceType of resourceTypes) {
    let nextCursor = undefined;
    console.log(`\nScanning Cloudinary resource_type=${resourceType}`);

    do {
      const page = await withRetries(
        () =>
          listCloudinaryResources({
            resourceType,
            nextCursor,
            pageSize,
            prefix: cloudinaryPrefix || undefined,
          }),
        4,
        1000
      );

      const resources = Array.isArray(page?.resources) ? page.resources : [];
      nextCursor = page?.next_cursor;

      summary.totals.discovered += resources.length;
      summary.byResourceType[resourceType].discovered += resources.length;

      for (const resource of resources) {
        if (maxAssets > 0 && processedCount >= maxAssets) {
          stopByLimit = true;
          break;
        }

        processedCount += 1;
        const s3Key = buildS3Key(resource, s3Prefix, resourceType);
        const cloudinaryUrl = resource?.secure_url || "";
        const baseMapping = {
          timestamp: new Date().toISOString(),
          resourceType,
          publicId: resource?.public_id || null,
          bytes: resource?.bytes || null,
          format: resource?.format || null,
          cloudinaryUrl: cloudinaryUrl || null,
          s3Key,
          s3Url: `${s3PublicBaseUrl}/${encodeURI(s3Key)}`,
        };

        if (!cloudinaryUrl) {
          summary.totals.failed += 1;
          summary.byResourceType[resourceType].failed += 1;
          appendMapping(mappingFilePath, {
            ...baseMapping,
            status: "failed",
            error: "Missing secure_url in Cloudinary resource",
          });
          continue;
        }

        try {
          if (!dryRun && skipExisting) {
            const exists = await objectExists(s3Client, s3Bucket, s3Key);
            if (exists) {
              summary.totals.skipped += 1;
              summary.byResourceType[resourceType].skipped += 1;
              appendMapping(mappingFilePath, {
                ...baseMapping,
                status: "skipped",
                reason: "already_exists_in_s3",
              });
              continue;
            }
          }

          if (dryRun) {
            summary.totals.planned += 1;
            summary.byResourceType[resourceType].planned += 1;
            appendMapping(mappingFilePath, {
              ...baseMapping,
              status: "planned",
            });
            continue;
          }

          const fileBuffer = await withRetries(
            () => downloadAsBuffer(cloudinaryUrl, timeoutMs),
            3,
            1000
          );

          await withRetries(
            () =>
              s3Client.send(
                new PutObjectCommand({
                  Bucket: s3Bucket,
                  Key: s3Key,
                  Body: fileBuffer,
                  ContentType: resource?.resource_type === "raw"
                    ? "application/octet-stream"
                    : undefined,
                })
              ),
            3,
            1000
          );

          summary.totals.uploaded += 1;
          summary.byResourceType[resourceType].uploaded += 1;
          summary.totals.bytesUploaded += fileBuffer.length;
          summary.byResourceType[resourceType].bytesUploaded += fileBuffer.length;

          appendMapping(mappingFilePath, {
            ...baseMapping,
            status: "uploaded",
            uploadedBytes: fileBuffer.length,
          });

          if (summary.totals.uploaded % 25 === 0) {
            console.log(
              `Uploaded ${summary.totals.uploaded} so far (failed: ${summary.totals.failed}, skipped: ${summary.totals.skipped})`
            );
          }
        } catch (error) {
          summary.totals.failed += 1;
          summary.byResourceType[resourceType].failed += 1;
          appendMapping(mappingFilePath, {
            ...baseMapping,
            status: "failed",
            error: error?.message || String(error),
          });
          console.error(
            `Failed: ${resourceType}/${resource?.public_id || "unknown"} -> ${error?.message || error}`
          );
        }
      }

      if (stopByLimit) break;
    } while (nextCursor);

    if (stopByLimit) break;
  }

  const finishedAt = new Date();
  summary.finishedAt = finishedAt.toISOString();
  summary.durationSeconds = Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000);
  summary.stoppedByMaxAssets = stopByLimit;

  fs.writeFileSync(summaryFilePath, JSON.stringify(summary, null, 2), "utf8");

  console.log("\nBackup completed.");
  console.log(`Uploaded: ${summary.totals.uploaded}`);
  console.log(`Skipped: ${summary.totals.skipped}`);
  console.log(`Failed: ${summary.totals.failed}`);
  console.log(`Discovered: ${summary.totals.discovered}`);
  console.log(`Bytes uploaded: ${summary.totals.bytesUploaded}`);
  console.log(`Mapping file: ${mappingFilePath}`);
  console.log(`Summary file: ${summaryFilePath}`);

  if (summary.totals.failed > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error("Backup script crashed:", error);
  process.exit(1);
});
