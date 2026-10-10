import { useEffect, useState } from 'react';

/** Enrutador mínimo: lee la dirección del navegador y avisa cuando cambia. */
export function useRuta(): string {
  const [ruta, setRuta] = useState(() => window.location.pathname);
  useEffect(() => {
    const alCambiar = () => setRuta(window.location.pathname);
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
