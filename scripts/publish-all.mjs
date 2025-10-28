#!/usr/bin/env node
/**
 * Publish all workspace packages in ./packages/* to npm in topological order.
 *
 * Features:
 * - Verifies npm login (npm whoami)
 * - Builds all packages before publishing
 * - Publishes in dependency order
 * - Skips packages if the same version already exists on npm
 * - Supports: --tag, --dry-run, --otp, --no-build, --access
 *
 * Usage:
 *   node scripts/publish-all.mjs [--tag beta] [--dry-run] [--otp 123456] [--no-build] [--access public]
 */

import { spawnSync, execSync } from 'node:child_process';
import { promises as fsp } from 'node:fs';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PACKAGES_DIR = path.join(ROOT, 'packages');

function log(msg) {
  console.log(`[publish-all] ${msg}`);
}

function fail(msg, code = 1) {
  console.error(`[publish-all] ERROR: ${msg}`);
  process.exit(code);
}

function hasBin(bin) {
  try {
    execSync(process.platform === 'win32' ? `where ${bin}` : `command -v ${bin}`, {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (res.error) throw res.error;
  return res.status ?? 0;
}

function runCapture(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
  if (res.error) throw res.error;
  return {
    status: res.status ?? 0,
    stdout: res.stdout?.toString() ?? '',
    stderr: res.stderr?.toString() ?? '',
  };
}

async function readJson(file) {
  const s = await fsp.readFile(file, 'utf8');
  return JSON.parse(s);
}

async function findPackages() {
  const entries = await fsp.readdir(PACKAGES_DIR, { withFileTypes: true });
  const pkgs = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const dir = path.join(PACKAGES_DIR, ent.name);
    const pkgJsonPath = path.join(dir, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) continue;
    const pkg = await readJson(pkgJsonPath);
    if (!pkg.name || !pkg.version) continue;
    if (pkg.private) continue; // skip private packages
    const deps = Object.keys(pkg.dependencies || {});
    pkgs.push({ name: pkg.name, version: pkg.version, dir, deps, raw: pkg });
  }
  return pkgs;
}

function topoSortPackages(packages) {
  const nameToPkg = new Map(packages.map((p) => [p.name, p]));
  const inDegree = new Map();
  const graph = new Map();

  for (const p of packages) {
    inDegree.set(p.name, 0);
    graph.set(p.name, new Set());
  }

  for (const p of packages) {
    for (const d of p.deps) {
      if (!nameToPkg.has(d)) continue; // external dep
      graph.get(d).add(p.name); // edge: d -> p (publish dep first)
      inDegree.set(p.name, (inDegree.get(p.name) || 0) + 1);
    }
  }

  const queue = [];
  for (const [name, deg] of inDegree) if (deg === 0) queue.push(name);
  const order = [];

  while (queue.length) {
    const n = queue.shift();
    order.push(nameToPkg.get(n));
    for (const m of graph.get(n)) {
      inDegree.set(m, inDegree.get(m) - 1);
      if (inDegree.get(m) === 0) queue.push(m);
    }
  }

  if (order.length !== packages.length) {
    // Cycle detected; fallback to original order
    log('Dependency cycle detected or unresolved; falling back to default order.');
    return packages;
  }
  return order;
}

function parseArgs(argv) {
  const args = {
    tag: undefined,
    dryRun: false,
    otp: undefined,
    noBuild: false,
    access: 'public',
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--no-build') args.noBuild = true;
    else if (a === '--tag') args.tag = argv[++i];
    else if (a === '--otp') args.otp = argv[++i];
    else if (a === '--access') args.access = argv[++i];
    else if (a === '--access-public') args.access = 'public';
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/publish-all.mjs [--tag TAG] [--dry-run] [--otp CODE] [--no-build] [--access public|restricted] [--access-public]`);
      process.exit(0);
    } else {
      console.warn(`Unknown argument: ${a}`);
    }
  }
  return args;
}

function ensureNpmLogin() {
  try {
    const { status, stdout } = runCapture('npm', ['whoami']);
    if (status !== 0) fail('You are not logged in to npm. Run `npm login` first.');
    const who = stdout.trim();
    if (!who) fail('Unable to determine npm user. Run `npm login`.');
    log(`npm user: ${who}`);
  } catch (e) {
    fail('Unable to verify npm login. Ensure `npm login` succeeds.');
  }
}

function hasVersionOnNpm(name, version) {
  try {
    const { status } = runCapture('npm', ['view', `${name}@${version}`, 'version', '--silent']);
    return status === 0; // found
  } catch {
    return false;
  }
}

async function main() {
  const args = parseArgs(process.argv);

  if (!hasBin('pnpm')) fail('pnpm is required. Install it: `npm i -g pnpm`');

  ensureNpmLogin();

  if (!args.noBuild) {
    log('Building all packages...');
    const status = run('pnpm', ['-r', '--filter', './packages/*', 'run', 'build']);
    if (status !== 0) fail('Build failed.');
  } else {
    log('Skipping build step (--no-build).');
  }

  const packages = await findPackages();
  if (packages.length === 0) fail('No packages found in ./packages');

  const ordered = topoSortPackages(packages);
  log(`Publish order: ${ordered.map((p) => p.name).join(', ')}`);

  const results = [];
  for (const p of ordered) {
    const already = hasVersionOnNpm(p.name, p.version);
    if (already) {
      log(`Skip ${p.name}@${p.version} (already published).`);
      results.push({ pkg: p, status: 'skipped' });
      continue;
    }
    const publishArgs = ['publish', '--no-git-checks', '--access', args.access];
    if (args.tag) publishArgs.push('--tag', args.tag);
    if (args.dryRun) publishArgs.push('--dry-run');
    if (args.otp) publishArgs.push('--otp', args.otp);

    log(`Publishing ${p.name}@${p.version} from ${path.relative(ROOT, p.dir)}...`);
    const status = run('pnpm', publishArgs, { cwd: p.dir });
    if (status !== 0) {
      fail(`Publish failed for ${p.name}@${p.version}`);
    }
    results.push({ pkg: p, status: 'published' });
  }

  log('Done. Summary:');
  for (const r of results) {
    log(`- ${r.pkg.name}@${r.pkg.version}: ${r.status}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
