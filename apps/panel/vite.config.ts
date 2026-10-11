import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Versión publicada (commit de main). Sirve para comprobar qué está en vivo: <meta name="version">. */
const VERSION = (process.env.GITHUB_SHA ?? 'local').slice(0, 7);

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'version-publicada',
      transformIndexHtml: (html) =>
        html.replace('</head>', `  <meta name="version" content="${VERSION}" />\n  </head>`),
    },
  ],
  server: { port: 5173, proxy: { '/datos': 'http://localhost:8787' } },
});
