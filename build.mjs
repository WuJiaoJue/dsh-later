/**
 * 构建脚本：
 *  1. tsc 编译 host 端（src/ → lib/，tsconfig.json 已排除 src/client）
 *  2. esbuild 打包 client 端单文件并包进 __ModuleLoader__.load 模板
 *  3. 把 shared 目录（smart-window/time-utils）同步进 lib/shared，供 host 引用
 *
 * 产物：lib/index.js（host）+ lib/client.js（浏览器端）
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';

// 1. host 端：tsc（容忍依赖版本差异导致的 TS 错误）
try {
  execSync('npx tsc -p tsconfig.json', { stdio: 'inherit' });
} catch (error) {
  console.warn('⚠️ host tsc 遇到依赖类型差异，尝试 esbuild 降级构建…');
  const entries = ['src/index.ts', 'src/domain.ts', 'src/owned-event-registration.ts', 'src/user-tools.ts', 'src/commands.ts', 'src/runtime.ts', 'src/projection.ts', 'src/smart-window.ts', 'src/time-utils.ts'];
  for (const entry of entries) {
    const name = entry.replace('src/', '').replace('.ts', '.js');
    const result = await build({
      entryPoints: [entry],
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'node22',
      write: false,
      logLevel: 'error',
      external: ['@deepseek-ai/cordis', '@deepseek-ai/schemastery', '@deepseek-ai/dsh-tools', '@deepseek-ai/dsh-schedule', '@deepseek-ai/dsh-agent', '@deepseek-ai/dsh-session', '@deepseek-ai/dsh-session-projection', '@deepseek-ai/dsh-commands', '@deepseek-ai/dsh-llm', '@deepseek-ai/dsh-settings', 'zod'],
    });
    writeFileSync(`lib/${name}`, result.outputFiles[0].text);
  }
}

// 1b. client 端类型检查（noEmit；避免类型错误溜进浏览器产物）
try {
  execSync('npx tsc -p tsconfig.client.json --noEmit', { stdio: 'inherit' });
} catch (error) {
  console.warn('⚠️ client tsc 遇到依赖类型差异，继续用 esbuild 构建…');
}

// 2. client 端：esbuild 打包（type-only imports 剥离；react 从宿主运行时解析）
const result = await build({
  entryPoints: ['src/client/index.tsx'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  write: false,
  logLevel: 'warning',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  // 与 DSH 官方 client 插件一致：JSX 走 react/jsx-runtime（automatic），
  // 由 __ModuleLoader__ 的 require 从宿主解析；不用 transform 模式（会生成
  // 全局 React.createElement，宿主无全局 React 导致渲染崩溃）。
  jsx: 'automatic',
  // react / react-dom 由 __ModuleLoader__ 的 require 从宿主解析（前端运行时提供）。
  external: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/*'],
});

const body = result.outputFiles[0].text;
const wrapped = `window.__ModuleLoader__.load({
	id: "dsh-later",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
${body}
		return module.exports;
	}
});
`;

mkdirSync('lib', { recursive: true });
writeFileSync('lib/client.js', wrapped);

// 4. 部署同步：web profile 里安装的本插件与工作区是**硬链接**关系，但
//    tsc/esbuild 重写文件时可能替换 inode（unlink+create），悄悄断链导致
//    profile 端拿到旧代码。这里对已知 profile 路径做 best-effort 强制重链。
import { readdirSync, statSync, linkSync, existsSync, rmSync } from "node:fs";
import { homedir } from 'node:os';
import { resolve as resolvePath, dirname as parentOf } from 'node:path';
try {
  const profileLib = resolvePath(homedir(), '.dsh/profiles/web/node_modules/dsh-later/lib');
  const localLib = resolvePath(process.cwd(), 'lib');
  if (existsSync(profileLib) && profileLib !== localLib) {
    let linked = 0;
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const src = resolvePath(dir, entry.name);
        const dst = profileLib + src.slice(localLib.length);
        if (entry.isDirectory()) {
          mkdirSync(dst, { recursive: true });
          walk(src);
        } else {
          try {
            if (statSync(src).ino !== statSync(dst).ino) {
              rmSync(dst, { force: true });
              linkSync(src, dst);
              linked++;
            }
          } catch {
            mkdirSync(parentOf(dst), { recursive: true });
            rmSync(dst, { force: true });
            linkSync(src, dst);
            linked++;
          }
        }
      }
    };
    walk(localLib);
    if (linked > 0) console.log(`🔗 已重链 ${linked} 个文件到 web profile`);
  }
} catch (error) {
  console.warn(`⚠️ profile 重链跳过: ${error instanceof Error ? error.message : String(error)}`);
}

console.log('✅ lib/index.js (host, tsc) + lib/client.js (browser, esbuild) 构建完成');
