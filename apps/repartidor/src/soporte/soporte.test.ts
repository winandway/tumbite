import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { textosSoporte } from './textos';

/**
 * C-CAMILA-CHAT en Divoox Driver (17 nov 2026) — todos los países. Candados de la
 * app (sin React Native, leyendo el código): Ayuda está en el menú y el chat habla por el canal de
 * la app, con borrador y los nombres de Camila y del equipo.
 */
const SRC = join(__dirname, '..');
const leer = (...p: string[]) => readFileSync(join(SRC, ...p), 'utf8');

describe('C-CAMILA-CHAT en Driver', () => {
  it('los textos existen completos en los dos idiomas', () => {
    const es = textosSoporte('es');
    const en = textosSoporte('en');
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
    for (const t of [es, en])
      for (const [k, v] of Object.entries(t))
        if (typeof v === 'string') expect(v.trim(), k).not.toBe('');
    expect(es.hablar).toBe('Habla con soporte');
    expect(en.hablar).toBe('Talk to support');
  });

  it('Ayuda está en el menú y abre el chat con soporte por el canal de la app', () => {
    const inicio = leer('Inicio.tsx');
    expect(inicio).toMatch(/\['ayuda', textosSoporte\(idioma\)\.ayuda\]/);
    expect(inicio).toContain("vista === 'ayuda'");
    const chat = leer('soporte', 'ChatSoporteApp.tsx');
    expect(chat).toContain("canal: 'app'");
    expect(chat).toContain("'/datos/camila/hilo'");
    // Lo escrito se guarda como borrador del teléfono, por cuenta.
    expect(chat).toMatch(/useBorrador\(\{[\s\S]*?almacen: almacenTelefono/);
    // Los nombres de Camila y del equipo salen de la pieza compartida.
    expect(chat).toContain('nombreAutorCamila');
    expect(chat).toContain('equipoAtiende');
    // El botón va en fila y no parte su palabra.
    expect(chat).toMatch(/<Boton[\s\S]*?enFila\s*\/>/);
  });

  it('la casilla se vacía antes de la espera de «escribiendo»: lo que se escribe mientras tanto no se borra', () => {
    const chat = leer('soporte', 'ChatSoporteApp.tsx');
    expect(chat.indexOf('await b.limpiar();')).toBeGreaterThan(-1);
    expect(chat.indexOf('await b.limpiar();')).toBeLessThan(
      chat.indexOf('await esperar(r.respuesta);'),
    );
  });
});
