// astro.config.mjs
import { defineConfig } from 'astro/config';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  vite: {
    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: 'node_modules/@jsquash/avif/codec/enc/avif_enc.wasm',
            dest: 'node_modules/.vite/deps',
          },
          {
            src: 'node_modules/@jsquash/webp/codec/enc/webp_enc.wasm',
            dest: 'node_modules/.vite/deps',
          },
        ],
      }),
    ],
    optimizeDeps: {
      exclude: ['@jsquash/avif', '@jsquash/webp'],
    },
    build: {
      target: 'esnext',
    },
  },
});