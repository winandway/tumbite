import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  QUIEN_PAGA,
  type QuienPaga,
  almacenNavegador,
  repartirComision,
  useBorrador,
} from '@tumbite/compartido';
import { AyudaAqui } from './AyudaAqui';
import { pedir } from './api';

/**
 * C-QUIEN-PAGA-VIAJES (23 nov 2026, orden de Richard): la palanca de quién paga la comisión de
 * Divoox en los viajes (Moto y Carro), por país y, si hace falta, por ciudad. El porcentaje no se
 * toca aquí (sale de las políticas de comisión): solo quién lo carga. Vale para los viajes que se
 * cotizan desde ahora; los que ya están en curso siguen con lo que tenían.
 */
type Regla = { pais: string; ciudad: string | null; valor: QuienPaga; cambiadoEn: string };
type Ciudad = { id: string; nombre: string; pais: string };

const T = {
  es: {
    titulo: '¿Quién paga la comisión de Divoox en los viajes?',
    ayuda:
      'Moto y Carro. El porcentaje sale de la política de comisión; aquí solo se elige quién lo paga. Cambiarlo vale para los viajes que se piden desde ahora.',
    valores: {
      conductor: 'El conductor (sale de su ganancia, como siempre)',
      cliente: 'El cliente (tarifa de servicio aparte, a la vista)',
      mitad: 'Mitad y mitad',
    } as Record<QuienPaga, string>,
    corto: { conductor: 'Conductor', cliente: 'Cliente', mitad: 'Mitad y mitad' } as Record<
      QuienPaga,
      string
    >,
    delPais: 'Como el resto del país',
    pais: 'País',
    ciudad: 'Ciudad',
    todoElPais: 'Todo el país',
    sinReglas: 'Sin reglas: en todos los países paga el conductor.',
    resto: 'En los demás países paga el conductor.',
    guardar: 'Guardar',
    guardado: 'Guardado. Vale para los viajes que se pidan desde ahora.',
    ejemplo: (v: QuienPaga) => {
      const r = repartirComision(20, v);
      return `Ejemplo con un viaje de 2,00 y 10 % de comisión: el pasajero paga ${((200 + r.tarifaServicio) / 100).toFixed(2).replace('.', ',')} y el conductor se queda con ${((200 - r.parteConductor) / 100).toFixed(2).replace('.', ',')}.`;
    },
  },
  en: {
    titulo: 'Who pays the Divoox fee on rides?',
    ayuda:
      'Moto and Car. The percentage comes from the fee policy; here you only choose who pays it. A change applies to rides requested from now on.',
    valores: {
      conductor: 'The driver (out of their earnings, as always)',
      cliente: 'The rider (separate service fee, shown upfront)',
      mitad: 'Half and half',
    } as Record<QuienPaga, string>,
    corto: { conductor: 'Driver', cliente: 'Rider', mitad: 'Half and half' } as Record<
      QuienPaga,
      string
    >,
    delPais: 'Same as the rest of the country',
    pais: 'Country',
    ciudad: 'City',
    todoElPais: 'Whole country',
    sinReglas: 'No rules: the driver pays in every country.',
    resto: 'In every other country the driver pays.',
    guardar: 'Save',
    guardado: 'Saved. It applies to rides requested from now on.',
    ejemplo: (v: QuienPaga) => {
      const r = repartirComision(20, v);
      return `Example with a 2.00 ride and a 10% fee: the rider pays ${((200 + r.tarifaServicio) / 100).toFixed(2)} and the driver keeps ${((200 - r.parteConductor) / 100).toFixed(2)}.`;
    },
  },
};

const mensaje = (x: unknown) => (x instanceof ErrorApi ? x.message : String(x));

export function QuienPagaViajes({ idioma }: { idioma: 'es' | 'en' }) {
  const t = idioma === 'en' ? T.en : T.es;
  const [reglas, setReglas] = useState<Regla[] | null>(null);
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [enviando, setEnviando] = useState(false);
  const b = useBorrador({
    formulario: 'super-fin-quien-paga',
    inicial: { pais: 'VE', ciudad: '', valor: 'cliente' },
    almacen: almacenNavegador,
  });
  const v = b.valores;
  const cargar = useCallback(() => {
    pedir<{ reglas: Regla[]; ciudades: Ciudad[] }>('GET', '/datos/admin/finanzas/quien-paga')
      .then((r) => {
        setReglas(r.reglas);
        setCiudades(r.ciudades);
      })
      .catch((x: unknown) => setError(mensaje(x)));
  }, []);
  useEffect(cargar, [cargar]);
  const paises = [
    ...new Set([...ciudades.map((c) => c.pais), ...(reglas ?? []).map((r) => r.pais)]),
  ].sort();
  const nombreCiudad = (id: string | null) =>
    id ? (ciudades.find((c) => c.id === id)?.nombre ?? id) : t.todoElPais;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    setEnviando(true);
    try {
      await pedir('PUT', '/datos/admin/finanzas/quien-paga', {
        pais: v.pais,
        ...(v.ciudad ? { ciudad: v.ciudad } : {}),
        valor: v.valor,
      });
      await b.limpiar();
      setOk(t.guardado);
      cargar();
    } catch (x) {
      // Lo elegido se queda en pantalla para reintentar.
      setError(mensaje(x));
    } finally {
      setEnviando(false);
    }
  }

  const opciones: string[] = v.ciudad ? [...QUIEN_PAGA, 'del_pais'] : [...QUIEN_PAGA];
  return (
    <section data-testid="quien-paga-viajes">
      <h2>
        {t.titulo} <AyudaAqui guia="who-pays-ride-fee" idioma={idioma} />
      </h2>
      <p className="pista">{t.ayuda}</p>
      {reglas && reglas.length === 0 ? <p>{t.sinReglas}</p> : null}
      {reglas && reglas.length > 0 ? (
        <>
          <ul className="lista-simple" data-testid="quien-paga-reglas">
            {reglas.map((r) => (
              <li key={`${r.pais}:${r.ciudad ?? ''}`}>
                <strong>
                  {r.pais} · {nombreCiudad(r.ciudad)}
                </strong>{' '}
                — {t.corto[r.valor]}
              </li>
            ))}
          </ul>
          <p className="pista">{t.resto}</p>
        </>
      ) : null}
      <form className="flex-form" noValidate onSubmit={(e) => void guardar(e)}>
        {b.recuperado ? (
          <p className="aviso-borrador">
            {idioma === 'en'
              ? 'We recovered what you were typing.'
              : 'Recuperamos lo que estabas escribiendo.'}{' '}
            <button type="button" className="enlace" onClick={() => void b.empezarDeNuevo()}>
              {idioma === 'en' ? 'Start over' : 'Empezar de nuevo'}
            </button>
          </p>
        ) : null}
        <div className="flex-inline">
          <div className="campo">
            <label htmlFor="qp-pais">{t.pais}</label>
            <select
              id="qp-pais"
              value={v.pais}
              onChange={(e) => {
                b.cambiar('pais', e.target.value);
                b.cambiar('ciudad', '');
              }}
            >
              {(paises.length ? paises : ['VE']).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="qp-ciudad">{t.ciudad}</label>
            <select
              id="qp-ciudad"
              value={v.ciudad}
              onChange={(e) => {
                b.cambiar('ciudad', e.target.value);
                if (!e.target.value && v.valor === 'del_pais') b.cambiar('valor', 'conductor');
              }}
            >
              <option value="">{t.todoElPais}</option>
              {ciudades
                .filter((c) => c.pais === v.pais)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <fieldset className="campo">
          {opciones.map((o) => (
            <label key={o} style={{ display: 'block', margin: '6px 0' }}>
              <input
                type="radio"
                name="qp-valor"
                value={o}
                checked={v.valor === o}
                onChange={() => b.cambiar('valor', o)}
              />{' '}
              {o === 'del_pais' ? t.delPais : t.valores[o as QuienPaga]}
            </label>
          ))}
        </fieldset>
        {v.valor !== 'del_pais' ? (
          <p className="pista" data-testid="quien-paga-ejemplo">
            {t.ejemplo(v.valor as QuienPaga)}
          </p>
        ) : null}
        {error ? (
          <p className="texto-error" role="alert">
            {error}
          </p>
        ) : null}
        {ok ? (
          <p className="texto-exito" role="status">
            {ok}
          </p>
        ) : null}
        <div className="fila-botones">
          <button type="submit" className="boton" disabled={enviando}>
            {t.guardar}
          </button>
        </div>
      </form>
    </section>
  );
}
