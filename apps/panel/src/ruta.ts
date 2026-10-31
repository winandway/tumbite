import { useEffect, useState } from 'react';

/**
 * C-RUTA-SIN-BARRA (31 oct 2026): «/panel/» y «/panel» son la misma página. Con la barra final el
 * panel del restaurante caía en «Esta sección llega en el siguiente paso» (visto al entrar desde un
 * enlace). La dirección se lee sin la barra del final, salvo la portada «/».
 */
export function sinBarraFinal(ruta: string): string {
  return ruta.length > 1 ? ruta.replace(/\/+$/, '') || '/' : ruta;
}

/** Enrutador mínimo: lee la dirección del navegador y avisa cuando cambia. */
export function useRuta(): string {
  const [ruta, setRuta] = useState(() => sinBarraFinal(window.location.pathname));
  useEffect(() => {
    const alCambiar = () => setRuta(sinBarraFinal(window.location.pathname));
    window.addEventListener('popstate', alCambiar);
    return () => window.removeEventListener('popstate', alCambiar);
  }, []);
  return ruta;
}

export function ir(ruta: string): void {
  window.history.pushState(null, '', ruta);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}
