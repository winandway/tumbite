// Compila el servidor (_worker.js) y le graba DENTRO la versión y el commit con que se compiló
// (C-VERSION-DEL-ARTEFACTO). El commit sale de la publicación (VERSION o GITHUB_SHA); sin
// publicación queda «local». Así /datos/version dice lo que de verdad está desplegado.
import { execFileSync } from 'node:child_process';
import raiz from '../package.json' with { type: 'json' };

const raw = process.env.VERSION || process.env.GITHUB_SHA || '';
const commit = /^[0-9a-f]{7,40}$/i.test(raw) ? raw.slice(0, 7).toLowerCase() : 'local';
const { version } = raiz;
execFileSync(
  'npx',
  [
    'wrangler',
    'deploy',
    '--dry-run',
    '--outdir=.dist-worker',
    '--minify',
    '--define',
    `COMMIT_PUBLICADO:${JSON.stringify(commit)}`,
    '--define',
    `VERSION_PUBLICADA:${JSON.stringify(version)}`,
  ],
  { stdio: 'inherit', cwd: new URL('../apps/servidor/', import.meta.url) },
);
console.log(`servidor compilado: ${version} · ${commit}`);
