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
import { nombreEstado } from './BuscadorSuper';
import { Insignia } from './diseno/Insignia';
import { textoHito } from './SuperEmbudo';
import { useHora } from './horario';
import { mensajeDeLinea, palabraEstado, tonoMensaje } from './rezagadosTextos';

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
    /** C-RASTRO-FUENTES: cada paso en el orden en que lo hace la persona, leído de todas sus fuentes. */
    pasos?: PasoCuenta[];
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

export type PasoCuenta = {
  paso: PasoRegistro;
  estado: 'hecho' | 'pendiente' | 'no_aplica';
  fecha: string | null;
  fuente: string | null;
  comprobacion: string | null;
  nota: string | null;
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
    noAplica: 'No le toca',
    notas: {
      verificacion_anterior: 'entró por la verificación anterior',
      aprobado_equipo: 'lo aprobó el equipo',
      solo_al_volver: 'solo se pide al volver tras muchos días sin conectarse',
      correo_frenado: 'el correo rebotó y está frenado',
    },
    notaAviso: 'pasó por la verificación anterior, que no llevaba este aviso',
    linea: 'Línea de tiempo',
    vacia: 'Todavía no hay actividad.',
    verMas: 'Ver todo',
    verMenos: 'Ver menos',
    por: 'por',
    abrir: 'Abrir',
    mensajes: (n: number) => (n === 1 ? '1 mensaje' : `${n} mensajes`),
    otros: {
      aprobado: 'aprobado',
      pendiente: 'pendiente',
      rechazado: 'rechazado',
      suspendido: 'suspendido',
      moto: 'moto',
      carro: 'carro',
      comida: 'comida',
      envios: 'envíos',
    },
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
      foto: 'Foto subida:',
      foto_aprobada: 'Foto aprobada:',
      foto_rechazada: 'Foto rechazada:',
      verificacion_aprobado: 'Verificación aprobada',
      verificacion_rechazado: 'Verificación rechazada',
      verificacion_pendiente: 'Verificación devuelta a revisión',
      vehiculo: 'Vehículo registrado:',
      vehiculo_aprobado: 'Vehículo aprobado:',
      habilitacion: 'Habilitación:',
      viaje_conductor: 'Viaje como conductor',
      viaje_pasajero: 'Viaje como pasajero',
      pedido_repartidor: 'Pedido como repartidor',
      pedido_cliente: 'Pedido como cliente',
      chat: 'Habló con soporte',
      equipo: 'Cambio del equipo',
      mensaje: 'Mensaje de registro',
    },
    fotos: {
      cara: 'cara',
      doc_frente: 'documento (frente)',
      doc_reverso: 'documento (reverso)',
      licencia_frente: 'licencia (frente)',
      licencia_reverso: 'licencia (reverso)',
      seguro: 'seguro',
    },
    comprobacion: {
      verde: 'la comprobación automática no vio problemas',
      amarillo: 'la comprobación automática tiene dudas',
      rojo: 'la comprobación automática vio un problema',
      sin_ia: 'sin comprobación automática',
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
    noAplica: 'Not required',
    notas: {
      verificacion_anterior: 'came in through the previous verification',
      aprobado_equipo: 'approved by the team',
      solo_al_volver: 'only asked when coming back after many days offline',
      correo_frenado: 'the email bounced and is on hold',
    },
    notaAviso: 'went through the previous verification, which had no such notice',
    linea: 'Timeline',
    vacia: 'No activity yet.',
    verMas: 'Show all',
    verMenos: 'Show less',
    por: 'by',
    abrir: 'Open',
    mensajes: (n: number) => (n === 1 ? '1 message' : `${n} messages`),
    otros: {
      aprobado: 'approved',
      pendiente: 'pending',
      rechazado: 'rejected',
      suspendido: 'suspended',
      moto: 'moto',
      carro: 'car',
      comida: 'food',
      envios: 'deliveries',
    },
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
      foto: 'Photo uploaded:',
      foto_aprobada: 'Photo approved:',
      foto_rechazada: 'Photo rejected:',
      verificacion_aprobado: 'Verification approved',
      verificacion_rechazado: 'Verification rejected',
      verificacion_pendiente: 'Verification sent back to review',
      vehiculo: 'Vehicle added:',
      vehiculo_aprobado: 'Vehicle approved:',
      habilitacion: 'Service access:',
      viaje_conductor: 'Ride as driver',
      viaje_pasajero: 'Ride as rider',
      pedido_repartidor: 'Order as courier',
      pedido_cliente: 'Order as customer',
      chat: 'Talked to support',
      equipo: 'Team change',
      mensaje: 'Sign-up message',
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
      amarillo: 'automatic check has doubts',
      rojo: 'automatic check found an issue',
      sin_ia: 'no automatic check',
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

export function textoEvento(
  evento: string,
  tipo: string,
  idioma: Idioma,
  detalle: string | null = null,
): string {
  const t = enIdioma(T, idioma);
  if (tipo === 'paso' && NOMBRES.has(evento)) return nombrePaso(evento, idioma);
  // C-FOTO-CARA-A-LA-VISTA: «No lo dejamos conectarse · falta la foto de la cara».
  if (tipo === 'hito') return textoHito(evento.replace(/^hito:/, ''), detalle ?? '', idioma);
  // C-REZAGADOS: «Camila le envió un correo: recordatorio de sus fotos».
  if (tipo === 'mensaje') return mensajeDeLinea(evento, detalle, idioma).texto;
  const [clave, resto] = evento.split(':') as [string, string | undefined];
  const eventos = new Map(Object.entries(t.eventos));
  const base = eventos.get(clave) ?? clave;
  if (!resto) return base;
  const fotos = new Map(Object.entries(t.fotos));
  const otros = new Map(Object.entries(t.otros));
  return `${base} ${fotos.get(resto) ?? otros.get(resto) ?? resto}`;
}

export function ActividadCuenta({
  ruta,
  idioma,
  recarga = 0,
}: {
  ruta: string;
  idioma: Idioma;
  /** Sube cuando la ficha cambió algo que sale en la actividad (C-REZAGADOS: un mensaje enviado). */
  recarga?: number;
}) {
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
  }, [ruta, recarga]);
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
  const otros = new Map(Object.entries(t.otros));
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
  // Un servidor de antes no manda `pasos`: se arman con lo que sí manda.
  const pasos: PasoCuenta[] =
    a.dondeQuedo.pasos ??
    [...a.dondeQuedo.hechos, ...a.dondeQuedo.falta].map((paso) => ({
      paso,
      estado: a.dondeQuedo.hechos.includes(paso) ? 'hecho' : 'pendiente',
      fecha: null,
      fuente: null,
      comprobacion: null,
      nota: null,
    }));
  const notas = new Map(Object.entries(t.notas));
  /** Lo que se dice debajo de cada paso: cuándo, cómo se sabe y qué vio la comprobación automática. */
  const explicacion = (p: PasoCuenta) =>
    [
      p.fecha ? h.fecha(p.fecha, null, 'hora') : null,
      p.nota
        ? p.paso === 'aviso_ia' && p.nota === 'verificacion_anterior'
          ? t.notaAviso
          : (notas.get(p.nota) ?? null)
        : null,
      p.comprobacion ? (comprobacion.get(p.comprobacion) ?? null) : null,
    ]
      .filter(Boolean)
      .join(' · ');
  const linea = todo ? a.linea : a.linea.slice(0, VISIBLES);
  /** El origen de un alta o una entrada («app|versión|plataforma|lugar|red»), en palabras. */
  const origen = (d: string) => {
    const [app = '', version = '', plataforma = '', lugar = '', operadora = ''] = d.split('|');
    return [
      app ? [apps.get(app) ?? app, version].filter(Boolean).join(' ') : '',
      plataforma ? (plataformas.get(plataforma) ?? plataforma) : '',
      lugar,
      operadora,
    ]
      .filter(Boolean)
      .join(' · ');
  };
  // Cada detalle se dice en palabras: el origen, los mensajes del chat y el color de la comprobación.
  const detalle = (d: string | null, tipo: string) => {
    if (!d) return null;
    if (tipo === 'alta' || tipo === 'entrada') return origen(d) || null;
    if (tipo === 'chat') {
      const [n = '0', canal = ''] = d.split('|');
      return [t.mensajes(Number(n)), canal].filter(Boolean).join(' · ');
    }
    // El estado del mensaje va en su insignia; aquí solo el motivo si no salió.
    if (tipo === 'mensaje') return mensajeDeLinea('', d, idioma).motivo || null;
    // El motivo del hito ya va en su texto («No lo dejamos conectarse · falta la foto de la cara»).
    if (tipo === 'hito') return null;
    return d
      .split(' · ')
      .map((x) => comprobacion.get(x) ?? otros.get(x) ?? nombreEstado(x, idioma))
      .join(' · ');
  };
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
          <li key={p.paso} data-estado={p.estado} data-testid={`paso-${p.paso}`}>
            <Insignia tono={p.estado === 'hecho' ? 'hecho' : 'apagado'}>
              {p.estado === 'hecho' ? t.hecho : p.estado === 'pendiente' ? t.pendiente : t.noAplica}
            </Insignia>
            <span className="actividad-paso-texto">
              <strong>{nombrePaso(p.paso, idioma)}</strong>
              {explicacion(p) ? <small>{explicacion(p)}</small> : null}
            </span>
          </li>
        ))}
      </ol>
      <h3>{t.linea}</h3>
      {a.linea.length ? (
        <ol className="super-bitacora ficha-linea">
          {linea.map((p, i) => (
            <li key={`${p.evento}-${p.fecha}-${i}`} className={`ficha-paso-${p.tipo}`}>
              <time dateTime={p.fecha}>{h.fecha(p.fecha, null, 'hora')}</time>
              <strong>{textoEvento(p.evento, p.tipo, idioma, p.detalle)}</strong>
              {p.tipo === 'mensaje' ? (
                <EstadoMensajeLinea detalle={p.detalle} idioma={idioma} />
              ) : null}
              {detalle(p.detalle, p.tipo) || p.quien ? (
                <span>
                  {[detalle(p.detalle, p.tipo), p.quien ? `${t.por} ${p.quien}` : null]
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

/** El estado de un mensaje de registro en la línea de tiempo, con su color (verde salió, rojo falló). */
function EstadoMensajeLinea({ detalle, idioma }: { detalle: string | null; idioma: Idioma }) {
  const estado = (detalle ?? '').split('|')[2] ?? '';
  if (!estado) return null;
  return (
    <Insignia tono={tonoMensaje(estado)} testId="mensaje-estado">
      {palabraEstado(estado, idioma)}
    </Insignia>
  );
}
