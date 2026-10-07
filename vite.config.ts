import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Light-DOM stylesheets a panel loads through Business Text's externalStyles.
// They are not imported by any module, so they are emitted as they are.
const STYLESHEETS: Record<string, string> = {
  'kd.css': 'src/kd/kd.css',
};

function stylesheets(): Plugin {
  return {
    name: 'kd-stylesheets',
    generateBundle() {
      for (const [fileName, path] of Object.entries(STYLESHEETS)) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(path, 'utf8') });
      }
    },
  };
}

export default defineConfig({
  define: {
    __KD_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [stylesheets()],
  build: {
    target: 'es2022',
    minify: true,
    sourcemap: true,
    lib: {
      // One entry per domain. Code they share lands in chunks/, imported by
      // relative URL, so the browser's module map loads it once per page.
      entry: {
        kd: 'src/kd/index.ts',
        openapi: 'src/openapi/index.ts',
        k8s: 'src/k8s/index.ts',
        n8n: 'src/n8n/index.ts',
      },
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`,
    },
    rolldownOptions: {
      output: {
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
  test: {
    environment: 'happy-dom',
  },
});
