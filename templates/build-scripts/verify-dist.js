#!/usr/bin/env node

/**
 * Verifies the Vite production bundle before it is deployed.
 *
 * The templates app is published as a static site: `dist/meta.json` is the
 * catalogue and `dist/blueprints/<id>/` holds the files each template card and
 * dialog reads. A missing logo or blueprint directory is invisible at build
 * time (Vite happily copies whatever exists), so fail the build instead.
 *
 * Usage:
 *   node build-scripts/verify-dist.js [--dist <dir>]
 */

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const distIdx = args.indexOf("--dist");
const repoRoot = path.resolve(__dirname, "..");
const distDir =
  distIdx >= 0
    ? path.resolve(args[distIdx + 1])
    : path.join(repoRoot, "app", "dist");
const blueprintsSrc = path.join(repoRoot, "blueprints");

const REQUIRED_FILES = ["docker-compose.yml", "template.toml"];
const errors = [];

function mustExist(file, label) {
  if (!fs.existsSync(file)) {
    errors.push(`${label}: missing`);
    return false;
  }
  return true;
}

if (!fs.existsSync(distDir)) {
  console.error(`❌ Build output not found: ${distDir}`);
  process.exit(1);
}

mustExist(path.join(distDir, "index.html"), "index.html");

const metaPath = path.join(distDir, "meta.json");
let templates = [];
if (mustExist(metaPath, "meta.json")) {
  try {
    templates = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  } catch (error) {
    console.error(`❌ meta.json is not valid JSON: ${error.message}`);
    process.exit(1);
  }
  if (!Array.isArray(templates) || templates.length === 0) {
    console.error("❌ meta.json must be a non-empty array");
    process.exit(1);
  }
}

const sourceDirs = fs.existsSync(blueprintsSrc)
  ? fs
      .readdirSync(blueprintsSrc, { withFileTypes: true })
      .filter((entry) => entry.isDirectory()).length
  : 0;

if (sourceDirs > 0 && templates.length !== sourceDirs) {
  errors.push(
    `meta.json contains ${templates.length} templates but ${sourceDirs} blueprint directories exist`
  );
}

const seenIds = new Set();
for (const template of templates) {
  if (!template || typeof template !== "object" || typeof template.id !== "string") {
    errors.push(`meta.json entry without a valid id: ${JSON.stringify(template).slice(0, 80)}`);
    continue;
  }
  if (seenIds.has(template.id)) {
    errors.push(`meta.json contains a duplicate id: ${template.id}`);
    continue;
  }
  seenIds.add(template.id);

  const blueprintDir = path.join(distDir, "blueprints", template.id);
  if (!mustExist(blueprintDir, `blueprints/${template.id}`)) continue;

  if (typeof template.logo !== "string" || template.logo.length === 0) {
    errors.push(`blueprints/${template.id}: meta.json has no logo`);
  } else {
    mustExist(
      path.join(blueprintDir, template.logo),
      `blueprints/${template.id}/${template.logo}`
    );
  }

  for (const fileName of REQUIRED_FILES) {
    mustExist(
      path.join(blueprintDir, fileName),
      `blueprints/${template.id}/${fileName}`
    );
  }
}

const distBlueprints = path.join(distDir, "blueprints");
if (mustExist(distBlueprints, "blueprints")) {
  const copiedDirs = fs
    .readdirSync(distBlueprints, { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).length;
  if (sourceDirs > 0 && copiedDirs !== sourceDirs) {
    errors.push(
      `dist/blueprints contains ${copiedDirs} directories, expected ${sourceDirs}`
    );
  }
}

if (errors.length > 0) {
  for (const error of errors.slice(0, 50)) console.error(`❌ ${error}`);
  if (errors.length > 50) console.error(`… and ${errors.length - 50} more`);
  console.error(`\n🚨 ${errors.length} problem(s) in ${distDir}`);
  process.exit(1);
}

console.log(
  `✅ dist verified: ${templates.length} templates, ${templates.length} blueprint directories`
);
