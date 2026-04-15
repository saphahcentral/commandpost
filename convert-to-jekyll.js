// convert-to-jekyll.js - FULL ENFORCEMENT MODE (CLEAN + REBUILD + PUSH)

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// =====================
// CONFIG
// =====================

const TOKEN = process.env.ELIYAH_SAPHAH;
const USER = "saphahcentral";
const WORKDIR = "/tmp/jekyll-run"; // 🔥 dedicated clean workspace

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
// CLEAN WORKDIR (CRITICAL)
// =====================

if (fs.existsSync(WORKDIR)) {
  fs.rmSync(WORKDIR, { recursive: true, force: true });
}
fs.mkdirSync(WORKDIR, { recursive: true });

// =====================
// CLONE WITH AUTH
// =====================

function cloneRepo(repo, dir) {
  const url = `https://${TOKEN}@github.com/${USER}/${repo}.git`;

  console.log("📥 Cloning:", repo);
  run(`git clone ${url} ${dir}`);

  // enforce auth for push
  run(
    `git remote set-url origin https://${TOKEN}@github.com/${USER}/${repo}.git`,
    dir
  );
}

// =====================
// FRONT MATTER BUILDER
// =====================

function stripFM(content) {
  return content.replace(/^---\s*\n[\s\S]*?\n---\n?/m, "");
}

function extractTitle(content) {
  return (content.match(/<title>(.*?)<\/title>/i) || [])[1] || "Untitled";
}

function buildFM(repo, filePath, content) {
  const isIndex = filePath.replace(/\\/g, "/").endsWith("index.html");

  if (isIndex) {
    return `---\nlayout: default\ntitle: "HOME"\npermalink: "/"\ncanonical_url: "https://${USER}.github.io/${repo}/index.html"\n---\n\n`;
  }

  return `---\nlayout: default\ntitle: "${extractTitle(content)}"\n---\n\n`;
}

// =====================
// WALK + PROCESS ALL HTML
// =====================

function walk(repo, dir) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      if (![".git", "node_modules", "_site"].includes(item)) {
        walk(repo, full);
      }
    } else if (item.endsWith(".html")) {
      let content = fs.readFileSync(full, "utf8");

      // 🔥 ALWAYS rebuild
      content = stripFM(content);

      const fm = buildFM(repo, full, content);

      fs.writeFileSync(full, fm + content);

      console.log("UPDATED:", full);
    }
  }
}

// =====================
// MAIN
// =====================

for (const repo of repos) {
  console.log("\n==============================");
  console.log("🚀 PROCESSING:", repo);

  const dir = path.join(WORKDIR, repo);

  try {
    // Clone fresh every time
    cloneRepo(repo, dir);

    // Convert ALL HTML
    console.log("🛠️ Converting ALL HTML...");
    walk(repo, dir);

    // Git identity
    run(`git config user.name "eliyah-bot"`, dir);
    run(`git config user.email "bot@saphahcentral.local"`, dir);

    // Stage everything
    run(`git add .`, dir);

    const changes = run(`git status --porcelain`, dir).trim();

    if (!changes) {
      console.log("⚠️ NO CHANGES AFTER REBUILD");
      continue;
    }

    console.log("📝 Changes detected");

    // Commit
    run(`git commit -m "Jekyll full enforcement pass (all HTML rebuilt)"`, dir);

    // Push using PAT
    console.log("📤 Pushing...");
    run(`git push origin HEAD`, dir);

    console.log("✅ SUCCESS:", repo);

  } catch (err) {
    console.error("❌ FAILED:", repo);
  }
}

console.log("\n🎉 DONE ALL REPOS");
