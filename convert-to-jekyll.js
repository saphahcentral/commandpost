// convert-to-jekyll.js - SAFE, ROBUST master JEKYLL convert service

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// =====================
// CONFIG
// =====================

const TOKEN = process.env.ELIYAH_SAPHAH;
const USER = "saphahcentral";

if (!TOKEN) {
  console.error("❌ ERROR: Missing ELIYAH_SAPHAH secret");
  process.exit(1);
}

// Load repos from JSON (ONLY SOURCE OF TRUTH)
const REPO_FILE = path.join(__dirname, "repos-public.json");

if (!fs.existsSync(REPO_FILE)) {
  console.error("❌ ERROR: repos-public.json not found");
  process.exit(1);
}

const REPOS = JSON.parse(fs.readFileSync(REPO_FILE, "utf8")).repos;

const WORKDIR = "/tmp";

// =====================
// HELPERS
// =====================

function hasFrontMatter(content) {
  return /^---\s*\n[\s\S]*?\n---\s*\n/.test(content);
}

function isRootIndex(filePath, root) {
  return path.relative(root, filePath).replace(/\\/g, "/").toLowerCase() === "index.html";
}

function extractTitle(content) {
  const match = content.match(/<title>(.*?)<\/title>/i);
  return match ? match[1].trim() : "Untitled Page";
}

function generateFrontMatter(title) {
  return `---
layout: default
title: "${title}"
---

`;
}

// =====================
// FILE CONVERSION
// =====================

function convertFile(filePath, rootDir) {
  const content = fs.readFileSync(filePath, "utf8");

  if (hasFrontMatter(content)) return;
  if (isRootIndex(filePath, rootDir)) return;

  const title = extractTitle(content);

  const updated = generateFrontMatter(title) + content;

  fs.writeFileSync(filePath, updated, "utf8");
}

// =====================
// DIRECTORY WALK
// =====================

function walk(dir, rootDir) {
  const IGNORE = [".git", ".github", "node_modules", "_site"];

  const items = fs.readdirSync(dir);

  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      if (!IGNORE.includes(item)) {
        walk(full, rootDir);
      }
    } else if (item.endsWith(".html")) {
      convertFile(full, rootDir);
    }
  }
}

// =====================
// MAIN EXECUTION
// =====================

console.log("\n🚀 STARTING JEKYLL CONVERSION\n");

for (const repo of REPOS) {
  console.log("\n==============================");
  console.log("📦 REPO:", repo);

  const repoPath = path.join(WORKDIR, repo);

  if (fs.existsSync(repoPath)) {
    fs.rmSync(repoPath, { recursive: true, force: true });
  }

  const cloneUrl = `https://${TOKEN}@github.com/${USER}/${repo}.git`;

  try {
    console.log("⬇️ Cloning repo...");
    execSync(`git clone ${cloneUrl} ${repoPath}`, { stdio: "inherit" });

    console.log("🔄 Converting HTML files...");
    walk(repoPath, repoPath);

    console.log("⚙️ Configuring git...");
    execSync(`git config user.name "eliyah-bot"`, { cwd: repoPath });
    execSync(`git config user.email "bot@saphahcentral.local"`, { cwd: repoPath });

    execSync(`git add .`, { cwd: repoPath });

    const status = execSync(`git status --porcelain`, { cwd: repoPath })
      .toString()
      .trim();

    if (!status) {
      console.log("⏩ No changes detected");
      continue;
    }

    console.log("💾 Committing changes...");
    execSync(`git commit -m "Jekyll front matter conversion"`, { cwd: repoPath });

    console.log("🚀 Pushing changes...");
    execSync(`git push`, { cwd: repoPath });

    console.log("✅ SUCCESS:", repo);

  } catch (err) {
    console.error("❌ FAILED:", repo);
    console.error(err.message);
  }
}

console.log("\n🎉 ALL REPOSITORIES COMPLETE\n");
