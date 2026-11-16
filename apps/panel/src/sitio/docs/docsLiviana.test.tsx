import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Docs } from './Docs';
import { ICONOS_GUIA } from './iconosGuia';

/**
 * C-DOCS-PAGINA-LIVIANA (16 nov 2026): cada página de Docs repetía ~200 íconos dibujados completos
 * en la barra lateral; con 519 páginas el paquete pasó el tope de 120 MB de la plataforma y ninguna
 * sesión podía publicar. Cada ícono distinto se dibuja una sola vez por página y se referencia.
 */
describe('Docs: la barra lateral no repite los dibujos de los íconos', () => {
  it('cada dibujo de ícono de guía aparece una sola vez por página', () => {
    const html = renderToString(<Docs ruta="/docs/restaurants/order-photos" idioma="es" />);
    const referencias = (html.match(/<use href="#ig-/g) ?? []).length;
    const dibujos = (html.match(/<symbol id="ig-/g) ?? []).length;
    expect(referencias).toBeGreaterThan(100);
    expect(dibujos).toBe(ICONOS_GUIA.length);
    // Los únicos dibujos completos de lucide que quedan son los de los símbolos y los pocos de la
    // página (secciones, buscador), nunca uno por guía.
    const completos = (html.match(/class="lucide/g) ?? []).length;
    expect(completos).toBeLessThan(ICONOS_GUIA.length + 40);
  });
});
