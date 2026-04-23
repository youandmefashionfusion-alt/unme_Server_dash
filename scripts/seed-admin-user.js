#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

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

function normalizeMobile(value) {
  return String(value || "").replace(/\D/g, "").slice(-10);
}

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node scripts/seed-admin-user.js --mobile <10-digit> --email <email> --firstname <name> --password <password> [--lastname <name>] [--role admin]",
      "",
      "Example:",
      '  node scripts/seed-admin-user.js --mobile 8595810297 --email mayank@codexae.com --firstname Mayank --lastname Badal --password "Admin@123"',
    ].join("\n")
  );
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

  const mobile = normalizeMobile(args.mobile);
  const email = String(args.email || "").trim().toLowerCase();
  const firstname = String(args.firstname || "").trim();
  const lastname = String(args.lastname || "").trim();
  const password = String(args.password || "");
  const role = String(args.role || "admin").trim().toLowerCase();

  const dbUrl = process.env.MONGO_URL || process.env.MONGODB_URI;
  if (!dbUrl) {
    throw new Error("Missing MONGO_URL or MONGODB_URI in environment.");
  }

  if (!/^[6-9]\d{9}$/.test(mobile)) {
    throw new Error("Invalid mobile number. Use a valid 10-digit Indian mobile.");
  }
  if (!email || !email.includes("@")) {
    throw new Error("Invalid email.");
  }
  if (!firstname) {
    throw new Error("Firstname is required.");
  }
  if (!password || password.length < 6) {
    throw new Error("Password is required and must be at least 6 characters.");
  }

  await mongoose.connect(dbUrl);

  const now = new Date();
  const hashedPassword = await bcrypt.hash(password, 10);

  const usersCollection = mongoose.connection.collection("users");
  const query = { $or: [{ mobile }, { email }] };
  const update = {
    $set: {
      firstname,
      lastname,
      email,
      mobile,
      password: hashedPassword,
      role,
      isBlocked: false,
      updatedAt: now,
    },
    $setOnInsert: {
      createdAt: now,
    },
  };

  const result = await usersCollection.updateOne(query, update, { upsert: true });

  const action = result.upsertedId ? "created" : "updated";
  console.log(`Admin user ${action} successfully.`);
  console.log(`mobile: ${mobile}`);
  console.log(`email: ${email}`);
  console.log(`role: ${role}`);

  await mongoose.disconnect();
}

run()
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error("Seeder failed:", error.message || error);
    try {
      await mongoose.disconnect();
    } catch {
      // ignore disconnect failures
    }
    process.exit(1);
  });

