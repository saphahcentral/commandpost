// convert-to-jekyll.js - FINAL HARDENED VERSION (AUTH FIXED + CLEAN OPS)

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// =====================
// CONFIG
// =====================

const TOKEN = process.env.ELIYAH_SAPHAH;
const USER = "saphahcentral";
const WORKDIR = "/tmp";

if (!TOKEN) {
  console.error("❌ Missing ELIYAH_SAPHAH token");
  process.exit(1);
}

// =====================
// LOAD REPOS
// =====================

const repos = JSON.parse(
  fs.readFileSync(path.join(__dirname, "repos-public.json"), "utf8")
).repos;

console.log("TOKEN PRESENT:", !!TOKEN);
console.log("REPOS COUNT:", repos.length);

// =====================
// SAFE EXEC
// =====================

function run(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, stdio: "pipe" }).toString();
  } catch (e) {
    console.error("\n❌ COMMAND FAILED:");
    console.error(cmd);
    console.error("\nSTDOUT:\n", e.stdout?.toString());
    console.error("\nSTDERR:\n", e.stderr?.toString());
    throw e;
  }
}

// =====================
// CLONE (FIXED AUTH)
// =====================

function cloneRepo(repo, dir) {
  const authUrl = `https://${TOKEN}@github.com/${USER}/${repo}.git`;

  console.log("🔗 Clone URL (token hidden)");

  run(`git clone ${authUrl} ${dir}`);

  // Ensure push also works
  run(
    `git remote set-url origin https://${TOKEN}@github.com/${USER}/${repo}.git`,
    dir
  );
}

// =====================
// FRONT MATTER LOGIC
// =====================

function hasFM(content) {
  return /^---\s*\n[\s\S]*?\n---/m.test(content);
}

function isIndex(file) {
  return file.replace(/\\/g, "/").endsWith("index.html");
}

function extractTitle(content) {
  return (content.match(/<title>(.*?)<\/title>/i) || [])[1] || "Untitled";
}

// =====================
// FILE WALKER
// =====================

function walk(dir) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      if (![".git", "node_modules", "_site"].includes(item)) {
        walk(full);
      }
    } else if (item.endsWith(".html")) {
      let content = fs.readFileSync(full, "utf8");

      if (hasFM(content)) continue;
      if (isIndex(full)) continue;

      const fm = `---\nlayout: default\ntitle: "${extractTitle(content)}"\n---\n\n`;

      fs.writeFileSync(full, fm + content);
      console.log("UPDATED:", full);
    }
  }
}

// =====================
// MAIN PROCESS
// =====================

for (const repo of repos) {
  console.log("\n==============================");
  console.log("🚀 PROCESSING:", repo);

  const dir = path.join(WORKDIR, repo);

  // Clean workspace
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  try {
    // Clone
    console.log("📥 Cloning...");
    cloneRepo(repo, dir);

    // Skip repos with .nojekyll
    if (fs.existsSync(path.join(dir, ".nojekyll"))) {
      console.log("⏭️ SKIPPED (.nojekyll present)");
      continue;
    }

    // Convert
    console.log("🛠️ Converting...");
    walk(dir);

    // Git identity
    run(`git config user.name "eliyah-bot"`, dir);
    run(`git config user.email "bot@saphahcentral.local"`, dir);

    // Stage
    run(`git add .`, dir);

    // Detect changes
    const changes = run(`git status --porcelain`, dir).trim();

    if (!changes) {
      console.log("⚠️ NO CHANGES");
      continue;
    }

    console.log("📝 Changes detected");

    // Commit
    run(`git commit -m "Jekyll conversion (automated safe pass)"`, dir);

    // Push
    console.log("📤 Pushing...");
    run(`git push origin HEAD`, dir);

    console.log("✅ SUCCESS:", repo);

  } catch (err) {
    console.error("❌ FAILED:", repo);
  }
}

console.log("\n🎉 DONE ALL REPOS");
