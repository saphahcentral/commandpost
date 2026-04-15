// convert-to-jekyll.js - FULL ENFORCEMENT MODE (CLEAN + REBUILD + PUSH)

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// =====================
// CONFIG
// =====================

const TOKEN = process.env.ELIYAH_SAPHAH;
const USER = "saphahcentral";

// 🔥 HARD ISOLATION WORKSPACE (NEVER touches repos/ or old tmp state)
const WORKDIR = "/tmp/jekyll-run";

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

console.log("TOKEN OK:", !!TOKEN);
console.log("REPOS:", repos.length);

// =====================
// SAFE EXEC
// =====================

function run(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, stdio: "pipe" }).toString();
  } catch (e) {
    console.error("\n❌ FAILED CMD:", cmd);
    console.error("\nSTDOUT:\n", e.stdout?.toString());
    console.error("\nSTDERR:\n", e.stderr?.toString());
    throw e;
  }
}

// =====================
// GLOBAL CLEANUP (CRITICAL FIX)
// =====================

function hardCleanWorkspace() {
  if (fs.existsSync(WORKDIR)) {
    fs.rmSync(WORKDIR, { recursive: true, force: true });
  }
  fs.mkdirSync(WORKDIR, { recursive: true });
}

// =====================
// CLONE (NO LEGACY REFS)
// =====================

function cloneRepo(repo, dir) {
  const url = `https://${TOKEN}@github.com/${USER}/${repo}.git`;

  console.log("📥 Cloning:", repo);
  run(`git clone ${url} ${dir}`);

  // Ensure push auth
  run(
    `git remote set-url origin https://${TOKEN}@github.com/${USER}/${repo}.git`,
    dir
  );

  // 🔥 ELIMINATE SUBMODULE TRIGGERS INSIDE CLONE
  if (fs.existsSync(path.join(dir, ".gitmodules"))) {
    console.log("🧹 Removing .gitmodules (safety strip)");
    fs.rmSync(path.join(dir, ".gitmodules"));
  }

  // Remove any nested submodule metadata if it exists
  const gitModulesPath = path.join(dir, ".git", "modules");
  if (fs.existsSync(gitModulesPath)) {
    fs.rmSync(gitModulesPath, { recursive: true, force: true });
  }
}

// =====================
// FRONT MATTER
// =====================

function stripFM(content) {
  return content.replace(/^---\s*\n[\s\S]*?\n---\n?/m, "");
}

function title(content) {
  return (content.match(/<title>(.*?)<\/title>/i) || [])[1] || "Untitled";
}

function buildFM(repo, filePath, content) {
  const isIndex = filePath.replace(/\\/g, "/").endsWith("index.html");

  if (isIndex) {
    return `---\nlayout: default\ntitle: "HOME"\npermalink: "/"\ncanonical_url: "https://${USER}.github.io/${repo}/index.html"\n---\n\n`;
  }

  return `---\nlayout: default\ntitle: "${title(content)}"\n---\n\n`;
}

// =====================
// WALK FILES (ALL HTML)
// =====================

function walk(repo, dir) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      if (item === ".git") continue; // IMPORTANT
      walk(repo, full);
    } else if (item.endsWith(".html")) {
      let content = fs.readFileSync(full, "utf8");

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

(async function main() {
  hardCleanWorkspace(); // 🔥 GUARANTEED CLEAN START

  for (const repo of repos) {
    console.log("\n==============================");
    console.log("🚀 PROCESSING:", repo);

    const dir = path.join(WORKDIR, repo);

    try {
      cloneRepo(repo, dir);

      console.log("🛠️ Converting...");
      walk(repo, dir);

      run(`git config user.name "eliyah-bot"`, dir);
      run(`git config user.email "bot@saphahcentral.local"`, dir);

      run(`git add .`, dir);

      const changes = run(`git status --porcelain`, dir).trim();

      if (!changes) {
        console.log("⚠️ NO CHANGES");
        continue;
      }

      run(`git commit -m "Jekyll full rebuild (clean workspace pass)"`, dir);

      console.log("📤 Pushing...");
      run(`git push origin HEAD`, dir);

      console.log("✅ SUCCESS:", repo);

    } catch (e) {
      console.error("❌ FAILED:", repo);
    }
  }

  console.log("\n🎉 DONE ALL REPOS");
})();
