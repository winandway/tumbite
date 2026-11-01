/**
 * C-FLEX-PRIMEROS-PASOS (1 nov 2026): los pasos para arrancar con Divoox Flex, como el asistente de
 * Onfleet y Spoke. Cada paso se marca solo con lo que la empresa ya hizo; el de las etiquetas se
 * recuerda en este navegador cuando se imprimen (el servidor no sabe si se imprimieron).
 */
const clave = (empresaId: string) => `divoox.flex.etiquetas-impresas.${empresaId}`;

export function marcarEtiquetasImpresas(empresaId: string) {
  try {
    localStorage.setItem(clave(empresaId), '1');
  } catch {
    // Sin almacenamiento (ventana privada): el paso queda sin marcar, nada más.
  }
}

export function etiquetasImpresas(empresaId: string) {
  try {
    return localStorage.getItem(clave(empresaId)) === '1';
  } catch {
    return false;
  }
}

export type PasoFlex = { clave: string; hecho: boolean; destino: string };

export function pasosFlex(
  raiz: string,
  empresaId: string,
  r: Record<string, number | undefined>,
): PasoFlex[] {
  const n = (k: string) => Number(new Map(Object.entries(r)).get(k) ?? 0);
  return [
    { clave: 'empresa', hecho: true, destino: `${raiz}/profile` },
    { clave: 'centro', hecho: n('centros') > 0, destino: `${raiz}/hubs` },
    { clave: 'conductor', hecho: n('conductores') > 0, destino: `${raiz}/drivers` },
    { clave: 'envio', hecho: n('envios') > 0, destino: `${raiz}/shipments/new` },
    { clave: 'etiquetas', hecho: etiquetasImpresas(empresaId), destino: `${raiz}/labels` },
    { clave: 'ruta', hecho: n('rutasAsignadas') > 0, destino: `${raiz}/routes` },
    { clave: 'entrega', hecho: n('entregados') > 0, destino: `${raiz}/operativas` },
  ];
}
