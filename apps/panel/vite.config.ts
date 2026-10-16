import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import raiz from '../../package.json' with { type: 'json' };

/** Versión publicada (commit de main). Sirve para comprobar qué está en vivo: <meta name="version">. */
const VERSION = (process.env.GITHUB_SHA ?? 'local').slice(0, 7);
/** Número de versión del proyecto (package.json de la raíz). Va con el commit al pie (C-VERSION-DEL-ARTEFACTO). */
const NUMERO = raiz.version;

export default defineConfig({
  define: { VERSION_WEB: JSON.stringify({ version: NUMERO, commit: VERSION }) },
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
