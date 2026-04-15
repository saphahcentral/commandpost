// convert-to-jekyll.js

const fs = require("fs");
const path = require("path");

const ROOT_DIR = process.cwd();

// folders to ignore
const IGNORE_DIRS = [".git", ".github", "node_modules", "_site"];

// detect existing front matter safely
function hasFrontMatter(content) {
  return /^---\s*\n[\s\S]*?\n---\s*\n/.test(content);
}

// extract <title>
function extractTitle(content) {
  const match = content.match(/<title>(.*?)<\/title>/i);
  return match ? match[1].replace(/"/g, '\\"').trim() : "Untitled Page";
}

// generate clean permalink
function generatePermalink(filePath) {
  let relative = path.relative(ROOT_DIR, filePath).replace(/\\/g, "/");
  return "/" + relative.replace(/index\.html$/i, "");
}

function convertFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");

  if (hasFrontMatter(content)) {
    console.log(`⏩ Skipped (already has front matter): ${filePath}`);
    return;
  }

  const title = extractTitle(content);
  const permalink = generatePermalink(filePath);

  const frontMatter = `---
layout: default
title: "${title}"
permalink: "${permalink}"
---

`;

  const newContent = frontMatter + content;

  fs.writeFileSync(filePath, newContent, "utf8");
  console.log(`✅ Converted: ${filePath}`);
}

function walk(dir) {
  const items = fs.readdirSync(dir);

  items.forEach((item) => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!IGNORE_DIRS.includes(item)) {
        walk(fullPath);
      }
    } else if (item.toLowerCase().endsWith(".html")) {
      convertFile(fullPath);
    }
  });
}

// run
walk(ROOT_DIR);
console.log("🎉 Jekyll front matter conversion complete.");
