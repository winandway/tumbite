import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SuperCamila } from './SuperCamila';

/**
 * C-SIN-CODIGOS-CRUDOS en la bandeja de Camila (Gerencia en vivo, 26 nov 2026: salían «sin_permiso_ia»,
 * «respuesta_reportada» y «no_supo» como motivo del caso) — todos los países. Cada motivo con el que el
 * servidor abre un caso tiene su frase en español y en inglés, y la bandeja nunca pinta un código.
 */
const SERVIDOR = join(__dirname, '../../../servidor/src');

/** Los motivos que el servidor escribe en camila_casos, leídos de su código (no de una lista a mano). */
function motivosDelServidor(): string[] {
  const motivos = new Set<string>(['ayuda']); // el de abrirCaso cuando no se dice motivo
  const recorrer = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const ruta = join(dir, e.name);
      if (e.isDirectory()) recorrer(ruta);
      else if (/\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name)) {
        const s = readFileSync(ruta, 'utf8');
        // El motivo es el último argumento, una cadena suelta: abrirCaso(c, texto, 'motivo').
        for (const trozo of s.split('abrirCaso(').slice(1)) {
          const llamada = trozo.slice(0, trozo.indexOf(';')).trim();
          const m = /,\s*'([a-z_]+)',?\s*\)$/.exec(llamada);
          if (m) motivos.add(m[1]!);
        }
        for (const m of s.matchAll(/INSERT INTO camila_casos[^;]*?'([a-z_]+)'/gs))
          motivos.add(m[1]!);
      }
    }
  };
  recorrer(SERVIDOR);
  return [...motivos];
}

function bandejaCon(motivos: string[]) {
  vi.stubGlobal('fetch', async (url: string) => {
    const ruta = String(url);
    const json = (d: unknown, status = 200) =>
      new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json' } });
    if (ruta.endsWith('/camila/bandeja'))
      return json({
        casos: motivos.map((motivo, i) => ({
          id: `caso-${i}`,
          persona_id: `per-${i}`,
          resumen: `Caso ${i}`,
          motivo,
          creado_en: '2026-11-17 14:05:00',
          nombre: `Persona ${i}`,
          canal_ultimo: 'whatsapp',
          humano_hasta: null,
        })),
        atendiendo: [],
        hoy: { microdolares: 0, llamadas: 0, regalos: 0, topeMicro: 1_000_000 },
      });
    if (ruta.includes('/camila/hilos')) return json({ hilos: [] });
    if (ruta.endsWith('/admin/zonas')) return json({ zonas: [] });
    return json({}, 404);
  });
}

describe('C-SIN-CODIGOS-CRUDOS: motivos de la bandeja de Camila', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('el servidor abre casos con varios motivos (la lista sale de su código)', () => {
    const m = motivosDelServidor();
    for (const k of ['sin_permiso_ia', 'respuesta_reportada', 'no_supo', 'pide_persona'])
      expect(m).toContain(k);
  });

  for (const idioma of ['es', 'en'] as const) {
    it(`en ${idioma}, ningún motivo sale como código ni como palabra suelta sin traducir`, async () => {
      window.history.replaceState(null, '', '/panel/control-x/camila');
      const motivos = motivosDelServidor();
      bandejaCon(motivos);
      render(<SuperCamila idioma={idioma} />);
      await screen.findByText('Caso 0');
      const chips = [...document.querySelectorAll('.camila-chip')].map((x) => x.textContent ?? '');
      expect(chips.length).toBe(motivos.length);
      for (const [i, texto] of chips.entries()) {
        expect(texto).not.toMatch(/_/);
        // Ni el código «en palabras» de respaldo: cada motivo tiene su frase propia.
        const crudo = motivos[i]!.replace(/_/g, ' ');
        expect(texto.toLowerCase()).not.toBe(crudo);
      }
    });
  }
});
