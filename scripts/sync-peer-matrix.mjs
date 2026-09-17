#!/usr/bin/env node
/**
 * 把 src/upstream-compat.ts 的 KERNEL_GENERATIONS 同步进 package.json
 * 的 peerDependencies / devDependencies（kernel-scoped 包）。
 *
 * 用法（新 rc 落地时）：
 *   1. 编辑 src/upstream-compat.ts，在 KERNEL_GENERATIONS 追加一代
 *   2. npm run build   # 或至少 tsc 产出 lib/upstream-compat.js
 *   3. node scripts/sync-peer-matrix.mjs
 *   4. npm test
 *
 * 幂等：重复运行结果不变。不改动非 kernel-scoped 的 peer（cordis 等）。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = join(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

const { peerMatrixEntries, KERNEL_GENERATIONS } = await import(
  join(root, 'lib', 'upstream-compat.js')
);

const entries = peerMatrixEntries();
const changed = [];

for (const { packageName, range } of entries) {
  for (const field of ['peerDependencies', 'devDependencies']) {
    if (!(field in pkg)) continue;
    const prev = pkg[field][packageName];
    if (prev !== range) {
      pkg[field][packageName] = range;
      changed.push(`${field}.${packageName}: ${prev ?? '(absent)'} → ${range}`);
    }
  }
}

if (changed.length === 0) {
  console.log('peer matrix already in sync.');
  console.log(
    `  generations: ${KERNEL_GENERATIONS.map((g) => g.id).join(', ')}`,
  );
  process.exit(0);
}

writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log('updated package.json peer matrix:');
for (const line of changed) console.log(`  ${line}`);
console.log(
  `  generations: ${KERNEL_GENERATIONS.map((g) => g.id).join(', ')}`,
);
