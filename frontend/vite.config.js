import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const pdfLibBundle = fileURLToPath(
  new URL('./node_modules/pdf-lib/dist/pdf-lib.esm.js', import.meta.url),
);

const apiProxy = {
  '/api': {
    target: 'http://127.0.0.1:3000',
    changeOrigin: true,
  },
};

function shareRoutePlugin() {
  const rewrite = (req) => {
    const url = req.url || '';
    if (url === '/share' || url.startsWith('/share?')) {
      req.url = `/share.html${url.slice('/share'.length)}`;
    }
  };
  return {
    name: 'wego-share-route',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewrite(req);
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewrite(req);
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [shareRoutePlugin()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        share: fileURLToPath(new URL('./share.html', import.meta.url)),
      },
    },
  },
  resolve: {
    alias: [
      // pdf-lib 的 module 入口指向无扩展名的 es/ 源码，Linux 上 Vite 扫依赖时解析失败。
      { find: /^pdf-lib$/, replacement: pdfLibBundle },
    ],
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: true,
    proxy: apiProxy,
  },
  preview: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: true,
    proxy: apiProxy,
  },
});
