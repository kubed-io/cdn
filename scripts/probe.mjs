// Self-contained builds for a live probe in Grafana: one file per entry with its
// shared code inlined, so each loads on its own through a data: URL before
// anything is published. Never shipped - dist-probe/ is gitignored.
import { readFileSync, rmSync } from 'node:fs';
import { build } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
rmSync('dist-probe', { recursive: true, force: true });

for (const entry of ['kd', 'openapi', 'k8s', 'n8n', 'github']) {
  await build({
    configFile: false,
    logLevel: 'warn',
    define: { __KD_VERSION__: JSON.stringify(`${pkg.version}-probe`) },
    build: {
      outDir: 'dist-probe',
      emptyOutDir: false,
      target: 'es2022',
      minify: true,
      lib: { entry: `src/${entry}/index.ts`, formats: ['es'], fileName: () => `${entry}.js` },
      rolldownOptions: {
        // highlight.js languages are separate files in a real build; a data: URL cannot load
        // siblings, so the probe leaves them out (kd-code falls back to plain text) and inlines
        // every other lazy chunk (marked, DOMPurify, the highlight core).
        external: (id) => /highlight\.js\/es\/languages\//.test(id),
        output: { inlineDynamicImports: true },
      },
    },
  });
}
console.log('dist-probe/: kd.js openapi.js k8s.js n8n.js github.js');
