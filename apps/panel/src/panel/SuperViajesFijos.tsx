import { useEffect, useState } from 'react';
import { ErrorApi, type Idioma, enIdioma } from '@tumbite/compartido';
import { pedir } from './api';
import { usePreferencias } from './usePreferencias';
import { AvisoFiltrosGuardados } from './AvisoFiltrosGuardados';
import { SelectorCiudad } from './SuperFichas';
import { Enlace } from '../Enlace';
import { Hora } from './horario';

/**
 * C-VIAJES-FIJOS y C-CONDUCTOR-CONFIANZA (16 nov 2026) — todos los países. La pestaña «Viajes fijos»
 * del monitoreo de viajes: el resumen arriba (parejas de confianza y salidas de los últimos 7 días)
 * y la tabla (cliente, ciudad, servicio, días y horas, conductor, menor, estado y últimas salidas).
 * Los filtros (ciudad, estado y solo menores) se guardan por empleado (C-FILTROS-GUARDADOS). El PIN
 * del menor nunca llega aquí: el servidor no lo manda al equipo.
 */
const T = {
  es: {
    titulo: 'Viajes · Viajes fijos',
    pestanaViajes: 'Emergencias y tarifas',
    pestanaFijos: 'Viajes fijos',
    intro:
      'Los viajes de siempre de los clientes (la escuela, el trabajo, el envío de cada semana) y sus conductores de confianza. Cada salida nace como un viaje programado 24 horas antes.',
    resumen: 'Resumen de viajes fijos',
    parejas: 'Clientes con conductor de confianza',
    conductores: 'Conductores de confianza',
    creadas: 'Salidas pedidas (7 días)',
    saltadas: 'Saltadas por el cliente (7 días)',
    fallidas: 'No se pudieron pedir (7 días)',
    noPuede: '«No puedo» del conductor (7 días)',
    ciudad: 'Ciudad',
    estados: {
      vigentes: 'Vigentes',
      activa: 'Activos',
      pausada: 'En pausa',
      borrada: 'Borrados',
    } as Record<string, string>,
    soloMenores: 'Solo con menores',
    cliente: 'Cliente',
    servicio: 'Servicio',
    diasHoras: 'Días y horas',
    conductor: 'Conductor',
    menor: 'Menor',
    estado: 'Estado',
    ultimas: 'Últimas salidas',
    si: 'Sí',
    no: 'No',
    cualquiera: 'Cualquiera',
    servicios: { moto: 'Moto', carro: 'Carro', envios: 'Envíos' } as Record<string, string>,
    estadosFila: {
      activa: 'Activo',
      pausada: 'En pausa',
      borrada: 'Borrado',
    } as Record<string, string>,
    hasta: 'hasta',
    salidas: {
      creada: 'Pedida',
      saltada: 'Saltada',
      fallida: 'No se pudo pedir',
    } as Record<string, string>,
    noPuedeCorto: 'conductor no puede',
    ida: 'ida',
    vuelta: 'vuelta',
    sinSalidas: 'Sin salidas todavía',
    vacio: 'No hay viajes fijos con estos filtros.',
    cargando: 'Cargando…',
    dias: {
      semana: 'De lunes a viernes',
      todos: 'Todos los días',
      finde: 'Fines de semana',
      cortos: ['Lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'],
    },
  },
  en: {
    titulo: 'Rides · Regular rides',
    pestanaViajes: 'Emergencies and fares',
    pestanaFijos: 'Regular rides',
    intro:
      'Customers’ usual rides (school, work, the weekly delivery) and their trusted drivers. Each trip is created as a scheduled ride 24 hours ahead.',
    resumen: 'Regular rides summary',
    parejas: 'Customers with a trusted driver',
    conductores: 'Trusted drivers',
    creadas: 'Trips requested (7 days)',
    saltadas: 'Skipped by the customer (7 days)',
    fallidas: 'Couldn’t be requested (7 days)',
    noPuede: 'Driver “Can’t make it” (7 days)',
    ciudad: 'City',
    estados: {
      vigentes: 'Current',
      activa: 'Active',
      pausada: 'Paused',
      borrada: 'Deleted',
    } as Record<string, string>,
    soloMenores: 'Only with minors',
    cliente: 'Customer',
    servicio: 'Service',
    diasHoras: 'Days and times',
    conductor: 'Driver',
    menor: 'Minor',
    estado: 'Status',
    ultimas: 'Latest trips',
    si: 'Yes',
    no: 'No',
    cualquiera: 'Any',
    servicios: { moto: 'Moto', carro: 'Car', envios: 'Delivery' } as Record<string, string>,
    estadosFila: {
      activa: 'Active',
      pausada: 'Paused',
      borrada: 'Deleted',
    } as Record<string, string>,
    hasta: 'until',
    salidas: {
      creada: 'Requested',
      saltada: 'Skipped',
      fallida: 'Couldn’t request',
    } as Record<string, string>,
    noPuedeCorto: 'driver can’t make it',
    ida: 'there',
    vuelta: 'back',
    sinSalidas: 'No trips yet',
    vacio: 'No regular rides match these filters.',
    cargando: 'Loading…',
    dias: {
      semana: 'Weekdays',
      todos: 'Every day',
      finde: 'Weekends',
      cortos: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    },
  },
};

type Salida = {
  fecha: string;
  sentido: string;
  hora: string;
  estado: string;
  conductorNoPuede: boolean;
};
type FilaFijo = {
  id: string;
  nombre: string;
  servicio: string;
  dias: number[];
  horaIda: string;
  horaVuelta: string | null;
  zonaHoraria: string;
  estado: string;
  pausadaHasta: string | null;
  conductor: { id: string; nombre: string } | null;
  menor: { nombre: string } | null;
  salidas: Salida[];
  cliente: string;
  clienteId: string;
  ciudad: string;
};
type Datos = {
  resumen: {
    parejasConfianza: number;
    conductoresConfianza: number;
    salidas7d: Record<string, number>;
    noPuede7d: number;
  };
  rutinas: FilaFijo[];
};

const ESTADOS = ['vigentes', 'activa', 'pausada', 'borrada'] as const;
const de = (m: Record<string, string>, k: string) => new Map(Object.entries(m)).get(k) ?? k;

/** Las pestañas del monitoreo de viajes (las dos pantallas las llevan iguales). */
export function PestanasViajes({
  base,
  idioma,
  activa,
}: {
  base: string;
  idioma: Idioma;
  activa: 'viajes' | 'fijos';
}) {
  const t = enIdioma(T, idioma);
  return (
    <nav className="super-filtros viajes-pestanas" aria-label={t.titulo}>
      <Enlace
        a={`${base}/rides`}
        className={`boton secundario${activa === 'viajes' ? ' activa' : ''}`}
        actual={activa === 'viajes'}
      >
        {t.pestanaViajes}
      </Enlace>
      <Enlace
        a={`${base}/rides/fixed`}
        className={`boton secundario${activa === 'fijos' ? ' activa' : ''}`}
        actual={activa === 'fijos'}
      >
        {t.pestanaFijos}
      </Enlace>
    </nav>
  );
}

function textoDias(dias: number[], idioma: Idioma): string {
  const t = enIdioma(T, idioma).dias;
  const d = [...dias].sort((a, b) => a - b).join(',');
  if (d === '1,2,3,4,5') return t.semana;
  if (d === '1,2,3,4,5,6,7') return t.todos;
  if (d === '6,7') return t.finde;
  return dias.map((n) => t.cortos.at(n - 1) ?? '').join(', ');
}

export function SuperViajesFijos({ base, idioma }: { base: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const pref = usePreferencias('viajes-fijos', { zona: '', estado: 'vigentes', menores: '' });
  const { zona = '', estado = 'vigentes', menores = '' } = pref.valores;
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    const p = new URLSearchParams();
    if (zona) p.set('zona', zona);
    p.set('estado', ESTADOS.some((e) => e === estado) ? estado : 'vigentes');
    if (menores === '1') p.set('menores', '1');
    pedir<Datos>('GET', `/datos/admin/viajes-fijos?${p.toString()}`)
      .then((r) => {
        if (!vivo) return;
        setDatos(r);
        setError('');
      })
      .catch((x: unknown) => vivo && setError(x instanceof ErrorApi ? x.message : String(x)));
    return () => {
      vivo = false;
    };
  }, [zona, estado, menores]);

  const r = datos?.resumen;
  const cifras: [string, number][] = r
    ? [
        [t.parejas, r.parejasConfianza],
        [t.conductores, r.conductoresConfianza],
        [t.creadas, r.salidas7d.creada ?? 0],
        [t.saltadas, r.salidas7d.saltada ?? 0],
        [t.fallidas, r.salidas7d.fallida ?? 0],
        [t.noPuede, r.noPuede7d],
      ]
    : [];

  return (
    <section className="super">
      <h1>{t.titulo}</h1>
      <PestanasViajes base={base} idioma={idioma} activa="fijos" />
      <p>{t.intro}</p>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="super-tarjetas" aria-label={t.resumen}>
        {cifras.map(([nombre, n]) => (
          <li key={nombre} className="super-tarjeta">
            <span>{nombre}</span>
            <strong>{n}</strong>
          </li>
        ))}
      </ul>

      <div className="super-busqueda" role="search">
        <SelectorCiudad zona={zona} cambiar={(z) => pref.cambiar('zona', z)} idioma={idioma} />
        <label className="fijo-casilla">
          <input
            type="checkbox"
            checked={menores === '1'}
            onChange={(e) => pref.cambiar('menores', e.target.checked ? '1' : '')}
          />{' '}
          {t.soloMenores}
        </label>
      </div>
      <div className="super-filtros" role="tablist" aria-label={t.estado}>
        {ESTADOS.map((e) => (
          <button
            key={e}
            type="button"
            role="tab"
            aria-selected={estado === e}
            className={estado === e ? 'activa' : undefined}
            onClick={() => pref.cambiar('estado', e)}
          >
            {de(t.estados, e)}
          </button>
        ))}
      </div>
      <AvisoFiltrosGuardados
        visible={pref.guardados}
        idioma={idioma}
        restablecer={pref.restablecer}
      />

      {!datos && !error ? <p>{t.cargando}</p> : null}
      {datos && datos.rutinas.length === 0 ? <p>{t.vacio}</p> : null}
      {datos && datos.rutinas.length > 0 ? (
        <div className="tabla-ancha">
          <table className="tabla">
            <thead>
              <tr>
                <th>{t.cliente}</th>
                <th>{t.ciudad}</th>
                <th>{t.servicio}</th>
                <th>{t.diasHoras}</th>
                <th>{t.conductor}</th>
                <th>{t.menor}</th>
                <th>{t.estado}</th>
                <th>{t.ultimas}</th>
              </tr>
            </thead>
            <tbody>
              {datos.rutinas.map((f) => (
                <tr key={f.id}>
                  <td>
                    <Enlace a={`${base}/customers/${f.clienteId}`}>{f.cliente}</Enlace>
                    <br />
                    <small>{f.nombre}</small>
                  </td>
                  <td>{f.ciudad}</td>
                  <td>{de(t.servicios, f.servicio)}</td>
                  <td>
                    {textoDias(f.dias, idioma)}
                    <br />
                    <small>
                      {f.horaIda}
                      {f.horaVuelta ? ` · ${f.horaVuelta}` : ''}
                    </small>
                  </td>
                  <td>{f.conductor?.nombre ?? t.cualquiera}</td>
                  <td>{f.menor ? t.si : t.no}</td>
                  <td>
                    <span className={`fijo-estado fijo-${f.estado}`}>
                      {de(t.estadosFila, f.estado)}
                    </span>
                    {f.estado === 'pausada' && f.pausadaHasta ? (
                      <small>
                        {' '}
                        {t.hasta} {f.pausadaHasta}
                      </small>
                    ) : null}
                  </td>
                  <td>
                    {f.salidas.length === 0 ? (
                      <small>{t.sinSalidas}</small>
                    ) : (
                      f.salidas.slice(-3).map((s) => (
                        <div key={`${s.fecha}-${s.sentido}`}>
                          <small>
                            <Hora fecha={s.hora} zona={f.zonaHoraria} idioma={idioma} /> ·{' '}
                            {s.sentido === 'vuelta' ? t.vuelta : t.ida} · {de(t.salidas, s.estado)}
                            {s.conductorNoPuede ? ` · ${t.noPuedeCorto}` : ''}
                          </small>
                        </div>
                      ))
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
