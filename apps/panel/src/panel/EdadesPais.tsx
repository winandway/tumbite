import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { pedir } from './api';
import { Insignia } from './diseno/Insignia';
import { palabra } from './diseno/palabras';

/**
 * C-EDAD-POR-PAIS (Richard, 25 nov 2026) — todos los países. La edad mínima de cada servicio en cada
 * país, en Sistema y configuración → Países y servicios. Se ve la de cada país (la del equipo o la de
 * por defecto) y se cambia una con su motivo (queda en el registro). La edad de cada conductor se
 * calcula con la fecha guardada en su cuenta.
 */
const T = {
  es: {
    titulo: 'Edad mínima por país y servicio',
    ayuda:
      'La edad que se pide para cada servicio en cada país. La edad de cada conductor se calcula con la fecha de nacimiento guardada en su cuenta.',
    pais: 'País',
    servicio: 'Servicio',
    edad: 'Edad mínima',
    motivo: 'Motivo del cambio de edad (queda en el registro)',
    motivoEjemplo: 'Por qué cambia y quién lo decidió',
    paisCambiar: 'País a cambiar',
    servicioCambiar: 'Servicio a cambiar',
    guardar: 'Guardar la edad',
    guardada: 'Edad guardada.',
    porDefecto: 'por defecto',
    delEquipo: 'fijada por el equipo',
    paises: { US: 'Estados Unidos', VE: 'Venezuela', PE: 'Perú', CO: 'Colombia' } as Record<
      string,
      string
    >,
    servicios: { moto: 'Moto', carro: 'Carro', comida: 'Comida', envios: 'Envíos' } as Record<
      string,
      string
    >,
    error: 'No pudimos traer las edades. Revisa tu conexión.',
  },
  en: {
    titulo: 'Minimum age by country and service',
    ayuda:
      'The age required for each service in each country. Each driver’s age is worked out from the date of birth saved on their account.',
    pais: 'Country',
    servicio: 'Service',
    edad: 'Minimum age',
    motivo: 'Reason for the age change (kept in the log)',
    motivoEjemplo: 'Why it changes and who decided',
    paisCambiar: 'Country to change',
    servicioCambiar: 'Service to change',
    guardar: 'Save the age',
    guardada: 'Age saved.',
    porDefecto: 'default',
    delEquipo: 'set by the team',
    paises: { US: 'United States', VE: 'Venezuela', PE: 'Peru', CO: 'Colombia' } as Record<
      string,
      string
    >,
    servicios: { moto: 'Moto', carro: 'Car', comida: 'Food', envios: 'Delivery' } as Record<
      string,
      string
    >,
    error: 'We couldn’t load the ages. Check your connection.',
  },
};

type Fila = {
  pais: string;
  servicios: { servicio: string; edad: number; porDefecto: number; fijada: boolean }[];
};

export function EdadesPais({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [paises, setPaises] = useState<Fila[] | null>(null);
  const [limites, setLimites] = useState({ minima: 16, maxima: 30 });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const b = useBorrador({
    formulario: 'edades-pais',
    cuenta: 'superadmin',
    inicial: { pais: 'VE', servicio: 'moto', edad: '', motivo: '' },
    almacen: almacenNavegador,
  });
  const cargar = useCallback(() => {
    pedir<{ paises: Fila[]; limites: { minima: number; maxima: number } }>(
      'GET',
      '/datos/admin/edades-pais',
    )
      .then((r) => {
        setPaises(Array.isArray(r?.paises) ? r.paises : []);
        if (r?.limites) setLimites(r.limites);
      })
      .catch(() => setError(t.error));
  }, [t.error]);
  useEffect(cargar, [cargar]);

  async function guardar() {
    setError('');
    setOk('');
    try {
      const r = await pedir<{ paises: Fila[] }>('PUT', '/datos/admin/edades-pais', {
        pais: b.valores.pais,
        servicio: b.valores.servicio,
        edad: Number(b.valores.edad),
        motivo: b.valores.motivo.trim(),
      });
      setPaises(r.paises);
      await b.limpiar();
      setOk(t.guardada);
    } catch (x) {
      // Lo escrito se queda para reintentar.
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  return (
    <section className="tarjeta-form" data-testid="edades-pais">
      <h2>{t.titulo}</h2>
      <p className="pista">{t.ayuda}</p>
      {paises ? (
        <div className="tabla-ancha">
          <table className="tabla">
            <thead>
              <tr>
                <th>{t.pais}</th>
                {(paises[0]?.servicios ?? []).map((s) => (
                  <th key={s.servicio}>{palabra(t.servicios, s.servicio)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paises.map((p) => (
                <tr key={p.pais} data-testid={`edades-${p.pais}`}>
                  <th scope="row">{palabra(t.paises, p.pais)}</th>
                  {p.servicios.map((s) => (
                    <td key={s.servicio} data-testid={`edad-${p.pais}-${s.servicio}`}>
                      <strong>{s.edad}</strong>{' '}
                      <Insignia tono={s.fijada ? 'hecho' : 'apagado'}>
                        {s.fijada ? t.delEquipo : t.porDefecto}
                      </Insignia>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        <AvisoBorrador
          visible={b.recuperado}
          idioma={idioma}
          empezar={() => void b.empezarDeNuevo()}
        />
        <div className="fila-botones">
          <label className="campo">
            <span>{t.paisCambiar}</span>
            <select value={b.valores.pais} onChange={(e) => b.cambiar('pais', e.target.value)}>
              {(paises ?? []).map((p) => (
                <option key={p.pais} value={p.pais}>
                  {palabra(t.paises, p.pais)}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            <span>{t.servicioCambiar}</span>
            <select
              value={b.valores.servicio}
              onChange={(e) => b.cambiar('servicio', e.target.value)}
            >
              {(paises?.[0]?.servicios ?? []).map((s) => (
                <option key={s.servicio} value={s.servicio}>
                  {palabra(t.servicios, s.servicio)}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            <span>{t.edad}</span>
            <input
              type="number"
              required
              min={limites.minima}
              max={limites.maxima}
              value={b.valores.edad}
              onChange={(e) => b.cambiar('edad', e.target.value)}
            />
          </label>
        </div>
        <label className="campo">
          <span>{t.motivo}</span>
          <input
            required
            minLength={3}
            maxLength={200}
            value={b.valores.motivo}
            placeholder={t.motivoEjemplo}
            onChange={(e) => b.cambiar('motivo', e.target.value)}
          />
        </label>
        <button
          type="submit"
          className="boton"
          disabled={!b.valores.edad || b.valores.motivo.trim().length < 3}
        >
          {t.guardar}
        </button>
      </form>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="texto-exito" role="status">
          {ok}
        </p>
      ) : null}
    </section>
  );
}
