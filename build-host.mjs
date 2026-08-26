import { mkdirSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';

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
    external: ['@deepseek-ai/cordis', '@deepseek-ai/schemastery', '@deepseek-ai/dsh-tools', '@deepseek-ai/dsh-schedule', '@deepseek-ai/dsh-agent', '@deepseek-ai/dsh-session', '@deepseek-ai/dsh-session-projection', '@deepseek-ai/dsh-commands', '@deepseek-ai/dsh-llm'],
    outdir: 'lib',
  });
  // Files are written to disk already
}
console.log('✅ host files built');
