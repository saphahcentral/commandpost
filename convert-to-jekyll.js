// convert-to-jekyll.js - SAFE, ROBUST master JEKYLL convert service

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const TOKEN = process.env.ELIYAH_SAPHAH;
const GITHUB_USER = "saphahcentral";

// 🔒 LOAD REPOS FROM JSON (SINGLE SOURCE OF TRUTH)
const repoConfigPath = path.join(__dirname, "repos-public.json");

if (!fs.existsSync(repoConfigPath)) {
  console.error("❌ repos-public.json NOT FOUND");
  process.exit(1);
}

const REPOS = JSON.parse(fs.readFileSync(repoConfigPath, "utf8")).repos;

const WORKDIR = "/tmp";

// ---------- SAFETY HELPERS ----------

function hasFrontMatter(content) {
  return /^---\s*\n[\s\S]*?\n---\s*\n/.test(content);
}

function extractTitle(content) {
  const match = content.match(/<title>(.*?)<\/title>/i);
  return match ? match[1].replace(/"/g, '\\"').trim() : "Untitled Page";
}

function isRootIndex(filePath, rootDir) {
  const relative = path.relative(rootDir, filePath).replace(/\\/g, "/");
  return relative.toLowerCase() === "index.html";
}

function generatePermalink(filePath, rootDir) {
  let relative = path.relative(rootDir, filePath).replace(/\\/g, "/");
  return "/" + relative.replace(/index\.html$/i, "");
}

function convertFile(filePath, rootDir) {
  let content = fs.readFileSync(filePath, "utf8");

  if (hasFrontMatter(content)) return;
  if (isRootIndex(filePath, rootDir)) return;

  const title = extractTitle(content);
  const permalink = generatePermalink(filePath, rootDir);

  let frontMatter = `---
layout: default
title: "${title}"
`;

  if (permalink) {
    frontMatter += `permalink: "${permalink}"\n`;
  }

  frontMatter += `---\n\n`;

  fs.writeFileSync(filePath, frontMatter + content, "utf8");
}

// ---------- FILE WALK ----------

function walk(dir, rootDir) {
  const IGNORE = [".git", ".github", "node_modules", "_site"];

  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!IGNORE.includes(item)) {
        walk(fullPath, rootDir);
      }
    } else if (item.endsWith(".html")) {
      convertFile(fullPath, rootDir);
    }
  }
}

// ---------- MAIN LOOP ----------

for (const repo of REPOS) {
  console.log(`\n🚀 PROCESSING: ${repo}`);

  const repoPath = path.join(WORKDIR, repo);

  if (fs.existsSync(repoPath)) {
    fs.rmSync(repoPath, { recursive: true, force: true });
  }

  const cloneUrl = `https://${TOKEN}@github.com/${GITHUB_USER}/${repo}.git`;

  try {
    execSync(`git clone ${cloneUrl} ${repoPath}`, { stdio: "inherit" });

    walk(repoPath, repoPath);

    execSync(`git config user.name "eliyah-bot"`, { cwd: repoPath });
    execSync(`git config user.email "bot@saphahcentral.local"`, { cwd: repoPath });

    const status = execSync(`git status --porcelain`, { cwd: repoPath })
      .toString()
      .trim();

    if (!status) {
      console.log(`⏩ NO CHANGES: ${repo}`);
      continue;
    }

    execSync(`git add .`, { cwd: repoPath });
    execSync(`git commit -m "Safe Jekyll conversion (JSON-controlled)"`, {
      cwd: repoPath
    });
    execSync(`git push`, { cwd: repoPath });

    console.log(`✅ SUCCESS: ${repo}`);

  } catch (err) {
    console.error(`❌ FAILED: ${repo}`);
    console.error(err.message);
  }
}

console.log("\n🎉 ALL REPOS COMPLETE");
