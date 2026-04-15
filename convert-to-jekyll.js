// convert-to-jekyll.js - SAFE, ROBUST master JEKYLL convert service

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const TOKEN = process.env.ELIYAH_SAPHAH;
const USER = "saphahcentral";

if (!TOKEN) {
  console.error("❌ Missing ELIYAH_SAPHAH token");
  process.exit(1);
}

// Load repos
const repos = JSON.parse(
  fs.readFileSync(path.join(__dirname, "repos-public.json"), "utf8")
).repos;

const WORKDIR = "/tmp";

// =====================
// SAFE CLONE (FIXED METHOD)
// =====================

function cloneRepo(repo, dir) {
  const url = `https://github.com/${USER}/${repo}.git`;

  execSync(
    `git -c http.extraHeader="AUTHORIZATION: bearer ${TOKEN}" clone ${url} ${dir}`,
    { stdio: "inherit" }
  );
}

// =====================
// FRONT MATTER
// =====================

function hasFM(c) {
  return /^---\s*\n[\s\S]*?\n---/m.test(c);
}

function isIndex(f) {
  return f.replace(/\\/g, "/").endsWith("index.html");
}

function title(c) {
  return (c.match(/<title>(.*?)<\/title>/i) || [])[1] || "Untitled";
}

function walk(dir) {
  const items = fs.readdirSync(dir);

  for (const i of items) {
    const full = path.join(dir, i);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      if (![".git", "node_modules", "_site"].includes(i)) {
        walk(full);
      }
    } else if (i.endsWith(".html")) {
      let content = fs.readFileSync(full, "utf8");

      if (hasFM(content)) continue;
      if (isIndex(full)) continue;

      fs.writeFileSync(
        full,
        `---\nlayout: default\ntitle: "${title(content)}"\n---\n\n` + content
      );
    }
  }
}

// =====================
// MAIN
// =====================

for (const repo of repos) {
  console.log("\nPROCESSING:", repo);

  const dir = path.join(WORKDIR, repo);

  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  try {
    console.log("Cloning:", repo);
    cloneRepo(repo, dir);

    console.log("Converting:", repo);
    walk(dir);

    execSync(`git config user.name "eliyah-bot"`, { cwd: dir });
    execSync(`git config user.email "bot@saphahcentral.local"`, { cwd: dir });

    execSync(`git add .`, { cwd: dir });

    const changes = execSync(`git status --porcelain`, { cwd: dir })
      .toString()
      .trim();

    if (!changes) {
      console.log("NO CHANGES:", repo);
      continue;
    }

    execSync(`git commit -m "Jekyll conversion safe mode"`, { cwd: dir });
    execSync(`git push`, { cwd: dir });

    console.log("SUCCESS:", repo);

  } catch (e) {
    console.error("FAILED:", repo);
    console.error(e.message);
  }
}

console.log("\nDONE ALL REPOS");
