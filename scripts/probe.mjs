// Self-contained builds for a live probe in Grafana: one file per entry with its
// shared code inlined, small enough to load through a data: URL before anything
// is published. Never shipped - dist-probe/ is gitignored and not in the tarball.
import { build } from 'vite';

for (const entry of ['kd', 'openapi', 'k8s', 'n8n']) {
  await build({
    logLevel: 'warn',
    build: {
      outDir: 'dist-probe',
      emptyOutDir: false,
      sourcemap: false,
      lib: { entry: { [entry]: `src/${entry}/index.ts` }, formats: ['es'], fileName: (_f, name) => `${name}.js` },
    },
  });
}
console.log('dist-probe/: kd.js openapi.js k8s.js n8n.js');
