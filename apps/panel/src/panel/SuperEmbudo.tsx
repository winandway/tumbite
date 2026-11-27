import { useEffect, useState } from 'react';
import {
  type Idioma,
  type PasoRegistro,
  ErrorApi,
  NOMBRE_HITO,
  NOMBRE_MOTIVO_HITO,
  NOMBRE_PASO,
  enIdioma,
  pasoQueNoFrena,
} from '@tumbite/compartido';
import { AyudaAqui } from './AyudaAqui';
import { FiltroEstadoLugar } from './LugarCuentaPanel';
import { ciudadEscrita } from './esperaCiudad';
import { CampoFecha } from './CampoFecha';
import { pedir } from './api';
import { Insignia } from './diseno/Insignia';
import { IntentosAcceso } from './IntentosAcceso';
import { usePreferencias } from './usePreferencias';

/**
 * C-RASTRO (22 nov 2026, Richard): el embudo del registro. Cuántas personas llegan a cada paso y dónde
 * se quedan, por app, país y zona, solo con cuentas reales. Los tres primeros pasos pasan antes de
 * crear la cuenta: son contadores, sin persona.
 */
type Embudo = {
  app: 'repartidor' | 'cliente';
  desde: string;
  hasta: string;
  pasos: { paso: PasoRegistro; personas: number; seQuedan: number | null }[];
  porPais: { pais: string; cuentas: number }[];
  /** C-FOTO-CARA-A-LA-VISTA: dónde se traban (un servidor de antes no lo manda). */
  hitos?: { hito: string; motivo: string; personas: number }[];
  /**
   * C-REGISTRO-TODO-EL-PAIS: dónde viven las cuentas del período (País → Estado → Ciudad), con
   * cuántas esperan su ciudad, y cuántas no dijeron dónde viven. Un servidor de antes no lo manda.
   */
  porLugar?: {
    pais: string;
    estado: string;
    ciudad: string;
    lugarId: string;
    personas: number;
    enEspera: number;
  }[];
  sinLugar?: number;
};
type Zona = { id: string; nombre: string; pais: string };

const T = {
  es: {
    titulo: 'Embudo de registro',
    ayuda:
      'De las cuentas creadas en el período: cuántas llegaron a cada paso y en cuál se quedó cada una. Solo cuentas reales; las de prueba no cuentan.',
    app: 'App',
    apps: { repartidor: 'Divoox Driver (conductores)', cliente: 'App de clientes' },
    desde: 'Desde',
    hasta: 'Hasta',
    pais: 'País',
    zona: 'Zona',
    todos: 'Todos',
    todas: 'Todas',
    ver: 'Ver embudo',
    paso: 'Paso',
    personas: 'Personas',
    seVan: 'Se quedaron aquí',
    completaron: 'Llegaron al final',
    noFrena: 'Correo por confirmar (no frena): se confirma en segundo plano',
    vacio: 'No hay registros en ese período.',
    anonimos:
      'Los tres primeros pasos pasan antes de crear la cuenta: se cuentan sin saber quién es la persona. Con una zona elegida no se muestran, porque todavía no se sabe de qué zona son.',
    mayor: 'Aquí se queda la mayoría',
    porPais: 'Cuentas creadas por país de la red',
    sinPais: 'Sin país',
    cuentas: 'Cuentas',
    hitos: 'Dónde se traban (foto de la cara y conexión)',
    hitosAyuda:
      'De las mismas cuentas: cuántas personas vieron, abrieron o sufrieron cada cosa al menos una vez.',
    porLugar: 'Dónde viven',
    porLugarAyuda:
      '«En espera de su ciudad» no es un error: su cuenta está creada y pasa sola a la zona el día que abramos ahí.',
    ciudad: 'Ciudad',
    enEspera: 'En espera de su ciudad',
    sinLugar: (n: number) =>
      `${n} ${n === 1 ? 'cuenta no dijo' : 'cuentas no dijeron'} dónde vive${n === 1 ? '' : 'n'} (sin ciudad).`,
  },
  en: {
    titulo: 'Sign-up funnel',
    ayuda:
      'For accounts created in the period: how many reached each step and where each one stopped. Real accounts only; test accounts are not counted.',
    app: 'App',
    apps: { repartidor: 'Divoox Driver (drivers)', cliente: 'Customer app' },
    desde: 'From',
    hasta: 'To',
    pais: 'Country',
    zona: 'Zone',
    todos: 'All',
    todas: 'All',
    ver: 'See funnel',
    paso: 'Step',
    personas: 'People',
    seVan: 'Stopped here',
    completaron: 'Reached the end',
    noFrena: 'Email to confirm (doesn’t block): confirmed in the background',
    vacio: 'No sign-ups in that period.',
    anonimos:
      'The first three steps happen before the account exists: they are counted without knowing who the person is. They are hidden when a zone is selected, because the zone is not known yet.',
    mayor: 'Most people stop here',
    porPais: 'Accounts created by network country',
    sinPais: 'No country',
    cuentas: 'Accounts',
    hitos: 'Where they get stuck (face photo and going online)',
    hitosAyuda:
      'For the same accounts: how many people saw, opened or hit each thing at least once.',
    porLugar: 'Where they live',
    porLugarAyuda:
      '“Waiting for their city” is not an error: their account exists and moves into the zone on its own the day we open there.',
    ciudad: 'City',
    enEspera: 'Waiting for their city',
    sinLugar: (n: number) =>
      `${n} ${n === 1 ? 'account' : 'accounts'} never said where they live (no city).`,
  },
};

const NOMBRES = new Map(Object.entries(NOMBRE_PASO));
const nombrePaso = (p: string, idioma: Idioma) => {
  const n = NOMBRES.get(p);
  return n ? enIdioma(n, idioma) : p;
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
const HITOS = new Map(Object.entries(NOMBRE_HITO));
const MOTIVOS = new Map(Object.entries(NOMBRE_MOTIVO_HITO));
/** «No lo dejamos conectarse · falta la foto de la cara». */
export function textoHito(hito: string, motivo: string, idioma: Idioma) {
  const h = HITOS.get(hito);
  const m = motivo ? MOTIVOS.get(motivo) : undefined;
  return [h ? enIdioma(h, idioma) : hito, motivo ? (m ? enIdioma(m, idioma) : motivo) : '']
    .filter(Boolean)
    .join(' · ');
}

/** El paso donde se queda más gente (null si nadie se quedó en ninguno). */
export function dondeSeQuedanMas(pasos: { paso: string; seQuedan: number | null }[]) {
  return pasos.reduce<{ paso: string; seQuedan: number } | null>(
    (m, f) =>
      f.seQuedan != null && f.seQuedan > (m?.seQuedan ?? 0)
        ? { paso: f.paso, seQuedan: f.seQuedan }
        : m,
    null,
  );
}

export function SuperEmbudo({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  // La app y la zona elegidas se recuerdan por empleado (C-FILTROS-GUARDADOS).
  // C-REGISTRO-TODO-EL-PAIS: «region» es el estado donde VIVE (solo con Venezuela o Estados Unidos).
  const pref = usePreferencias('embudo', { servicio: 'repartidor', zona: '', region: '' });
  const app = pref.valores.servicio === 'cliente' ? 'cliente' : 'repartidor';
  const zona = pref.valores.zona ?? '';
  const [desde, setDesde] = useState(() => iso(new Date(Date.now() - 29 * 86_400_000)));
  const [hasta, setHasta] = useState(() => iso(new Date()));
  const [pais, setPais] = useState('');
  const lugarEstado = pais === 'VE' || pais === 'US' ? (pref.valores.region ?? '') : '';
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [res, setRes] = useState<{ consulta: string; x?: Embudo; error?: string } | null>(null);
  useEffect(() => {
    pedir<{ zonas: Zona[] }>('GET', '/datos/admin/zonas')
      .then((r) => setZonas(r.zonas))
      .catch((e: unknown) => console.warn('embudo: no se pudieron leer las zonas', e));
  }, []);
  const consulta = `app=${app}&desde=${desde}&hasta=${hasta}${pais ? `&pais=${pais}` : ''}${
    zona ? `&zona=${encodeURIComponent(zona)}` : ''
  }${lugarEstado ? `&estado=${lugarEstado}` : ''}`;
  useEffect(() => {
    if (!pref.listo) return;
    let vivo = true;
    pedir<Embudo>('GET', `/datos/admin/embudo?${consulta}`)
      .then((r) => vivo && setRes({ consulta, x: r }))
      .catch(
        (e: unknown) =>
          vivo && setRes({ consulta, error: e instanceof ErrorApi ? e.message : String(e) }),
      );
    return () => {
      vivo = false;
    };
  }, [consulta, pref.listo]);
  const x = res?.x ?? null;
  const error = res?.consulta === consulta ? (res.error ?? '') : '';
  const filas = x?.pasos ?? [];
  const maximo = Math.max(1, ...filas.map((f) => f.personas));
  const peor = dondeSeQuedanMas(filas);
  const paises = [...new Set([...(x?.porPais ?? []).map((p) => p.pais), pais])].filter(Boolean);
  const apps = new Map(Object.entries(t.apps));
  return (
    <section className="super" data-testid="embudo">
      <h1>
        {t.titulo} <AyudaAqui guia="activity-trail" idioma={idioma} />
      </h1>
      <p className="pista">{t.ayuda}</p>
      <div className="flex-inline embudo-filtros">
        <label>
          {t.app}
          <select value={app} onChange={(e) => pref.cambiar('servicio', e.target.value)}>
            {(['repartidor', 'cliente'] as const).map((a) => (
              <option key={a} value={a}>
                {apps.get(a)}
              </option>
            ))}
          </select>
        </label>
        <CampoFecha etiqueta={t.desde} valor={desde} cambiar={setDesde} idioma={idioma} sinFuturo />
        <CampoFecha etiqueta={t.hasta} valor={hasta} cambiar={setHasta} idioma={idioma} sinFuturo />
        <label>
          {t.pais}
          <select value={pais} onChange={(e) => setPais(e.target.value)}>
            <option value="">{t.todos}</option>
            {paises.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.zona}
          <select value={zona} onChange={(e) => pref.cambiar('zona', e.target.value)}>
            <option value="">{t.todas}</option>
            {zonas.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nombre}
              </option>
            ))}
          </select>
        </label>
        {pais === 'VE' || pais === 'US' ? (
          <FiltroEstadoLugar
            pais={pais}
            estado={lugarEstado}
            cambiar={(e) => pref.cambiar('region', e)}
            idioma={idioma}
          />
        ) : null}
      </div>
      {error ? <p role="alert">{error}</p> : null}
      {!x && !error ? <p role="status">…</p> : null}
      {x && filas.every((f) => f.personas === 0) ? <p>{t.vacio}</p> : null}
      {x && filas.some((f) => f.personas > 0) ? (
        <div className="tabla-ancha">
          <table className="embudo-tabla">
            <thead>
              <tr>
                <th scope="col">{t.paso}</th>
                <th scope="col">{t.personas}</th>
                <th scope="col" aria-hidden="true" />
                <th scope="col">{t.seVan}</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={f.paso} data-paso={f.paso}>
                  <td className="embudo-paso">
                    {i + 1}. {nombrePaso(f.paso, idioma)}
                  </td>
                  <td>{f.personas}</td>
                  <td className="embudo-barra-celda" aria-hidden="true">
                    <span
                      className="embudo-barra"
                      style={{ width: `${Math.round((f.personas / maximo) * 100)}%` }}
                    />
                  </td>
                  <td>
                    {pasoQueNoFrena(f.paso) ? (
                      <small data-testid="embudo-no-frena">{t.noFrena}</small>
                    ) : f.seQuedan == null ? (
                      f.personas > 0 ? (
                        <Insignia tono="hecho">{t.completaron}</Insignia>
                      ) : (
                        '—'
                      )
                    ) : (
                      f.seQuedan
                    )}
                    {peor && peor.paso === f.paso ? (
                      <Insignia tono="pendiente" clase="embudo-mayor" testId="embudo-mayor">
                        {t.mayor}
                      </Insignia>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="ficha-nota">{t.anonimos}</p>
      {x && x.porPais.length ? (
        <>
          <h2>{t.porPais}</h2>
          <ul className="super-lista">
            {x.porPais.map((p) => (
              <li key={p.pais || 'sin'}>
                {p.pais || t.sinPais}: <strong>{p.cuentas}</strong> {t.cuentas.toLowerCase()}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {x?.hitos?.length ? (
        <>
          <h2>{t.hitos}</h2>
          <p className="ficha-nota">{t.hitosAyuda}</p>
          <ul className="super-lista" data-testid="embudo-hitos">
            {x.hitos.map((h) => (
              <li key={`${h.hito}:${h.motivo}`}>
                {textoHito(h.hito, h.motivo, idioma)}: <strong>{h.personas}</strong>{' '}
                {t.personas.toLowerCase()}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {x?.porLugar?.length || x?.sinLugar ? (
        <>
          <h2>{t.porLugar}</h2>
          <p className="ficha-nota">{t.porLugarAyuda}</p>
          {x.porLugar?.length ? (
            <div className="tabla-ancha">
              <table className="tabla" data-testid="embudo-por-lugar">
                <thead>
                  <tr>
                    <th scope="col">{t.ciudad}</th>
                    <th scope="col">{t.cuentas}</th>
                    <th scope="col">{t.enEspera}</th>
                  </tr>
                </thead>
                <tbody>
                  {x.porLugar.map((l) => (
                    <tr key={l.lugarId} data-lugar={l.lugarId}>
                      <td>{ciudadEscrita(l)}</td>
                      <td>{l.personas}</td>
                      <td>
                        {l.enEspera > 0 ? <Insignia tono="pendiente">{l.enEspera}</Insignia> : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {x.sinLugar ? <p data-testid="embudo-sin-lugar">{t.sinLugar(x.sinLugar)}</p> : null}
        </>
      ) : null}
      {/* C-INTENTOS-ACCESO: quién intentó crear cuenta o entrar, y dónde se cayó. */}
      <IntentosAcceso idioma={idioma} app={app} desde={desde} hasta={hasta} />
    </section>
  );
}
