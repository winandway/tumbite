// Gancho de EAS (eas-build-post-install), en la carpeta de cada app: graba el commit de la
// compilación de la tienda dentro de la app (C-VERSION-DEL-ARTEFACTO). EAS da el commit en
// EAS_BUILD_GIT_COMMIT_HASH; Expo lee .env.local al empaquetar y pega EXPO_PUBLIC_COMMIT.
import { appendFileSync } from 'node:fs';

const raw = process.env.EAS_BUILD_GIT_COMMIT_HASH || process.env.GITHUB_SHA || '';
const commit = /^[0-9a-f]{7,40}$/i.test(raw) ? raw.slice(0, 7).toLowerCase() : 'local';
appendFileSync('.env.local', `\nEXPO_PUBLIC_COMMIT=${commit}\n`);
console.log(`app: commit ${commit} grabado para la compilación`);
