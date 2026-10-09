import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const pdfLibBundle = fileURLToPath(
  new URL('./node_modules/pdf-lib/dist/pdf-lib.esm.js', import.meta.url),
);

export default defineConfig({
  resolve: {
    alias: [
      // pdf-lib 的 module 入口指向无扩展名的 es/ 源码，Linux 上 Vite 扫依赖时解析失败。
      { find: /^pdf-lib$/, replacement: pdfLibBundle },
    ],
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    strictPort: true,
  },
});
