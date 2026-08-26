/**
 * 自动重建 watcher：监听 src/ 变化 → 重新构建 host+client bundle → 输出提示。
 *
 * 用法：
 *   node watch.mjs
 *   # 或作为 npm script：npm run watch
 *
 * 特性：
 *  - 依赖 Node 内置 fs.watch，零额外依赖（不引入 chokidar）
 *  - 防抖 150ms，避免保存时连发多次构建
 *  - 构建成功后提示剩余的人工步骤（host 端改动需重启 dsh web；
 *    若在 pnpm run dev:web 下，client 端还会被 HMR 热更）
 *  - 首次启动立即构建一次，确认基线
 */
import { watch, watchFile, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, basename } from 'node:path';
import { existsSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const debounceMs = 150;
const ignored = new Set(['.git']);
let timer = null;
let building = false;
let queued = false;

const SRC = resolve(here, 'src');
// build.mjs 也会写 lib/ 与类型声明，不监听 lib 以避免回环
const WATCH_DIRS = [SRC];

function stamp() {
  return new Date().toTimeString().slice(0, 8);
}

function runBuild() {
  if (building) {
    queued = true;
    return;
  }
  building = true;
  console.log(`\n[${stamp()}] 🔨 检测到变更，开始构建…`);
  const started = Date.now();
  try {
    execSync('npm run build', { cwd: here, stdio: 'inherit', timeout: 120_000 });
    execSync('node --test tests/projection-unit.test.mjs', {
      cwd: here,
      stdio: 'inherit',
      timeout: 60_000,
    });
    console.log(
      `[${stamp()}] ✅ 构建 + 形状回归测试通过（${((Date.now() - started) / 1000).toFixed(1)}s）`,
    );
    console.log(
      `[${stamp()}] 💡 部署提示：lib/ 由硬链接自动同步到 web profile。host 端改动需重启 dsh web 生效；若在 pnpm run dev:web 下，client 端走 HMR 热更。`,
    );
  } catch {
    console.log(`[${stamp()}] ❌ 构建或测试失败（详见上方输出）`);
  } finally {
    building = false;
    if (queued) {
      queued = false;
      runBuild();
    }
  }
}

function scheduleBuild() {
  clearTimeout(timer);
  timer = setTimeout(runBuild, debounceMs);
}

function shouldWatch(entry) {
  if (ignored.has(entry)) return false;
  if (entry.startsWith('.')) return false;
  // 跳过构建过程中临时写入的东西
  if (entry.endsWith('.tsbuildinfo')) return false;
  return true;
}

function watchDir(dir) {
  let watcher;
  try {
    watcher = watch(dir, { recursive: true }, (_eventType, filename) => {
      if (!filename) return;
      const full = resolve(dir, filename);
      if (existsSync(full) && statSync(full).isDirectory()) return;
      console.log(`[${stamp()}] 👀 ${basename(filename)}`);
      scheduleBuild();
    });
  } catch {
    // 递归 watch 在老旧 Node/部分平台不可用 → 降级为顶层目录 + 文件轮询
    const top = watch(dir, (_e, filename) => filename && (console.log(`[${stamp()}] 👀 ${filename}`), scheduleBuild()));
    watchFile(dir, { interval: 800 }, (_curr, prev) => {
      if (prev.mtimeMs === _curr.mtimeMs) return;
      scheduleBuild();
    });
    return () => { top.close(); };
  }
  return () => watcher?.close();
}

if (process.platform === 'win32' || process.versions.node.startsWith('2')) {
  // 老版本或者 Windows 上递归 watch 经常不可用，用目录浏览式轮询补足
  let last = Date.now();
  const poll = setInterval(() => {
    if (Date.now() - last < 800) return;
    last = Date.now();
    scheduleBuild();
  }, 2000);
  process.on('SIGINT', () => clearInterval(poll));
}

console.log(`[${stamp()}] 👁️  watcher 启动（监听 ${WATCH_DIRS.join(', ')}），Ctrl+C 退出`);
console.log(`[${stamp()}]   首次基线构建…`);
runBuild();

const disposers = WATCH_DIRS.map(watchDir);
process.on('SIGINT', () => {
  disposers.forEach((fn) => fn?.());
  process.exit(0);
});
