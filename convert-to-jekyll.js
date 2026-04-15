// convert-to-jekyll.js - SAFE, ROBUST master JEKYLL convert service

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// =====================
// TOKEN SAFETY CHECK
// =====================

const TOKEN = process.env.ELIYAH_SAPHAH;
const USER = "saphahcentral";

if (!TOKEN || TOKEN.length < 10) {
  console.error("❌ TOKEN MISSING OR INVALID");
  process.exit(1);
}

// =====================
// LOAD REPOS
// =====================

const repos = JSON.parse(
  fs.readFileSync(path.join(__dirname, "repos-public.json"), "utf8")
).repos;

const WORKDIR = "/tmp";

// =====================
// GIT CLONE (ROBUST FIX FOR 128 ERROR)
// =====================

function cloneRepo(repo, dir) {
  const url = `https://x-access-token:${TOKEN}@github.com/${USER}/${repo}.git`;

  try {
    execSync(`git clone ${url} ${dir}`, {
      stdio: "inherit"
    });
  } catch (err) {
    console.error(`❌ CLONE FAILED: ${repo}`);
    throw err;
  }
}

// =====================
// HTML CONVERSION
// =====================

function hasFrontMatter(content) {
  return /^---\s*\n[\s\S]*?\n---/m.test(content);
}

function isIndex(file) {
  return file.replace(/\\/g, "/").endsWith("index.html");
}

function titleFromHTML(content) {
  const m = content.match(/<title>(.*?)<\/title>/i);
  return m ? m[1] : "Untitled Page";
}

function walk(dir, root) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      if (![".git", "node_modules", "_site"].includes(item)) {
        walk(full, root);
      }
    } else if (item.endsWith(".html")) {
      let content = fs.readFileSync(full, "utf8");

      if (hasFrontMatter(content)) continue;
      if (isIndex(full)) continue;

      const title = titleFromHTML(content);

      const fm = `---
layout: default
title: "${title}"
---

`;

      fs.writeFileSync(full, fm + content, "utf8");
    }
  }
}

// =====================
// MAIN LOOP
// =====================

console.log("\n🚀 STARTING CONVERSION\n");

for (const repo of repos) {
  console.log("\n==============================");
  console.log("PROCESSING:", repo);

  const dir = path.join(WORKDIR, repo);

  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  try {
    console.log("⬇️ Cloning...");
    cloneRepo(repo, dir);

    console.log("🔄 Converting...");
    walk(dir, dir);

    console.log("⚙️ Git setup...");
    execSync(`git config user.name "eliyah-bot"`, { cwd: dir });
    execSync(`git config user.email "bot@saphahcentral.local"`, { cwd: dir });

    execSync(`git add .`, { cwd: dir });

    const changes = execSync(`git status --porcelain`, { cwd: dir })
      .toString()
      .trim();

    if (!changes) {
      console.log("⏩ NO CHANGES:", repo);
      continue;
    }

    execSync(`git commit -m "Jekyll conversion (robust)"`, { cwd: dir });
    execSync(`git push`, { cwd: dir });

    console.log("✅ SUCCESS:", repo);

  } catch (err) {
    console.error("❌ FAILED:", repo);
    console.error(err.message);
  }
}

console.log("\n🎉 DONE ALL REPOS\n");
