import { useEffect, useState } from 'react';
import {
  type Idioma,
  type PasoRegistro,
  ErrorApi,
  NOMBRE_PASO,
  enIdioma,
} from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { pedir } from './api';
import { Insignia } from './diseno/Insignia';
import { useHora } from './horario';

/**
 * C-RASTRO (22 nov 2026, Richard): la actividad de una cuenta en su ficha del superadmin. De dónde
 * vino el alta, qué pasos del registro dio y cuál le falta, y la línea de tiempo de todo lo demás
 * (verificaciones, vehículos, viajes, pedidos, chat y cambios hechos por el equipo). Solo lee.
 */
export type Actividad = {
  alta: {
    fecha: string;
    app: string | null;
    version: string | null;
    plataforma: string | null;
    pais: string | null;
    region: string | null;
    ciudad: string | null;
    red: string | null;
    conOrigen: boolean;
  };
  esPrueba: boolean;
  dondeQuedo: {
    ultimo: PasoRegistro;
    sigue: PasoRegistro | null;
    hechos: PasoRegistro[];
    falta: PasoRegistro[];
  };
  linea: {
    fecha: string;
    tipo: string;
    evento: string;
    detalle: string | null;
    quien: string | null;
    enlace: string | null;
  }[];
};

const T = {
  es: {
    titulo: 'Actividad',
    alta: 'Alta de la cuenta',
    desde: 'Desde',
    red: 'Red aproximada',
    sinOrigen:
      'Esta cuenta se creó antes de que se guardara desde qué app y qué red se hizo el alta.',
    registro: 'Registro',
    completo: 'Registro completo',
    sigue: 'Le falta',
    hecho: 'Hecho',
    pendiente: 'Pendiente',
    linea: 'Línea de tiempo',
    vacia: 'Todavía no hay actividad.',
    verMas: 'Ver todo',
    verMenos: 'Ver menos',
    por: 'por',
    abrir: 'Abrir',
    apps: {
      cliente: 'App de clientes',
      repartidor: 'Divoox Driver',
      restaurante: 'App de restaurantes',
    },
    plataformas: {
      android: 'Android',
      ios: 'iPhone',
      web: 'Navegador',
      'web (android)': 'Navegador en Android',
      'web (iphone)': 'Navegador en iPhone',
    },
    eventos: {
      alta: 'Creó la cuenta',
      entrada: 'Entró a la cuenta',
      acepto_sms: 'Aceptó recibir SMS',
      foto: 'Subió la foto de',
      foto_aprobada: 'Se aprobó la foto de',
      foto_rechazada: 'Se rechazó la foto de',
      verificacion_aprobado: 'Verificación aprobada',
      verificacion_rechazado: 'Verificación rechazada',
      verificacion_pendiente: 'Verificación devuelta a revisión',
      vehiculo: 'Registró un vehículo',
      vehiculo_aprobado: 'Se aprobó el vehículo',
      habilitacion: 'Habilitación de',
      viaje_conductor: 'Viaje como conductor',
      viaje_pasajero: 'Viaje como pasajero',
      pedido_repartidor: 'Pedido como repartidor',
      pedido_cliente: 'Pedido como cliente',
      chat: 'Habló con soporte (mensajes · canal)',
      equipo: 'Cambio del equipo',
    },
    fotos: {
      cara: 'la cara',
      doc_frente: 'el documento (frente)',
      doc_reverso: 'el documento (reverso)',
      licencia_frente: 'la licencia (frente)',
      licencia_reverso: 'la licencia (reverso)',
      seguro: 'el seguro',
    },
    comprobacion: {
      verde: 'la comprobación automática no vio problemas',
      ambar: 'la comprobación automática tiene dudas',
      rojo: 'la comprobación automática vio un problema',
    },
  },
  en: {
    titulo: 'Activity',
    alta: 'Account sign-up',
    desde: 'From',
    red: 'Approximate network',
    sinOrigen: 'This account was created before sign-up app and network were recorded.',
    registro: 'Sign-up',
    completo: 'Sign-up complete',
    sigue: 'Still missing',
    hecho: 'Done',
    pendiente: 'Pending',
    linea: 'Timeline',
    vacia: 'No activity yet.',
    verMas: 'Show all',
    verMenos: 'Show less',
    por: 'by',
    abrir: 'Open',
    apps: { cliente: 'Customer app', repartidor: 'Divoox Driver', restaurante: 'Restaurant app' },
    plataformas: {
      android: 'Android',
      ios: 'iPhone',
      web: 'Browser',
      'web (android)': 'Browser on Android',
      'web (iphone)': 'Browser on iPhone',
    },
    eventos: {
      alta: 'Created the account',
      entrada: 'Signed in',
      acepto_sms: 'Agreed to receive SMS',
      foto: 'Uploaded photo of',
      foto_aprobada: 'Photo approved:',
      foto_rechazada: 'Photo rejected:',
      verificacion_aprobado: 'Verification approved',
      verificacion_rechazado: 'Verification rejected',
      verificacion_pendiente: 'Verification sent back to review',
      vehiculo: 'Added a vehicle',
      vehiculo_aprobado: 'Vehicle approved',
      habilitacion: 'Service access:',
      viaje_conductor: 'Ride as driver',
      viaje_pasajero: 'Ride as rider',
      pedido_repartidor: 'Order as courier',
      pedido_cliente: 'Order as customer',
      chat: 'Talked to support (messages · channel)',
      equipo: 'Team change',
    },
    fotos: {
      cara: 'face',
      doc_frente: 'ID (front)',
      doc_reverso: 'ID (back)',
      licencia_frente: 'license (front)',
      licencia_reverso: 'license (back)',
      seguro: 'insurance',
    },
    comprobacion: {
      verde: 'automatic check found no issues',
      ambar: 'automatic check has doubts',
      rojo: 'automatic check found an issue',
    },
  },
};

const VISIBLES = 12;

/** «foto:cara» → «Subió la foto de la cara»; un paso del registro → su nombre; lo demás, su texto. */
const NOMBRES = new Map(Object.entries(NOMBRE_PASO));
const nombrePaso = (p: string, idioma: Idioma) => {
  const n = NOMBRES.get(p);
  return n ? enIdioma(n, idioma) : p;
};

export function textoEvento(evento: string, tipo: string, idioma: Idioma): string {
  const t = enIdioma(T, idioma);
  if (tipo === 'paso' && NOMBRES.has(evento)) return nombrePaso(evento, idioma);
  const [clave, resto] = evento.split(':') as [string, string | undefined];
  const eventos = new Map(Object.entries(t.eventos));
  const base = eventos.get(clave) ?? clave;
  if (!resto) return base;
  const fotos = new Map(Object.entries(t.fotos));
  return `${base} ${fotos.get(resto) ?? resto}`;
}

export function ActividadCuenta({ ruta, idioma }: { ruta: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const h = useHora(idioma);
  // La respuesta se guarda con la ruta que la pidió: al cambiar de cuenta no se muestra la anterior.
  const [res, setRes] = useState<{ ruta: string; actividad?: Actividad; error?: string } | null>(
    null,
  );
  const [todo, setTodo] = useState(false);
  useEffect(() => {
    let vivo = true;
    pedir<{ actividad: Actividad }>('GET', ruta)
      .then((r) => vivo && setRes({ ruta, actividad: r.actividad }))
      .catch(
        (e: unknown) =>
          vivo && setRes({ ruta, error: e instanceof ErrorApi ? e.message : String(e) }),
      );
    return () => {
      vivo = false;
    };
  }, [ruta]);
  const actual = res?.ruta === ruta ? res : null;
  const a = actual?.actividad ?? null;
  const error = actual?.error ?? '';
  if (error)
    return (
      <section className="tarjeta-form" aria-labelledby="actividad-titulo">
        <h2 id="actividad-titulo">{t.titulo}</h2>
        <p role="alert">{error}</p>
      </section>
    );
  if (!a)
    return (
      <section className="tarjeta-form" aria-labelledby="actividad-titulo" aria-busy="true">
        <h2 id="actividad-titulo">{t.titulo}</h2>
        <p role="status">…</p>
      </section>
    );
  const apps = new Map(Object.entries(t.apps));
  const plataformas = new Map(Object.entries(t.plataformas));
  const comprobacion = new Map(Object.entries(t.comprobacion));
  const desde = [
    a.alta.app
      ? [apps.get(a.alta.app) ?? a.alta.app, a.alta.version].filter(Boolean).join(' ')
      : null,
    a.alta.plataforma ? (plataformas.get(a.alta.plataforma) ?? a.alta.plataforma) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const red = [[a.alta.ciudad, a.alta.region, a.alta.pais].filter(Boolean).join(', '), a.alta.red]
    .filter(Boolean)
    .join(' · ');
  const pasos = [...a.dondeQuedo.hechos, ...a.dondeQuedo.falta];
  const hechos = new Set<string>(a.dondeQuedo.hechos);
  const linea = todo ? a.linea : a.linea.slice(0, VISIBLES);
  // El detalle de una foto trae el color de la comprobación automática: se dice en palabras.
  const detalle = (d: string | null) =>
    d
      ? d
          .split(' · ')
          .map((x) => comprobacion.get(x) ?? x)
          .join(' · ')
      : null;
  return (
    <section
      className="tarjeta-form actividad"
      aria-labelledby="actividad-titulo"
      data-testid="actividad"
    >
      <h2 id="actividad-titulo">{t.titulo}</h2>
      <dl className="super-dl">
        <dt>{t.alta}</dt>
        <dd>{h.fecha(a.alta.fecha, null, 'hora')}</dd>
        {a.alta.conOrigen ? (
          <>
            <dt>{t.desde}</dt>
            <dd data-testid="actividad-desde">{desde || '—'}</dd>
            <dt>{t.red}</dt>
            <dd data-testid="actividad-red">{red || '—'}</dd>
          </>
        ) : null}
      </dl>
      {a.alta.conOrigen ? null : <p className="ficha-nota">{t.sinOrigen}</p>}
      <h3>{t.registro}</h3>
      <p data-testid="actividad-sigue">
        {a.dondeQuedo.sigue ? (
          <Insignia tono="pendiente">
            {t.sigue}: {nombrePaso(a.dondeQuedo.sigue, idioma)}
          </Insignia>
        ) : (
          <Insignia tono="hecho">{t.completo}</Insignia>
        )}
      </p>
      <ol className="actividad-pasos">
        {pasos.map((p) => (
          <li key={p}>
            <Insignia tono={hechos.has(p) ? 'hecho' : 'apagado'}>
              {hechos.has(p) ? t.hecho : t.pendiente}
            </Insignia>
            <span>{nombrePaso(p, idioma)}</span>
          </li>
        ))}
      </ol>
      <h3>{t.linea}</h3>
      {a.linea.length ? (
        <ol className="super-bitacora ficha-linea">
          {linea.map((p, i) => (
            <li key={`${p.evento}-${p.fecha}-${i}`} className={`ficha-paso-${p.tipo}`}>
              <time dateTime={p.fecha}>{h.fecha(p.fecha, null, 'hora')}</time>
              <strong>{textoEvento(p.evento, p.tipo, idioma)}</strong>
              {detalle(p.detalle) || p.quien ? (
                <span>
                  {[detalle(p.detalle), p.quien ? `${t.por} ${p.quien}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              ) : null}
              {p.enlace ? (
                <Enlace a={p.enlace} className="enlace">
                  {t.abrir}
                </Enlace>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p>{t.vacia}</p>
      )}
      {a.linea.length > VISIBLES ? (
        <button type="button" className="boton terciario" onClick={() => setTodo((v) => !v)}>
          {todo ? t.verMenos : `${t.verMas} (${a.linea.length})`}
        </button>
      ) : null}
    </section>
  );
}
