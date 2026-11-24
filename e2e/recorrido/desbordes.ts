import { expect, type Page } from '@playwright/test';

/**
 * C-DESBORDES-360 (24 nov 2026, orden de Richard; todos los países). En el celular más angosto que
 * se vende hoy (360 px de ancho), nada se sale de la pantalla y ninguna palabra se parte en dos
 * renglones («Mercad / o»). Mira, dentro de `raiz`:
 *  - que la página no se mueva de lado (el documento no es más ancho que la pantalla);
 *  - que ningún elemento visible se salga por la izquierda o la derecha (salvo dentro de una fila que
 *    se desliza de lado a propósito, o recortado por su caja);
 *  - que ninguna palabra quede partida entre dos renglones;
 *  - que ningún texto quede cortado con «…» («Multipaquete (F…»).
 * Devuelve la lista de problemas (vacía = todo cabe).
 */
export async function desbordes(p: Page, raiz = 'body'): Promise<string[]> {
  return p.evaluate((sel) => {
    const ancho = document.documentElement.clientWidth;
    const fallos: string[] = [];
    const total = document.documentElement.scrollWidth;
    if (total > ancho + 1) fallos.push(`la pantalla se mueve de lado: ${total} px en ${ancho} px`);
    const caja = document.querySelector(sel);
    if (!caja) return [`no está ${sel}`];
    // Una fila que se desliza de lado (lugares guardados, píldoras) o algo recortado por su caja.
    const aSalvo = (el: Element) => {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const o = getComputedStyle(a).overflowX;
        if (o === 'auto' || o === 'scroll') return true;
        if (o === 'hidden' || o === 'clip') {
          const r = a.getBoundingClientRect();
          if (r.left >= -1 && r.right <= ancho + 1) return true;
        }
      }
      return false;
    };
    const enFilaDeslizable = (el: Element) => {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const o = getComputedStyle(a).overflowX;
        if (o === 'auto' || o === 'scroll') return a.scrollWidth > a.clientWidth + 1;
      }
      return false;
    };
    const nombre = (el: Element) =>
      el.getAttribute('data-testid') ||
      el.getAttribute('aria-label') ||
      (el.textContent ?? '').trim().slice(0, 40) ||
      el.tagName.toLowerCase();
    for (const el of Array.from(caja.querySelectorAll('*'))) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const estilo = getComputedStyle(el);
      if (estilo.visibility === 'hidden' || estilo.opacity === '0') continue;
      // Un texto cortado con «…» (un renglón o varios) tampoco cabe, aunque su caja lo recorte. Las
      // casillas no cuentan (lo escrito en ellas se desliza).
      const conTexto =
        el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && Boolean(el.textContent?.trim());
      const clamp = estilo.getPropertyValue('-webkit-line-clamp');
      const cortado =
        conTexto &&
        ((estilo.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) ||
          (clamp !== '' && clamp !== 'none' && el.scrollHeight > el.clientHeight + 1));
      if (cortado && !enFilaDeslizable(el)) fallos.push(`texto cortado con «…»: «${nombre(el)}»`);
      if (aSalvo(el)) continue;
      if (r.right > ancho + 1 || r.left < -1)
        fallos.push(
          `se sale de la pantalla: «${nombre(el)}» (${Math.round(r.left)} a ${Math.round(r.right)} px)`,
        );
    }
    const caminante = document.createTreeWalker(caja, NodeFilter.SHOW_TEXT);
    for (let n = caminante.nextNode(); n; n = caminante.nextNode()) {
      const padre = n.parentElement;
      if (!padre || aSalvo(padre)) continue;
      const texto = n.textContent ?? '';
      for (const m of texto.matchAll(/\S{2,}/g)) {
        const rango = document.createRange();
        rango.setStart(n, m.index);
        rango.setEnd(n, m.index + m[0].length);
        const renglones = new Set(
          Array.from(rango.getClientRects())
            .filter((x) => x.width > 0)
            .map((x) => Math.round(x.top)),
        );
        if (renglones.size > 1) fallos.push(`palabra partida en dos renglones: «${m[0]}»`);
      }
    }
    return [...new Set(fallos)];
  }, raiz);
}

/** Falla la prueba si algo se sale o se parte, diciendo qué y en qué paso. */
export async function sinDesbordes(p: Page, donde: string, raiz = 'body') {
  // Las letras de la app (Poppins y Montserrat) cargan aparte: se espera a que estén puestas.
  await p.evaluate(() => document.fonts.ready.then(() => true));
  expect(await desbordes(p, raiz), `${donde}: algo se sale o se parte a 360 px`).toEqual([]);
}
