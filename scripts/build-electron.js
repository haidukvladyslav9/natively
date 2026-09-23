#!/usr/bin/env node
/**
 * Fast electron build using esbuild (transpile-only, no type checking).
 * ~10-50x faster than `tsc` for dev builds.
 * Run `npm run typecheck:electron` separately for type safety.
 */

const { build, context } = require('esbuild');

// `--watch` replaces the old `tsc -p electron/tsconfig.json --watch` script. That
// script emitted via tsc, which is incompatible with module:"Preserve" (the
// TS7-legal setting) — and tsc has not been the emitter for dist-electron for a
// long time anyway. Type-checking in watch mode is `tsc --noEmit --watch`.
const WATCH = process.argv.includes('--watch');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const outDir = path.resolve(rootDir, 'dist-electron');

const entryPoints = [];

// Function to recursively find all .ts files in a directory
const findTs = (dir) => {
  const results = [];
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) results.push(...findTs(full));
    else if (f.name.endsWith('.ts') && !f.name.endsWith('.d.ts')) results.push(full);
  }
  return results;
};

const electronDir = path.resolve(rootDir, 'electron');
if (fs.existsSync(electronDir)) {
  entryPoints.push(...findTs(electronDir).map(f => path.relative(rootDir, f)));
}

// Also include premium electron files if they exist
const premiumDir = path.resolve(rootDir, 'premium/electron');
if (fs.existsSync(premiumDir)) {
  entryPoints.push(...findTs(premiumDir).map(f => path.relative(rootDir, f)));
}

const start = Date.now();

const buildOptions = {
  entryPoints,
  bundle: true,           // resolve all static + dynamic imports so postProcessor
                         // is inlined and the path rewrite works (vs bundle:false
                         // which copies files as-is and leaves unresolved relative paths)
  outdir: outDir,
  outbase: rootDir,       // preserve directory structure (electron/main.ts → dist-electron/electron/main.js)
  platform: 'node',
  target: 'node20',
  format: 'cjs',          // Electron loads package.json main as CommonJS in this repo
                          // (package.json has no "type": "module").
  external: [
    'electron',
    'better-sqlite3',
    'keytar',
    // Nemotron imports this native binary directly, so it must remain external.
    'onnxruntime-node',
  ],
  sourcemap: true,
  jsx: 'automatic',
  loader: {
    '.ts': 'ts',
    '.js': 'js',
  },
  logLevel: 'warning',
};

const onFailure = (err) => {
  console.error('[build-electron] Build failed:', err.message);
  process.exit(1);
};

// Non-JS assets esbuild does not know about. These must be copied on EVERY
// build path — a one-off copy in the non-watch branch left `npm run watch`
// (after a clean) with a dist-electron that has no .proto, so NVIDIA speech
// died at runtime with an ENOENT pointing at the missing file rather than at
// the build.
const ASSETS = [
  { from: 'electron/audio/riva_asr.proto', to: 'electron/audio/riva_asr.proto' },
];

const copyAssets = () => {
  for (const asset of ASSETS) {
    const src = path.resolve(rootDir, asset.from);
    const dest = path.resolve(outDir, asset.to);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
};

if (WATCH) {
  context(buildOptions).then(async (ctx) => {
    await ctx.watch();
    copyAssets();
    // Deliberately no timing here: ctx.watch() returns once the watcher is armed,
    // and esbuild runs the first build asynchronously after that — printing an
    // elapsed time would report context setup, not a completed build.
    console.log('[build-electron] watching for changes...');
  }).catch(onFailure);
} else {
  build(buildOptions).then(() => {
    copyAssets();
    console.log(`[build-electron] Done in ${Date.now() - start}ms`);
  }).catch(onFailure);
}
