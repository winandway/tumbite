import { useMemo, useState } from 'react';
import {
  aLugarCuenta,
  buscarLugares,
  buscarMunicipios,
  municipiosDelEstado,
  useLugaresCatalogo,
  type CatalogoLugares,
  type LugarCatalogo,
  type ResultadoLugar,
} from './catalogoLugares';
import {
  estadosDelPais,
  PAISES_CON_CATALOGO,
  sinAcentos,
  type EstadoDelPais,
  type LugarCuenta,
  type PaisConCatalogo,
} from './lugarCuenta';
import type { Idioma } from './idiomas';

/**
 * C-REGISTRO-TODO-EL-PAIS (25 nov 2026) — Venezuela y Estados Unidos.
 *
 * La lógica ÚNICA del selector «Dónde vives» (País → Estado → Ciudad, con buscador directo arriba).
 * La usan las dos piezas que se ven: `SelectorLugar` de las apps (packages/movil) y el de la web
 * (apps/panel). Nada de esto lee las zonas abiertas: es el catálogo completo del país
 * (C-SIN-LISTA-DE-CIUDADES). La persona nunca se queda sin poder seguir: si no encuentra su pueblo,
 * elige su municipio (o condado) y queda en su ciudad principal.
 */

export type PasoSelectorLugar = 'pais' | 'estado' | 'ciudad' | 'municipio';

const ES = {
  etiqueta: 'Dónde vives',
  ayuda: 'La ciudad o el pueblo donde vives.',
  elegir: 'Elige tu ciudad',
  cambiar: 'Cambiar',
  tituloPais: 'Elige tu país',
  tituloEstado: 'Elige tu estado',
  tituloCiudad: 'Elige tu ciudad o pueblo',
  tituloMunicipioVE: 'Elige tu municipio',
  tituloMunicipioUS: 'Elige tu condado',
  buscarTodo: 'Escribe tu ciudad',
  buscarEn: (estado: string) => `Busca en ${estado}`,
  buscarMunicipio: 'Busca tu municipio',
  buscarCondado: 'Busca tu condado',
  oEligeEstado: 'O elige tu estado',
  masPobladas: 'Ciudades más grandes',
  noEncuentroVE: '¿No encuentras tu pueblo? Elige tu municipio',
  noEncuentroUS: '¿No encuentras tu pueblo? Elige tu condado',
  quedarasEn: (ciudad: string) => `Quedarás en ${ciudad}, la ciudad principal.`,
  sinResultados: (q: string) =>
    `No encontramos «${q}». Revisa cómo se escribe o elige tu estado y búscalo ahí.`,
  sinResultadosEstado: (q: string) =>
    `No encontramos «${q}» en este estado. Revisa cómo se escribe o elige tu municipio abajo.`,
  cargando: 'Cargando…',
  fallo: 'No pudimos cargar la lista. Revisa tu conexión.',
  reintentar: 'Reintentar',
  volver: 'Volver',
  cerrar: 'Cerrar',
  municipio: 'Municipio',
  condado: 'Condado',
  faltaLugar: 'Elige dónde vives.',
  credito: 'Lugares: GeoNames (CC BY 4.0)',
  // Después de crear la cuenta (C-REGISTRO-TODO-EL-PAIS, punto 5).
  enEsperaConductor:
    'Tu cuenta quedó creada. En tu ciudad todavía no hay viajes; te avisamos apenas abramos.',
  enEsperaCliente:
    'Tu cuenta quedó creada. En tu ciudad todavía no hay servicio; te avisamos apenas abramos.',
  sigueSubiendo: 'Mientras tanto, puedes subir tus fotos y tus papeles.',
  preguntaTitulo: '¿Dónde vives?',
  preguntaAyuda: 'Elige tu ciudad para terminar tu cuenta. No pierdes nada de lo que ya subiste.',
  ahoraNo: 'Ahora no',
  entendido: 'Entendido',
  guardando: 'Guardando…',
  noSeGuardo: 'No se pudo guardar. Revisa tu conexión e intenta de nuevo.',
  tuCiudad: 'Tu ciudad',
};

const EN: typeof ES = {
  etiqueta: 'Where you live',
  ayuda: 'The city or town where you live.',
  elegir: 'Choose your city',
  cambiar: 'Change',
  tituloPais: 'Choose your country',
  tituloEstado: 'Choose your state',
  tituloCiudad: 'Choose your city or town',
  tituloMunicipioVE: 'Choose your municipality',
  tituloMunicipioUS: 'Choose your county',
  buscarTodo: 'Type your city',
  buscarEn: (estado: string) => `Search in ${estado}`,
  buscarMunicipio: 'Search your municipality',
  buscarCondado: 'Search your county',
  oEligeEstado: 'Or choose your state',
  masPobladas: 'Largest cities',
  noEncuentroVE: 'Can’t find your town? Choose your municipality',
  noEncuentroUS: 'Can’t find your town? Choose your county',
  quedarasEn: (ciudad: string) => `You’ll be set to ${ciudad}, its main city.`,
  sinResultados: (q: string) =>
    `We couldn’t find “${q}.” Check the spelling or choose your state and search there.`,
  sinResultadosEstado: (q: string) =>
    `We couldn’t find “${q}” in this state. Check the spelling or choose your county below.`,
  cargando: 'Loading…',
  fallo: 'We couldn’t load the list. Check your connection.',
  reintentar: 'Try again',
  volver: 'Back',
  cerrar: 'Close',
  municipio: 'Municipality',
  condado: 'County',
  faltaLugar: 'Choose where you live.',
  credito: 'Places: GeoNames (CC BY 4.0)',
  enEsperaConductor:
    'Your account is ready. There are no trips in your city yet; we’ll let you know as soon as we open.',
  enEsperaCliente:
    'Your account is ready. There’s no service in your city yet; we’ll let you know as soon as we open.',
  sigueSubiendo: 'In the meantime, you can upload your photos and documents.',
  preguntaTitulo: 'Where do you live?',
  preguntaAyuda: 'Choose your city to finish your account. Nothing you already uploaded is lost.',
  ahoraNo: 'Not now',
  entendido: 'Got it',
  guardando: 'Saving…',
  noSeGuardo: 'It couldn’t be saved. Check your connection and try again.',
  tuCiudad: 'Your city',
};

export const textosSelectorLugar = (idioma: Idioma) => (idioma === 'en' ? EN : ES);

/** «Michigan (MI)» en EE. UU.; «Zulia» en Venezuela. */
export function estadoEscrito(pais: PaisConCatalogo, e: EstadoDelPais): string {
  return pais === 'US' ? `${e.nombre} (${e.codigo})` : e.nombre;
}

/** Los países que se pueden elegir, con el sugerido primero. */
export function paisesParaElegir(sugerido?: string | null): PaisConCatalogo[] {
  const s = String(sugerido ?? '').toUpperCase();
  return [...PAISES_CON_CATALOGO].sort((a, b) => Number(b === s) - Number(a === s));
}

/** Los estados que coinciden con lo escrito (por nombre o por código). */
export function buscarEstados(pais: PaisConCatalogo, consulta: string): readonly EstadoDelPais[] {
  const q = sinAcentos(consulta);
  const todos = estadosDelPais(pais);
  if (!q) return todos;
  return todos.filter((e) => {
    const n = sinAcentos(e.nombre);
    return n.startsWith(q) || n.includes(` ${q}`) || e.codigo.toLowerCase() === q;
  });
}

/**
 * El estado del selector. `alElegir` recibe el lugar listo para mandar al servidor (contrato de
 * lugarCuenta.ts). Arranca en el país sugerido (o en elegir país si no hay uno con catálogo).
 */
export function useSelectorLugar(op: {
  catalogo: CatalogoLugares;
  paisSugerido?: string | null;
  inicial?: LugarCuenta | null;
  alElegir: (l: LugarCuenta) => void;
}) {
  const sugerido = paisesParaElegir(op.inicial?.pais ?? op.paisSugerido)[0] ?? 'US';
  const conSugerido =
    Boolean(op.inicial) ||
    PAISES_CON_CATALOGO.includes(String(op.paisSugerido ?? '').toUpperCase() as PaisConCatalogo);
  const [pais, setPais] = useState<PaisConCatalogo | null>(conSugerido ? sugerido : null);
  const [estado, setEstado] = useState<string | null>(null);
  const [paso, setPaso] = useState<PasoSelectorLugar>(conSugerido ? 'estado' : 'pais');
  const [consulta, setConsulta] = useState('');
  const fuente = useLugaresCatalogo(
    op.catalogo,
    pais,
    paso === 'ciudad' || paso === 'municipio' ? estado : null,
  );
  const resultados: ResultadoLugar[] = useMemo(() => {
    if (paso === 'pais' || paso === 'municipio') return [];
    if (paso === 'estado' && !consulta.trim()) return [];
    return buscarLugares(fuente.lugares, consulta, paso === 'estado' ? 12 : 60);
  }, [fuente.lugares, consulta, paso]);
  const municipios: LugarCatalogo[] = useMemo(
    () =>
      paso === 'municipio' ? buscarMunicipios(municipiosDelEstado(fuente.lugares), consulta) : [],
    [fuente.lugares, consulta, paso],
  );
  const estados = pais && paso === 'estado' ? buscarEstados(pais, consulta) : [];

  return {
    paso,
    pais,
    estado,
    consulta,
    resultados,
    municipios,
    estados,
    cargando: fuente.cargando,
    fallo: fuente.fallo,
    reintentar: fuente.reintentar,
    cambiarConsulta: setConsulta,
    elegirPais(p: PaisConCatalogo) {
      setPais(p);
      setEstado(null);
      setConsulta('');
      setPaso('estado');
    },
    elegirEstado(codigo: string) {
      setEstado(codigo);
      setConsulta('');
      setPaso('ciudad');
    },
    verMunicipios() {
      setConsulta('');
      setPaso('municipio');
    },
    elegir(l: LugarCatalogo) {
      op.alElegir(aLugarCuenta(l));
    },
    /** Un paso atrás; false si ya estaba en el primero (quien lo usa cierra la ventana). */
    volver(): boolean {
      setConsulta('');
      if (paso === 'municipio') setPaso('ciudad');
      else if (paso === 'ciudad') setPaso('estado');
      else if (paso === 'estado') setPaso('pais');
      else return false;
      return true;
    },
  };
}
export type SelectorLugarEstado = ReturnType<typeof useSelectorLugar>;
