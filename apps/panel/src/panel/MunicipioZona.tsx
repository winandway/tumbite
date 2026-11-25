import { useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { AyudaAqui } from './AyudaAqui';
import { pedir } from './api';

/**
 * C-ZONA-MUNICIPIO (24 nov 2026): el municipio de cada zona, todos los países. La casilla sugiere los
 * municipios oficiales del país (Venezuela: los 336 del INE, con El Vigía y Tucaní de Mérida primero)
 * y los que el equipo ya escribió en otras zonas; también se puede escribir uno que no esté. La lista
 * oficial pesa ~120 KB: se carga solo cuando se abre la pantalla de Zonas, no con todo el panel.
 */
const T = {
  es: {
    municipio: 'Municipio',
    ayuda: 'Elige uno de la lista o escríbelo si no aparece.',
    titulo: 'Municipio de la zona',
    actual: 'Hoy:',
    ninguno: 'sin municipio.',
    guardar: 'Guardar municipio',
    guardado: 'Municipio guardado',
  },
  en: {
    municipio: 'Municipality',
    ayuda: 'Pick one from the list or type it if it isn’t there.',
    titulo: 'Zone municipality',
    actual: 'Now:',
    ninguno: 'no municipality.',
    guardar: 'Save municipality',
    guardado: 'Municipality saved',
  },
};

/** Las etiquetas sugeridas para ese país (oficiales, primero las de su región) más las ya usadas. */
export function useSugerenciasMunicipio(
  pais: string,
  region: string,
  yaUsados: readonly string[] = [],
): string[] {
  // La lista cargada, con la llave (país y región) para la que se cargó.
  const llave = `${pais}|${region}`;
  const [cargada, setCargada] = useState<{ llave: string; lista: string[] }>({
    llave: '',
    lista: [],
  });
  useEffect(() => {
    if (pais.length !== 2) return;
    let vivo = true;
    import('@tumbite/compartido/src/pais/territorio')
      .then((m) => {
        if (vivo)
          setCargada({
            llave: `${pais}|${region}`,
            lista: m.sugerenciasMunicipio(pais, region).map((s) => s.etiqueta),
          });
      })
      .catch((e: unknown) => console.error('municipios: no se pudo cargar la lista', e));
    return () => {
      vivo = false;
    };
  }, [pais, region]);
  const oficiales = cargada.llave === llave ? cargada.lista : [];
  return [...new Set([...yaUsados.filter(Boolean), ...oficiales])];
}

/** La casilla con su lista (sugiere desde la primera letra y deja escribir libre). */
export function CampoMunicipio({
  id,
  valor,
  cambiar,
  sugerencias,
  idioma,
}: {
  id: string;
  valor: string;
  cambiar: (v: string) => void;
  sugerencias: readonly string[];
  idioma: Idioma;
}) {
  const t = enIdioma(T, idioma);
  const lista = `municipios-${id}`;
  return (
    <label className="campo">
      <span>{t.municipio}</span>
      <input
        value={valor}
        onChange={(e) => cambiar(e.target.value)}
        list={lista}
        maxLength={80}
        autoComplete="off"
        data-testid={`municipio-${id}`}
      />
      <small className="pista">{t.ayuda}</small>
      <datalist id={lista}>
        {sugerencias.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </label>
  );
}

/** Cambiar el municipio de una zona que ya existe (lo escrito se guarda en borrador). */
export function MunicipioZona({
  zona,
  cuenta,
  idioma,
  yaUsados,
  alGuardar,
}: {
  zona: { id: string; pais: string; municipioNombre?: string };
  cuenta: string;
  idioma: Idioma;
  yaUsados: readonly string[];
  alGuardar: () => Promise<unknown>;
}) {
  const t = enIdioma(T, idioma);
  const b = useBorrador({
    formulario: `municipio-zona-${zona.id}`,
    cuenta,
    inicial: { municipio: zona.municipioNombre ?? '' },
    almacen: almacenNavegador,
  });
  const sugerencias = useSugerenciasMunicipio(zona.pais, zona.id.split('-')[1] ?? '', yaUsados);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setAviso('');
    try {
      await pedir('PATCH', `/datos/admin/zonas/${zona.id}`, { municipio: b.valores.municipio });
      setAviso(t.guardado);
      await b.limpiar();
      await alGuardar();
    } catch (x) {
      // Lo escrito se queda en pantalla para reintentar.
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  return (
    <form
      onSubmit={guardar}
      className="formulario"
      style={{ flexBasis: '100%' }}
      data-testid={`municipio-zona-${zona.id}`}
    >
      <strong>
        {t.titulo} <AyudaAqui guia="zone-municipality" parrafo={1} idioma={idioma} />
      </strong>
      <span>
        {t.actual} {zona.municipioNombre || t.ninguno}
      </span>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <CampoMunicipio
        id={zona.id}
        valor={b.valores.municipio}
        cambiar={(v) => b.cambiar('municipio', v)}
        sugerencias={sugerencias}
        idioma={idioma}
      />
      {error && <p className="error">{error}</p>}
      {aviso && <p className="exito">{aviso}</p>}
      <button type="submit" className="boton secundario chico">
        {t.guardar}
      </button>
    </form>
  );
}
