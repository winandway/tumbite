import { useEffect, useState } from 'react';
import type { Estado, Lugar } from './cobertura';

/**
 * F17 (29 oct 2026): el estado público de cada ciudad sale del servidor (interruptor del
 * superadmin). Mientras carga, o si el servidor no responde, manda la lista de la web: así nunca se
 * anuncia una ciudad activa por error. Una sola consulta por visita.
 */
let enCurso: Promise<Record<string, Estado>> | null = null;
function pedirEstados() {
  enCurso ??= fetch('/datos/web/ciudades')
    .then((r) => (r.ok ? (r.json() as Promise<{ ciudades: Record<string, Estado> }>) : null))
    .then((d) => d?.ciudades ?? {})
    .catch(() => ({}));
  return enCurso;
}

export function useCiudadesEnVivo() {
  const [vivos, setVivos] = useState<Record<string, Estado>>({});
  useEffect(() => {
    let vigente = true;
    void pedirEstados().then((e) => {
      if (vigente) setVivos(e);
    });
    return () => {
      vigente = false;
    };
  }, []);
  return (c: Pick<Lugar, 'slug' | 'estado'>): Estado => vivos[c.slug] ?? c.estado;
}

/** Solo para las pruebas: olvida lo consultado. */
export function olvidarCiudadesEnVivo() {
  enCurso = null;
}
