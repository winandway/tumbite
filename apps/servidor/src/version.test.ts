import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { app } from './app';

describe('versión del servidor (C-VERSION-DEL-ARTEFACTO)', () => {
  it('/datos/version dice la versión compilada, sin caché y sin nada más', async () => {
    const res = await app.request('/datos/version', {}, {});
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const d = (await res.json()) as { servidor: { version: string; commit: string } };
    // En las pruebas no hay compilación: «local», nunca un commit inventado.
    expect(d).toEqual({ servidor: { version: '0.0.0', commit: 'local' } });
  });
  it('la salud también la dice', async () => {
    const d = (await (await app.request('/datos/salud', {}, {})).json()) as {
      version?: { commit: string };
    };
    expect(d.version?.commit).toBe('local');
  });
  it('el servidor se compila grabando el commit de la publicación', () => {
    const guion = readFileSync(
      join(__dirname, '..', '..', '..', 'scripts', 'construir-servidor.mjs'),
      'utf8',
    );
    expect(guion).toMatch(/COMMIT_PUBLICADO/);
    expect(guion).toMatch(/process\.env\.VERSION \|\| process\.env\.GITHUB_SHA/);
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as {
      scripts: { build: string };
    };
    expect(pkg.scripts.build).toBe('node ../../scripts/construir-servidor.mjs');
  });
  it('C-VERSION-PANEL: la web toma la versión de la publicación, no la punta de main', () => {
    // GitHub no deja cambiar GITHUB_SHA en un paso: en «publicar» vale la punta de main. Si la
    // punta era un cambio [skip ci], la web salía con otro commit y el control la frenaba (corrida
    // 299, 2 nov 2026: «la web no lleva el commit a50aa06»). VERSION es la versión verificada.
    const vite = readFileSync(join(__dirname, '..', '..', 'panel', 'vite.config.ts'), 'utf8');
    expect(vite).toMatch(/process\.env\.VERSION \|\| process\.env\.GITHUB_SHA/);
  });
});
