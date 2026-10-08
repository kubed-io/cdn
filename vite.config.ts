import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// The @n8n/chat build n8n.js loads from jsDelivr at runtime: package.json's optional peer, so the
// version lives where npm and a bump PR can see it. Exact, because a range would load a moving file.
const chat = pkg.peerDependencies?.['@n8n/chat'];
if (!/^\d+\.\d+\.\d+$/.test(chat ?? '')) throw new Error(`package.json: @n8n/chat must be an exact version, not ${chat}`);

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
    __N8N_CHAT_VERSION__: JSON.stringify(chat),
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
        github: 'src/github/index.ts',
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
