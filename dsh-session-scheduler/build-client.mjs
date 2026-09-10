import { mkdirSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';

const result = await build({
  entryPoints: ['src/client/index.tsx'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  write: false,
  logLevel: 'info',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/*'],
});

const body = result.outputFiles[0].text;
const wrapped = `window.__ModuleLoader__.load({
	id: "dsh-session-scheduler",
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
console.log('✅ lib/client.js (browser, esbuild) 构建完成');
