import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { api } from './api';
import { AvisoBorrador } from './AvisoBorrador';

/**
 * C-REGRESO-PASAJERO (25 nov 2026; todos los países): los números del «Voy de regreso a mi ciudad»
 * de cada país. Sin cambios, los de siempre (25 km, 45°, 5 km y +3 km). El despacho los usa en la
 * vuelta siguiente; el cambio queda en la auditoría. Los precios y las comisiones no se tocan aquí.
 */
const T = {
  es: {
    titulo: 'Regreso a la ciudad base, por país',
    ayuda:
      'El conductor que termina un viaje largo puede tocar «Voy de regreso a su ciudad»: solo le llegan viajes hacia allá y pasa primero en la fila. Aquí se ajustan los números de cada país. No cambian precios ni comisiones.',
    pais: 'País',
    kmMinimo: 'El botón aparece a más de (km de su ciudad)',
    anguloMaximo: 'Rumbo del viaje: desvío máximo (grados)',
    acercaMinimoKm: 'El viaje lo acerca a su ciudad, como mínimo (km)',
    extraRecogidaKm: 'Pasa adelante si su recogida está a no más de la del más cercano + (km)',
    propios: 'ajustado',
    deSiempre: 'los de siempre',
    guardar: 'Guardar los números',
    guardado: 'Guardado. El despacho ya los usa.',
    elegir: 'Elige un país',
  },
  en: {
    titulo: 'Heading home, by country',
    ayuda:
      'A driver who finishes a long trip can tap “Heading home to their city”: they only get trips going that way and go first in line. Adjust each country’s numbers here. Prices and fees don’t change.',
    pais: 'Country',
    kmMinimo: 'The button shows beyond (km from their city)',
    anguloMaximo: 'Trip direction: maximum deviation (degrees)',
    acercaMinimoKm: 'The trip brings them closer to their city by at least (km)',
    extraRecogidaKm: 'They go first if their pickup is no more than the closest driver’s + (km)',
    propios: 'adjusted',
    deSiempre: 'defaults',
    guardar: 'Save the numbers',
    guardado: 'Saved. Dispatch uses them now.',
    elegir: 'Choose a country',
  },
};

type Numeros = {
  kmMinimo: number;
  anguloMaximo: number;
  acercaMinimoKm: number;
  extraRecogidaKm: number;
};
type Pais = Numeros & { pais: string; propios: boolean };
type Respuesta = {
  iniciales: Numeros;
  limites: Record<keyof Numeros, [number, number]>;
  paises: Pais[];
};

function Numero({
  etiqueta,
  limites,
  valor,
  cambiar,
}: {
  etiqueta: string;
  limites?: [number, number];
  valor: string;
  cambiar: (v: string) => void;
}) {
  return (
    <label className="campo">
      <span>{etiqueta}</span>
      <input
        type="number"
        inputMode="decimal"
        step="0.5"
        min={limites?.[0]}
        max={limites?.[1]}
        value={valor}
        onChange={(e) => cambiar(e.target.value)}
        required
      />
    </label>
  );
}

export function RegresoAjustes({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [falla, setFalla] = useState('');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const b = useBorrador({
    formulario: 'regreso-ajustes-pais',
    inicial: { pais: '', kmMinimo: '', anguloMaximo: '', acercaMinimoKm: '', extraRecogidaKm: '' },
    almacen: almacenNavegador,
  });
  const cargar = useCallback(() => {
    api
      .pedir<Respuesta>('GET', '/datos/admin/regreso/ajustes')
      .then(setDatos)
      .catch((x: unknown) => setFalla(x instanceof ErrorApi ? x.message : String(x)));
  }, []);
  useEffect(cargar, [cargar]);

  function elegirPais(pais: string) {
    const p = datos?.paises?.find((x) => x.pais === pais);
    b.cambiar('pais', pais);
    if (!p) return;
    b.cambiar('kmMinimo', String(p.kmMinimo));
    b.cambiar('anguloMaximo', String(p.anguloMaximo));
    b.cambiar('acercaMinimoKm', String(p.acercaMinimoKm));
    b.cambiar('extraRecogidaKm', String(p.extraRecogidaKm));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setFalla('');
    setAviso('');
    setEnviando(true);
    try {
      await api.pedir('PUT', '/datos/admin/regreso/ajustes', {
        pais: b.valores.pais,
        kmMinimo: Number(b.valores.kmMinimo),
        anguloMaximo: Number(b.valores.anguloMaximo),
        acercaMinimoKm: Number(b.valores.acercaMinimoKm),
        extraRecogidaKm: Number(b.valores.extraRecogidaKm),
      });
      await b.limpiar();
      setAviso(t.guardado);
      cargar();
    } catch (x) {
      // Lo escrito se queda para corregirlo.
      setFalla(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section data-testid="regreso-ajustes">
      <h2>{t.titulo}</h2>
      <p>{t.ayuda}</p>
      {falla && (
        <p className="error-general" role="alert">
          {falla}
        </p>
      )}
      {aviso && <p role="status">{aviso}</p>}
      {datos?.paises?.length ? (
        <ul className="tarjetas">
          {datos.paises.map((p) => (
            <li key={p.pais}>
              <strong>{p.pais}</strong> · {p.kmMinimo} km · {p.anguloMaximo}° · {p.acercaMinimoKm}{' '}
              km · +{p.extraRecogidaKm} km · {p.propios ? t.propios : t.deSiempre}
            </li>
          ))}
        </ul>
      ) : null}
      <form className="flex-form" onSubmit={(e) => void guardar(e)}>
        <AvisoBorrador
          visible={b.recuperado}
          idioma={idioma}
          empezar={() => void b.empezarDeNuevo()}
        />
        <label className="campo">
          <span>{t.pais}</span>
          <select value={b.valores.pais} onChange={(e) => elegirPais(e.target.value)} required>
            <option value="">{t.elegir}</option>
            {(datos?.paises ?? []).map((p) => (
              <option key={p.pais} value={p.pais}>
                {p.pais}
              </option>
            ))}
          </select>
        </label>
        <Numero
          etiqueta={t.kmMinimo}
          limites={datos?.limites?.kmMinimo}
          valor={b.valores.kmMinimo}
          cambiar={(v) => b.cambiar('kmMinimo', v)}
        />
        <Numero
          etiqueta={t.anguloMaximo}
          limites={datos?.limites?.anguloMaximo}
          valor={b.valores.anguloMaximo}
          cambiar={(v) => b.cambiar('anguloMaximo', v)}
        />
        <Numero
          etiqueta={t.acercaMinimoKm}
          limites={datos?.limites?.acercaMinimoKm}
          valor={b.valores.acercaMinimoKm}
          cambiar={(v) => b.cambiar('acercaMinimoKm', v)}
        />
        <Numero
          etiqueta={t.extraRecogidaKm}
          limites={datos?.limites?.extraRecogidaKm}
          valor={b.valores.extraRecogidaKm}
          cambiar={(v) => b.cambiar('extraRecogidaKm', v)}
        />
        <button type="submit" className="boton" disabled={enviando || !b.valores.pais}>
          {t.guardar}
        </button>
      </form>
    </section>
  );
}
