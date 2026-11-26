import {
  type Idioma,
  type LugarCuenta,
  enIdioma,
  estadosDelPais,
  lugarEscrito,
} from '@tumbite/compartido';
import { Insignia } from './diseno/Insignia';
import { estadoLugarCuenta, nombrePaisCatalogo, textoLugar, tonoLugar } from './esperaCiudad';

/**
 * C-REGISTRO-TODO-EL-PAIS, parte C (25 nov 2026; Venezuela y Estados Unidos). Las piezas del lugar
 * donde vive una cuenta en las listas del superadmin (Repartidores, Embudo): la insignia
 * «En espera de su ciudad» / «Sin ciudad» y el filtro País → Estado.
 *
 * «En espera de su ciudad» va en ámbar (pendiente), NUNCA en rojo: la cuenta está bien, solo espera
 * a que abramos su ciudad. «Sin ciudad» va en gris: es una cuenta de antes que no dijo dónde vive.
 */
export function InsigniaLugar({
  fila,
  idioma,
}: {
  fila: { sinZona?: boolean; lugar?: LugarCuenta | null; enEspera?: boolean };
  idioma: Idioma;
}) {
  const estado = estadoLugarCuenta(fila);
  if (estado === 'en_zona') return null;
  return (
    <Insignia tono={tonoLugar(estado)} testId={`lugar-${estado}`}>
      {textoLugar(estado, idioma)}
    </Insignia>
  );
}

/** «Maracaibo, Zulia» o «—» si no dijo dónde vive. */
export const lugarCorto = (l: LugarCuenta | null | undefined) => (l ? lugarEscrito(l) : '—');

const T = {
  es: {
    pais: 'País donde vive',
    estado: 'Estado',
    todos: 'Todos',
  },
  en: {
    pais: 'Country they live in',
    estado: 'State',
    todos: 'All',
  },
};

export function FiltroLugar({
  pais,
  estado,
  cambiar,
  idioma,
}: {
  pais: string;
  estado: string;
  cambiar: (pais: string, estado: string) => void;
  idioma: Idioma;
}) {
  const t = enIdioma(T, idioma);
  return (
    <>
      <select
        value={pais}
        onChange={(e) => cambiar(e.target.value, '')}
        aria-label={t.pais}
        data-testid="filtro-lugar-pais"
      >
        <option value="">
          {t.pais}: {t.todos}
        </option>
        {(['VE', 'US'] as const).map((p) => (
          <option key={p} value={p}>
            {nombrePaisCatalogo(p, idioma)}
          </option>
        ))}
      </select>
      <select
        value={estado}
        onChange={(e) => cambiar(pais, e.target.value)}
        aria-label={t.estado}
        disabled={!pais}
        data-testid="filtro-lugar-estado"
      >
        <option value="">
          {t.estado}: {t.todos}
        </option>
        {estadosDelPais(pais).map((e) => (
          <option key={e.codigo} value={e.codigo}>
            {pais === 'US' ? `${e.nombre} (${e.codigo})` : e.nombre}
          </option>
        ))}
      </select>
    </>
  );
}
