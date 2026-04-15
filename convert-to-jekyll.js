// convert-to-jekyll.js - master JEKYLL convert service

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const TOKEN = process.env.ELIYAH_SAPHAH;
const GITHUB_USER = "saphahcentral";

// 🔒 LOAD SAFE REPO LIST
const repoConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, "repos-public.json"), "utf8")
);

const REPOS = repoConfig.repos;

const WORKDIR = path.join(__dirname, "repos");

if (!fs.existsSync(WORKDIR)) {
  fs.mkdirSync(WORKDIR);
}

// ---------- HELPERS ----------

function hasFrontMatter(content) {
  return /^---\s*\n[\s\S]*?\n---\s*\n/.test(content);
}

function extractTitle(content) {
  const match = content.match(/<title>(.*?)<\/title>/i);
  return match ? match[1].replace(/"/g, '\\"').trim() : "Untitled Page";
}

// 🔥 SKIP root index.html completely
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

  // ✅ Skip if already converted
  if (hasFrontMatter(content)) return;

  // 🔥 Skip root index
  if (isRootIndex(filePath, rootDir)) {
    console.log(`⏩ Skipped root index: ${filePath}`);
    return;
  }

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
  console.log(`✅ Converted: ${filePath}`);
}

function walk(dir, rootDir) {
  const IGNORE = [".git", ".github", "node_modules", "_site"];

  const items = fs.readdirSync(dir);

  items.forEach((item) => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!IGNORE.includes(item)) {
        walk(fullPath, rootDir);
      }
    } else if (item.toLowerCase().endsWith(".html")) {
      convertFile(fullPath, rootDir);
    }
  });
}

// ---------- PROCESS REPOS ----------

REPOS.forEach((repo) => {
  console.log(`\n🚀 Processing: ${repo}`);

  const repoPath = path.join(WORKDIR, repo);

  // clean previous clone
  if (fs.existsSync(repoPath)) {
    fs.rmSync(repoPath, { recursive: true, force: true });
  }

  const cloneUrl = `https://${TOKEN}@github.com/${GITHUB_USER}/${repo}.git`;

  try {
    execSync(`git clone ${cloneUrl}`, { cwd: WORKDIR, stdio: "inherit" });

    walk(repoPath, repoPath);

    execSync(`git config user.name "eliyah-bot"`, { cwd: repoPath });
    execSync(`git config user.email "bot@saphahcentral.local"`, { cwd: repoPath });

    execSync(`git add .`, { cwd: repoPath });

    try {
      execSync(
        `git commit -m "Safe Jekyll conversion (public repos only, dom6027 excluded)"`,
        { cwd: repoPath }
      );
      execSync(`git push`, { cwd: repoPath });
      console.log(`✅ Updated: ${repo}`);
    } catch {
      console.log(`⏩ No changes: ${repo}`);
    }

  } catch (err) {
    console.error(`❌ Failed: ${repo}`);
  }
});

console.log("\n🎉 SAFE PUBLIC REPOS PROCESSED.");
