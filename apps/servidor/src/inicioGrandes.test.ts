import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Candado C-INICIO-GRANDES (18 oct 2026, «No inventemos la rueda»): el inicio del cliente copia el
 * estándar del mercado y no vuelve atrás: servicios reales en el orden de Richard, cada servicio
 * con su pantalla y su franja (nunca una ventana encima), buscador y campana reales.
 */
const raiz = join(__dirname, '..', '..', '..');
const leer = (...r: string[]) => readFileSync(join(raiz, ...r), 'utf8');
const CLIENTE = ['apps', 'cliente', 'src'];

describe('inicio del cliente como los grandes', () => {
  it('los ocho servicios existen en el catálogo, Licores y Más incluidos', () => {
    const schema = leer('schema.sql');
    for (const id of ['comida', 'moto', 'carro', 'envios', 'mercado', 'farmacia', 'licores', 'mas'])
      expect(schema).toContain(`('${id}',`);
  });
  // C-SIN-PANTALLAS-INTERMEDIAS (17 nov 2026, borrador aprobado): cada servicio abre directo su
  // pantalla; ya no hay pantalla con «Abrir» ni modal «Muy pronto». Desde C-OCHO-ICONOS-SIEMPRE
  // (18 nov) el que no abre en la zona abre la hoja «aún no hay» (accionDeServicio decide).
  it('cada servicio abre directo su pantalla, sin pantallas intermedias ni «Muy pronto»', () => {
    const inicio = leer(...CLIENTE, 'Inicio.tsx');
    expect(inicio).toContain('accionDeServicio(s.id');
    expect(inicio).toContain('serviciosDelInicio(');
    expect(inicio).not.toContain('ModalMuyPronto');
    const pantalla = leer(...CLIENTE, 'app', 'service', '[id].tsx');
    expect(pantalla).toContain('<Redirect');
    expect(pantalla).not.toContain('abrirServicio');
  });
  it('el buscador y la campana abren pantallas reales', () => {
    const inicio = leer(...CLIENTE, 'Inicio.tsx');
    expect(inicio).toMatch(/alTocar=\{\(\) => router\.push\('\/search'\)\}/);
    expect(inicio).toMatch(/alCampana=\{\(\) => router\.push\('\/notifications'\)\}/);
    // Los regalos, desde «Más servicios» (C-INICIO-NUEVO).
    expect(inicio).toMatch(/pathname: '\/notifications', params: \{ tab: 'regalos' \}/);
    expect(existsSync(join(raiz, ...CLIENTE, 'app', 'search.tsx'))).toBe(true);
    expect(existsSync(join(raiz, ...CLIENTE, 'app', 'notifications.tsx'))).toBe(true);
    // El buscador pregunta al servidor (no filtra solo la lista cargada) con espera corta.
    const buscar = leer(...CLIENTE, 'app', 'search.tsx');
    expect(buscar).toContain('/datos/buscar?q=');
    expect(buscar).toMatch(/ESPERA_BUSQUEDA_MS = 300/);
  });
  it('las guías públicas de lo nuevo existen en los dos idiomas', () => {
    const guias = leer('apps', 'panel', 'src', 'sitio', 'docs', 'guias.ts');
    for (const id of ['search', 'alerts-and-rewards', 'services'])
      expect(guias.split(`id: '${id}'`).length - 1).toBe(2);
  });
});
