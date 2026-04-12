// astro.config.mjs
import { defineConfig } from 'astro/config';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  vite: {
    plugins: [
      {
        name: 'exclude-avif-mt',
        load(id) {
          if (id.includes('avif_enc_mt')) {
            return 'export default {}';
          }
        },
      },
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
    build: {
      target: 'esnext',
    },
  },
});