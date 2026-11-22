/* eslint-disable security/detect-object-injection -- las claves son pasos, idiomas, canales y zonas de listas propias (PASOS_MENSAJE, es/en, CANALES) o que vienen del servidor validadas con zod */
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { AvisoBorrador } from './AvisoBorrador';
import { AyudaAqui } from './AyudaAqui';
import { Insignia } from './diseno/Insignia';
import { pedir } from './api';
import { usePermisos } from './permisosPanel';
import { fechaCamila } from './SuperCamila';
import {
  PASOS_MENSAJE,
  type PasoMensaje,
  motivoMensaje,
  nombreCanal,
  nombrePasoMensaje,
  palabraEstado,
  tonoMensaje,
} from './rezagadosTextos';
import './rezagados.css';

/**
 * C-REZAGADOS (22 nov 2026) — todos los países, encendido por zona. «Recordatorios de registro»: Camila
 * le escribe sola a quien se quedó a medio registro, con la plantilla de su paso exacto. Aquí el equipo
 * pone cada zona en apagado, vista previa o encendido, ajusta el ritmo y los topes, edita las
 * plantillas en los dos idiomas (generales o de una zona), ve a quiénes les escribiría hoy y los
 * últimos mensajes. Guardar manda el objeto completo; lo escrito no se pierde (borrador).
 */
type Modo = 'apagado' | 'previa' | 'encendido';
type Plantilla = { asunto: string; texto: string; sms: string };
type PorIdioma = { es: Plantilla; en: Plantilla };
type PorPaso = Partial<Record<PasoMensaje, PorIdioma>>;
export type AjustesRezagados = {
  plazosHoras: [number, number, number];
  topePorPaso: number;
  topePorPersona: number;
  topeDiario: number;
  horaDesde: number;
  horaHasta: number;
  ventanaDias: number;
  zonas: Record<string, Modo>;
  plantillas: PorPaso;
  plantillasZona: Record<string, PorPaso>;
};
type FilaLista = {
  id: string;
  rol: string;
  nombre: string;
  zona: string;
  zonaNombre: string;
  modo: Modo;
  creadoEn: string;
  paso: PasoMensaje;
  horasQuieto: number;
  delPaso: number;
  toca: number | null;
  motivo: string | null;
  canales: string[];
};
type Reciente = {
  creado_en: string;
  usuario_id: string;
  nombre: string | null;
  rol: string | null;
  paso: string;
  canal: string;
  origen: string;
  numero: number;
  estado: string;
  detalle: string | null;
};
export type DatosRezagados = {
  ajustes: AjustesRezagados;
  fabrica: { ajustes: AjustesRezagados; plantillas: Record<PasoMensaje, PorIdioma> };
  limites: { topeDiarioMaximo: number; ventanaDiasMaxima: number };
  pasos: PasoMensaje[];
  zonas: { id: string; nombre: string; pais: string }[];
  lista: FilaLista[];
  recientes: Reciente[];
  sms: { venezuela: boolean; general: boolean };
};

const T = {
  es: {
    titulo: 'Recordatorios de registro',
    franja:
      'Camila le escribe sola a quien se quedó a medio registro, con el recordatorio de su paso exacto: primero un correo y un aviso en la app, después un SMS corto y un último correo. Se detiene en cuanto la persona da el paso.',
    smsVe: 'El SMS a Venezuela todavía no está activo: el segundo recordatorio sale por correo.',
    smsGeneral:
      'El SMS fuera de Venezuela todavía no está activo: en esos países el segundo recordatorio sale por correo.',
    cargando: 'Cargando…',
    soloMira:
      'Puedes mirar, pero cambiar esto pide el permiso «Configurar soporte». Pídeselo a quien gestiona el equipo.',
    sinGuardar: 'Tienes cambios sin guardar.',
    guardar: 'Guardar los cambios',
    guardando: 'Guardando…',
    guardado: 'Cambios guardados.',
    zonas: 'Zonas',
    zonasAyuda:
      'Apagado: no hace nada. Vista previa: calcula a quién le escribiría y lo muestra abajo, sin enviar nada. Encendido: Camila escribe de verdad.',
    buscarZona: 'Buscar una zona',
    sinZonas: 'No hay zonas activas.',
    ningunaZona: 'Ninguna zona coincide con esa búsqueda.',
    modo: { apagado: 'Apagado', previa: 'Vista previa', encendido: 'Encendido' } as Record<
      string,
      string
    >,
    aMedio: (n: number) => (n === 1 ? '1 a medio registro' : `${n} a medio registro`),
    encenderTitulo: (zona: string) => `¿Encender los recordatorios en ${zona}?`,
    encenderTexto:
      'Camila empezará a escribirle a personas reales de esta zona, por correo, aviso en la app y SMS. Antes de encender, mira en «Vista previa» a quiénes les escribiría. El cambio se aplica al guardar.',
    siEncender: 'Sí, encender',
    cancelar: 'Cancelar',
    ritmo: 'Ritmo y topes',
    ritmoAyuda:
      'Cuántas horas quieta en un paso tiene que estar la persona antes de cada recordatorio, y cuántos puede recibir. Los topes protegen la reputación del correo.',
    plazo: (n: number) =>
      `Horas quieta antes del ${n === 1 ? '1.er' : n === 2 ? '2.º' : '3.er'} recordatorio`,
    topePorPaso: 'Recordatorios por paso (hasta 3)',
    topePorPersona: 'Recordatorios por persona en total (hasta 12)',
    topeDiario: (m: number) => `Correos y SMS al día, entre todas las zonas (hasta ${m})`,
    horaDesde: 'Desde la hora local',
    horaHasta: 'Hasta la hora local',
    ventana: (m: number) => `Solo cuentas creadas en los últimos días (hasta ${m})`,
    deFabrica: (v: string) => `De fábrica: ${v}`,
    volverFabrica: 'Volver a los de fábrica',
    plantillas: 'Plantillas',
    plantillasAyuda:
      '{nombre} se cambia solo por el primer nombre de la persona y {enlace} por la dirección que la lleva a seguir. El correo y el aviso salen con la firma de Camila.',
    ambito: 'Para',
    general: 'General (todas las zonas)',
    espanol: 'Español',
    ingles: 'Inglés',
    asunto: 'Asunto del correo',
    texto: 'Texto del correo',
    sms: 'SMS',
    caracteres: (n: number) => `${n} de 160 caracteres`,
    deFabricaEstado: 'Es la de fábrica.',
    cambiadaEstado: 'La cambió el equipo.',
    usaGeneral: 'Esta zona usa la general. Si la cambias aquí, la zona tendrá la suya.',
    propiaZona: 'Esta zona tiene la suya: manda sobre la general.',
    restablecer: 'Restablecer la de fábrica',
    quitarZona: 'Quitar la de esta zona (usa la general)',
    lista: 'A quiénes les escribiría hoy',
    listaAyuda:
      'Personas a medio registro en las zonas encendidas o en vista previa, con el paso que les falta y lo que les toca ahora.',
    listaVacia: 'Nadie se quedó a medio registro en las zonas encendidas o en vista previa.',
    col: {
      persona: 'Persona',
      zona: 'Zona',
      modo: 'Modo',
      falta: 'Le falta',
      quieto: 'Quieta hace',
      toca: 'Qué pasa ahora',
      fecha: 'Fecha',
      paso: 'Paso',
      canal: 'Canal',
      quien: 'Quién',
      estado: 'Estado',
    },
    rol: { repartidor: 'Conductor', cliente: 'Cliente' } as Record<string, string>,
    horas: (h: number) => (h < 48 ? `${h} h` : `${Math.floor(h / 24)} días`),
    toca: (n: number, canales: string) =>
      `Le toca el ${n === 1 ? '1.er' : n === 2 ? '2.º' : '3.er'} recordatorio, por ${canales}`,
    soloPrevia: 'vista previa: no se envía',
    y: ' y ',
    motivo: {
      baja: 'No le toca: pidió no recibir más recordatorios.',
      tope_paso: 'No le toca: ya recibió todos los recordatorios de este paso.',
      tope_persona: 'No le toca: ya recibió el máximo de recordatorios.',
      ya_hoy: 'Todavía no: ya recibió uno en las últimas 20 horas.',
      fuera_de_horario: 'Todavía no: es fuera del horario de su zona.',
    } as Record<string, string>,
    aunNo: (h: number) => `Todavía no: le toca cuando lleve ${h} h quieta.`,
    recientes: 'Últimos mensajes enviados',
    recientesVacio: 'Todavía no se envió ningún recordatorio.',
    camila: 'Camila',
    equipo: 'El equipo',
    libre: 'Mensaje libre',
    sinNombre: 'Cuenta sin nombre',
    error: {
      numero: (campo: string) => `Revisa «${campo}»: tiene que ser un número entero válido.`,
      orden: 'Cada recordatorio va después del anterior: revisa las horas.',
      horario: 'La hora de inicio va antes que la de fin.',
      plantilla: (paso: string, idioma: string, campo: string, min: number, max: number) =>
        `La plantilla «${paso}» en ${idioma}: «${campo}» tiene que tener entre ${min} y ${max} caracteres.`,
    },
  },
  en: {
    titulo: 'Sign-up reminders',
    franja:
      'Camila writes on her own to people who stopped halfway through sign-up, with a reminder for their exact step: first an email and an app notification, then a short SMS and one last email. She stops as soon as the person takes the step.',
    smsVe: 'SMS to Venezuela is not active yet: the second reminder goes out by email.',
    smsGeneral:
      'SMS outside Venezuela is not active yet: in those countries the second reminder goes out by email.',
    cargando: 'Loading…',
    soloMira:
      'You can look, but changing this needs the “Configure support” permission. Ask whoever manages the team.',
    sinGuardar: 'You have unsaved changes.',
    guardar: 'Save changes',
    guardando: 'Saving…',
    guardado: 'Changes saved.',
    zonas: 'Zones',
    zonasAyuda:
      'Off: does nothing. Preview: works out who she would write to and shows it below, without sending anything. On: Camila really writes.',
    buscarZona: 'Search for a zone',
    sinZonas: 'There are no active zones.',
    ningunaZona: 'No zone matches that search.',
    modo: { apagado: 'Off', previa: 'Preview', encendido: 'On' } as Record<string, string>,
    aMedio: (n: number) => (n === 1 ? '1 halfway through' : `${n} halfway through`),
    encenderTitulo: (zona: string) => `Turn on reminders in ${zona}?`,
    encenderTexto:
      'Camila will start writing to real people in this zone, by email, app notification and SMS. Before turning it on, check in “Preview” who she would write to. The change applies when you save.',
    siEncender: 'Yes, turn on',
    cancelar: 'Cancel',
    ritmo: 'Pace and limits',
    ritmoAyuda:
      'How many hours a person has to be stuck on a step before each reminder, and how many they can get. The limits protect the email reputation.',
    plazo: (n: number) =>
      `Hours stuck before the ${n === 1 ? '1st' : n === 2 ? '2nd' : '3rd'} reminder`,
    topePorPaso: 'Reminders per step (up to 3)',
    topePorPersona: 'Reminders per person in total (up to 12)',
    topeDiario: (m: number) => `Emails and SMS per day, across all zones (up to ${m})`,
    horaDesde: 'From local hour',
    horaHasta: 'Until local hour',
    ventana: (m: number) => `Only accounts created in the last days (up to ${m})`,
    deFabrica: (v: string) => `Default: ${v}`,
    volverFabrica: 'Back to defaults',
    plantillas: 'Templates',
    plantillasAyuda:
      '{nombre} is replaced by the person’s first name and {enlace} by the link that takes them to continue. The email and the notification go out signed by Camila.',
    ambito: 'For',
    general: 'General (all zones)',
    espanol: 'Spanish',
    ingles: 'English',
    asunto: 'Email subject',
    texto: 'Email text',
    sms: 'SMS',
    caracteres: (n: number) => `${n} of 160 characters`,
    deFabricaEstado: 'This is the default.',
    cambiadaEstado: 'Changed by the team.',
    usaGeneral: 'This zone uses the general one. If you change it here, the zone gets its own.',
    propiaZona: 'This zone has its own: it overrides the general one.',
    restablecer: 'Reset to default',
    quitarZona: 'Remove this zone’s own (use the general one)',
    lista: 'Who she would write to today',
    listaAyuda:
      'People halfway through sign-up in zones that are on or in preview, with the step they are missing and what is due for them now.',
    listaVacia: 'Nobody stopped halfway through sign-up in zones that are on or in preview.',
    col: {
      persona: 'Person',
      zona: 'Zone',
      modo: 'Mode',
      falta: 'Missing',
      quieto: 'Stuck for',
      toca: 'What happens now',
      fecha: 'Date',
      paso: 'Step',
      canal: 'Channel',
      quien: 'Who',
      estado: 'Status',
    },
    rol: { repartidor: 'Driver', cliente: 'Customer' } as Record<string, string>,
    horas: (h: number) => (h < 48 ? `${h} h` : `${Math.floor(h / 24)} days`),
    toca: (n: number, canales: string) =>
      `${n === 1 ? '1st' : n === 2 ? '2nd' : '3rd'} reminder is due, by ${canales}`,
    soloPrevia: 'preview: not sent',
    y: ' and ',
    motivo: {
      baja: 'Not due: they asked for no more reminders.',
      tope_paso: 'Not due: they already got every reminder for this step.',
      tope_persona: 'Not due: they already got the maximum number of reminders.',
      ya_hoy: 'Not yet: they got one in the last 20 hours.',
      fuera_de_horario: 'Not yet: it is outside their zone’s hours.',
    } as Record<string, string>,
    aunNo: (h: number) => `Not yet: due once they have been stuck for ${h} h.`,
    recientes: 'Latest messages sent',
    recientesVacio: 'No reminder has been sent yet.',
    camila: 'Camila',
    equipo: 'The team',
    libre: 'Free message',
    sinNombre: 'Unnamed account',
    error: {
      numero: (campo: string) => `Check “${campo}”: it has to be a valid whole number.`,
      orden: 'Each reminder comes after the previous one: check the hours.',
      horario: 'The start hour goes before the end hour.',
      plantilla: (paso: string, idioma: string, campo: string, min: number, max: number) =>
        `The “${paso}” template in ${idioma}: “${campo}” must be between ${min} and ${max} characters.`,
    },
  },
};
type Textos = (typeof T)['es'];

/** Lo que se escribe en el formulario. Las partes anidadas van como JSON para comparar con el guardado. */
type Valores = {
  plazo1: string;
  plazo2: string;
  plazo3: string;
  topePorPaso: string;
  topePorPersona: string;
  topeDiario: string;
  horaDesde: string;
  horaHasta: string;
  ventanaDias: string;
  zonas: string;
  plantillas: string;
  plantillasZona: string;
};

export function valoresDe(a: AjustesRezagados): Valores {
  return {
    plazo1: String(a.plazosHoras[0]),
    plazo2: String(a.plazosHoras[1]),
    plazo3: String(a.plazosHoras[2]),
    topePorPaso: String(a.topePorPaso),
    topePorPersona: String(a.topePorPersona),
    topeDiario: String(a.topeDiario),
    horaDesde: String(a.horaDesde),
    horaHasta: String(a.horaHasta),
    ventanaDias: String(a.ventanaDias),
    zonas: JSON.stringify(a.zonas ?? {}),
    plantillas: JSON.stringify(a.plantillas ?? {}),
    plantillasZona: JSON.stringify(a.plantillasZona ?? {}),
  };
}

function leerJson<X>(s: string, defecto: X): X {
  try {
    return JSON.parse(s) as X;
  } catch {
    return defecto;
  }
}

const igual = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);
const LIMITES_PLANTILLA = { asunto: [3, 120], texto: [20, 1500], sms: [10, 160] } as const;

/** Los ajustes completos que se mandan al servidor, o el error en palabras. */
export function ajustesDe(
  v: Valores,
  fabrica: Record<PasoMensaje, PorIdioma>,
  limites: DatosRezagados['limites'],
  t: Textos,
): { ajustes: AjustesRezagados } | { error: string } {
  const entero = (s: string, min: number, max: number, campo: string) => {
    const n = Number(String(s).trim());
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(t.error.numero(campo));
    return n;
  };
  try {
    const plazosHoras: [number, number, number] = [
      entero(v.plazo1, 1, 72, t.plazo(1)),
      entero(v.plazo2, 2, 240, t.plazo(2)),
      entero(v.plazo3, 3, 720, t.plazo(3)),
    ];
    if (!(plazosHoras[0] < plazosHoras[1] && plazosHoras[1] < plazosHoras[2]))
      return { error: t.error.orden };
    const horaDesde = entero(v.horaDesde, 0, 23, t.horaDesde);
    const horaHasta = entero(v.horaHasta, 1, 24, t.horaHasta);
    if (horaDesde >= horaHasta) return { error: t.error.horario };
    const plantillas = leerJson<PorPaso>(v.plantillas, {});
    const plantillasZona = leerJson<Record<string, PorPaso>>(v.plantillasZona, {});
    // Lo que quedó igual a lo que heredaría no se guarda como cambio.
    const limpias: PorPaso = {};
    for (const paso of PASOS_MENSAJE) {
      const p = plantillas[paso];
      if (p && !igual(p, fabrica[paso])) limpias[paso] = p;
    }
    const limpiasZona: Record<string, PorPaso> = {};
    for (const [zona, porPaso] of Object.entries(plantillasZona)) {
      const suyas: PorPaso = {};
      for (const paso of PASOS_MENSAJE) {
        const p = porPaso[paso];
        if (p && !igual(p, limpias[paso] ?? fabrica[paso])) suyas[paso] = p;
      }
      if (Object.keys(suyas).length) limpiasZona[zona] = suyas;
    }
    const revisar = (porPaso: PorPaso) => {
      for (const paso of PASOS_MENSAJE)
        for (const idioma of ['es', 'en'] as const) {
          const p = porPaso[paso]?.[idioma];
          if (!p) continue;
          for (const campo of ['asunto', 'texto', 'sms'] as const) {
            const [min, max] = LIMITES_PLANTILLA[campo];
            const largo = p[campo].trim().length;
            if (largo < min || largo > max)
              throw new Error(
                t.error.plantilla(
                  nombrePasoMensaje(paso, t === T.en ? 'en' : 'es'),
                  idioma === 'es' ? t.espanol : t.ingles,
                  campo === 'asunto' ? t.asunto : campo === 'texto' ? t.texto : t.sms,
                  min,
                  max,
                ),
              );
          }
        }
    };
    revisar(limpias);
    for (const porPaso of Object.values(limpiasZona)) revisar(porPaso);
    return {
      ajustes: {
        plazosHoras,
        topePorPaso: entero(v.topePorPaso, 1, 3, t.topePorPaso),
        topePorPersona: entero(v.topePorPersona, 1, 12, t.topePorPersona),
        topeDiario: entero(
          v.topeDiario,
          0,
          limites.topeDiarioMaximo,
          t.topeDiario(limites.topeDiarioMaximo),
        ),
        horaDesde,
        horaHasta,
        ventanaDias: entero(
          v.ventanaDias,
          1,
          limites.ventanaDiasMaxima,
          t.ventana(limites.ventanaDiasMaxima),
        ),
        zonas: leerJson<Record<string, Modo>>(v.zonas, {}),
        plantillas: limpias,
        plantillasZona: limpiasZona,
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

const mensajeDe = (x: unknown) => (x instanceof ErrorApi ? x.message : String(x));

export function SuperRezagados({ base, idioma }: { base: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [datos, setDatos] = useState<DatosRezagados | null>(null);
  const [error, setError] = useState('');
  const cargar = useCallback(
    () =>
      pedir<DatosRezagados>('GET', '/datos/admin/camila/recordatorios')
        .then((d) => {
          setDatos(d);
          setError('');
        })
        .catch((x: unknown) => setError(mensajeDe(x))),
    [],
  );
  useEffect(() => {
    void cargar();
  }, [cargar]);
  return (
    <div className="super rezagados" data-testid="super-rezagados">
      <h2>
        {t.titulo}
        <AyudaAqui guia="signup-reminders" idioma={idioma} />
      </h2>
      {datos ? (
        <FormRezagados
          t={t}
          idioma={idioma}
          base={base}
          datos={datos}
          recargar={() => void cargar()}
        />
      ) : error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : (
        <p className="pista">{t.cargando}</p>
      )}
    </div>
  );
}

function FormRezagados({
  t,
  idioma,
  base,
  datos,
  recargar,
}: {
  t: Textos;
  idioma: Idioma;
  base: string;
  datos: DatosRezagados;
  recargar: () => void;
}) {
  const { puedeVer } = usePermisos();
  const puedeGuardar = puedeVer('tickets.configurar');
  const guardados = useMemo(() => valoresDe(datos.ajustes), [datos.ajustes]);
  const [guardadoBase, setGuardadoBase] = useState(guardados);
  const b = useBorrador<Valores>({
    formulario: 'rezagados-ajustes',
    cuenta: 'superadmin',
    inicial: guardados,
    almacen: almacenNavegador,
  });
  const v = b.valores;
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [enviando, setEnviando] = useState(false);
  // Los mensajes salen junto a la barra que se tocó (hay una arriba y otra abajo).
  const [donde, setDonde] = useState<'arriba' | 'abajo'>('arriba');
  const cambiado = !igual(v, guardadoBase);

  async function guardar(lugar: 'arriba' | 'abajo') {
    setDonde(lugar);
    setError('');
    setOk('');
    const r = ajustesDe(v, datos.fabrica.plantillas, datos.limites, t);
    if ('error' in r) return setError(r.error);
    setEnviando(true);
    try {
      const res = await pedir<{ ajustes: AjustesRezagados }>(
        'PUT',
        '/datos/admin/camila/recordatorios',
        r.ajustes,
      );
      const nuevos = valoresDe(res?.ajustes ?? r.ajustes);
      b.cargar(nuevos);
      setGuardadoBase(nuevos);
      setOk(t.guardado);
      recargar();
    } catch (x) {
      setError(mensajeDe(x));
    } finally {
      setEnviando(false);
    }
  }

  const barra = (lugar: 'arriba' | 'abajo') => (
    <div className="rez-guardar">
      {cambiado ? <span className="pista">{t.sinGuardar}</span> : null}
      <button
        type="button"
        className="boton"
        disabled={enviando || !cambiado}
        onClick={() => void guardar(lugar)}
      >
        {enviando ? t.guardando : t.guardar}
      </button>
    </div>
  );
  const mensajes = (lugar: 'arriba' | 'abajo') =>
    lugar !== donde ? null : (
      <>
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
      </>
    );

  return (
    <>
      <div className="rez-franja" role="note" data-testid="rez-franja">
        <p>{t.franja}</p>
        {!datos.sms.venezuela ? <p data-testid="rez-sms-ve">{t.smsVe}</p> : null}
        {!datos.sms.general ? <p>{t.smsGeneral}</p> : null}
      </div>
      {!puedeGuardar ? <p className="pista">{t.soloMira}</p> : null}
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <fieldset className="rez-sin-marco" disabled={!puedeGuardar}>
        <Zonas t={t} datos={datos} valores={v} cambiar={b.cambiar} />
        {puedeGuardar ? (
          <>
            {mensajes('arriba')}
            {barra('arriba')}
          </>
        ) : null}
        <Ritmo t={t} datos={datos} valores={v} setValores={b.setValores} />
        <Plantillas t={t} idioma={idioma} datos={datos} valores={v} cambiar={b.cambiar} />
        {puedeGuardar ? (
          <>
            {mensajes('abajo')}
            {barra('abajo')}
          </>
        ) : null}
      </fieldset>
      <Lista t={t} idioma={idioma} base={base} datos={datos} />
      <Recientes t={t} idioma={idioma} base={base} datos={datos} />
    </>
  );
}

type Cambiar = <K extends keyof Valores>(campo: K, valor: Valores[K]) => void;

function Zonas({
  t,
  datos,
  valores,
  cambiar,
}: {
  t: Textos;
  datos: DatosRezagados;
  valores: Valores;
  cambiar: Cambiar;
}) {
  const [busca, setBusca] = useState('');
  const [porEncender, setPorEncender] = useState<{ id: string; nombre: string } | null>(null);
  const zonas = leerJson<Record<string, Modo>>(valores.zonas, {});
  const modoDe = (id: string): Modo => new Map(Object.entries(zonas)).get(id) ?? 'apagado';
  const poner = (id: string, m: Modo) => cambiar('zonas', JSON.stringify({ ...zonas, [id]: m }));
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const visibles = datos.zonas.filter(
    (z) => !busca.trim() || norm(`${z.nombre} ${z.pais} ${z.id}`).includes(norm(busca.trim())),
  );
  const cuantos = (id: string) => datos.lista.filter((p) => p.zona === id).length;
  return (
    <section className="flex-tarjeta rez-tarjeta" data-testid="rez-zonas">
      <h3>{t.zonas}</h3>
      <p className="pista">{t.zonasAyuda}</p>
      {datos.zonas.length > 8 ? (
        <input
          type="search"
          className="rez-buscar"
          placeholder={t.buscarZona}
          aria-label={t.buscarZona}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      ) : null}
      {datos.zonas.length === 0 ? <p className="pista">{t.sinZonas}</p> : null}
      {datos.zonas.length > 0 && visibles.length === 0 ? (
        <p className="pista">{t.ningunaZona}</p>
      ) : null}
      <ul className="rez-zonas">
        {visibles.map((z) => {
          const m = modoDe(z.id);
          const n = cuantos(z.id);
          return (
            <li key={z.id} data-testid={`rez-zona-${z.id}`}>
              <span className="rez-zona-nombre">
                <strong>{z.nombre}</strong> <small className="pista">{z.pais}</small>
                {m !== 'apagado' && n > 0 ? (
                  <small className="pista"> · {t.aMedio(n)}</small>
                ) : null}
              </span>
              <span className="rez-modos" role="radiogroup" aria-label={z.nombre}>
                {(['apagado', 'previa', 'encendido'] as const).map((op) => (
                  <button
                    key={op}
                    type="button"
                    role="radio"
                    aria-checked={m === op}
                    className={m === op ? `rez-modo activo rez-modo-${op}` : 'rez-modo'}
                    onClick={() => {
                      if (op === m) return;
                      if (op === 'encendido') setPorEncender({ id: z.id, nombre: z.nombre });
                      else poner(z.id, op);
                    }}
                  >
                    {new Map(Object.entries(t.modo)).get(op)}
                  </button>
                ))}
              </span>
            </li>
          );
        })}
      </ul>
      {porEncender ? (
        <Dialogo
          titulo={t.encenderTitulo(porEncender.nombre)}
          alCerrar={() => setPorEncender(null)}
          testId="rez-confirmar-encender"
        >
          <p>{t.encenderTexto}</p>
          <div className="rez-dialogo-botones">
            <button type="button" className="boton secundario" onClick={() => setPorEncender(null)}>
              {t.cancelar}
            </button>
            <button
              type="button"
              className="boton"
              onClick={() => {
                poner(porEncender.id, 'encendido');
                setPorEncender(null);
              }}
            >
              {t.siEncender}
            </button>
          </div>
        </Dialogo>
      ) : null}
    </section>
  );
}

/** Ventana encima de la pantalla; se cierra con Escape o tocando fuera. */
export function Dialogo({
  titulo,
  alCerrar,
  children,
  testId,
  ancho,
}: {
  titulo: string;
  alCerrar: () => void;
  children: React.ReactNode;
  testId?: string;
  ancho?: boolean;
}) {
  const id = useId();
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar();
    };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [alCerrar]);
  return (
    <div className="rez-velo" role="presentation" onMouseDown={alCerrar}>
      <div
        className={ancho ? 'rez-dialogo ancho' : 'rez-dialogo'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        data-testid={testId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={`${id}-t`}>{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

function Ritmo({
  t,
  datos,
  valores,
  setValores,
}: {
  t: Textos;
  datos: DatosRezagados;
  valores: Valores;
  setValores: (f: (v: Valores) => Valores) => void;
}) {
  const f = valoresDe(datos.fabrica.ajustes);
  const campos: [keyof Valores, string, number, number, string][] = [
    ['plazo1', t.plazo(1), 1, 72, `${f.plazo1} h`],
    ['plazo2', t.plazo(2), 2, 240, `${f.plazo2} h`],
    ['plazo3', t.plazo(3), 3, 720, `${f.plazo3} h`],
    ['topePorPaso', t.topePorPaso, 1, 3, f.topePorPaso],
    ['topePorPersona', t.topePorPersona, 1, 12, f.topePorPersona],
    [
      'topeDiario',
      t.topeDiario(datos.limites.topeDiarioMaximo),
      0,
      datos.limites.topeDiarioMaximo,
      f.topeDiario,
    ],
    ['horaDesde', t.horaDesde, 0, 23, `${f.horaDesde}:00`],
    ['horaHasta', t.horaHasta, 1, 24, `${f.horaHasta}:00`],
    [
      'ventanaDias',
      t.ventana(datos.limites.ventanaDiasMaxima),
      1,
      datos.limites.ventanaDiasMaxima,
      f.ventanaDias,
    ],
  ];
  return (
    <section className="flex-tarjeta rez-tarjeta" data-testid="rez-ritmo">
      <h3>{t.ritmo}</h3>
      <p className="pista">{t.ritmoAyuda}</p>
      <div className="rez-rejilla">
        {campos.map(([clave, etiqueta, min, max, fabrica]) => (
          <label key={clave} className="campo">
            {etiqueta}
            <input
              type="number"
              inputMode="numeric"
              min={min}
              max={max}
              step={1}
              value={String(new Map(Object.entries(valores)).get(clave) ?? '')}
              onChange={(e) => {
                const valor = e.target.value;
                setValores((x) => ({ ...x, [clave]: valor }));
              }}
            />
            <small>{t.deFabrica(fabrica)}</small>
          </label>
        ))}
      </div>
      <button
        type="button"
        className="boton secundario"
        onClick={() =>
          setValores((x) => ({
            ...x,
            plazo1: f.plazo1,
            plazo2: f.plazo2,
            plazo3: f.plazo3,
            topePorPaso: f.topePorPaso,
            topePorPersona: f.topePorPersona,
            topeDiario: f.topeDiario,
            horaDesde: f.horaDesde,
            horaHasta: f.horaHasta,
            ventanaDias: f.ventanaDias,
          }))
        }
      >
        {t.volverFabrica}
      </button>
    </section>
  );
}

function Plantillas({
  t,
  idioma,
  datos,
  valores,
  cambiar,
}: {
  t: Textos;
  idioma: Idioma;
  datos: DatosRezagados;
  valores: Valores;
  cambiar: Cambiar;
}) {
  const [paso, setPaso] = useState<PasoMensaje>('fotos');
  const [ambito, setAmbito] = useState('');
  const generales = leerJson<PorPaso>(valores.plantillas, {});
  const deZona = leerJson<Record<string, PorPaso>>(valores.plantillasZona, {});
  const fabrica = datos.fabrica.plantillas[paso];
  const general = generales[paso] ?? fabrica;
  const propiaZona = ambito ? deZona[ambito]?.[paso] : undefined;
  const actual = ambito ? (propiaZona ?? general) : general;
  const cambiada = ambito ? Boolean(propiaZona) : Boolean(generales[paso]);

  function poner(lengua: 'es' | 'en', campo: keyof Plantilla, valor: string) {
    const nueva: PorIdioma = { ...actual, [lengua]: { ...actual[lengua], [campo]: valor } };
    if (ambito)
      cambiar(
        'plantillasZona',
        JSON.stringify({ ...deZona, [ambito]: { ...(deZona[ambito] ?? {}), [paso]: nueva } }),
      );
    else cambiar('plantillas', JSON.stringify({ ...generales, [paso]: nueva }));
  }
  function restablecer() {
    if (ambito) {
      const suyas = { ...(deZona[ambito] ?? {}) };
      delete suyas[paso];
      cambiar('plantillasZona', JSON.stringify({ ...deZona, [ambito]: suyas }));
    } else {
      const sin = { ...generales };
      delete sin[paso];
      cambiar('plantillas', JSON.stringify(sin));
    }
  }
  const estado = ambito
    ? propiaZona
      ? t.propiaZona
      : t.usaGeneral
    : generales[paso]
      ? t.cambiadaEstado
      : t.deFabricaEstado;
  return (
    <section className="flex-tarjeta rez-tarjeta" data-testid="rez-plantillas">
      <h3>{t.plantillas}</h3>
      <p className="pista">{t.plantillasAyuda}</p>
      <div className="fila-botones" role="tablist" aria-label={t.plantillas}>
        {PASOS_MENSAJE.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={paso === p}
            className={paso === p ? 'boton' : 'boton secundario'}
            onClick={() => setPaso(p)}
          >
            {nombrePasoMensaje(p, idioma)}
          </button>
        ))}
      </div>
      <label className="campo rez-ambito">
        {t.ambito}
        <select value={ambito} onChange={(e) => setAmbito(e.target.value)}>
          <option value="">{t.general}</option>
          {datos.zonas.map((z) => (
            <option key={z.id} value={z.id}>
              {z.nombre} ({z.pais})
            </option>
          ))}
        </select>
      </label>
      <p className="pista" data-testid="rez-plantilla-estado">
        {estado}
      </p>
      <div className="rez-idiomas">
        {(['es', 'en'] as const).map((lengua) => (
          <div key={lengua} className="rez-idioma" data-testid={`rez-plantilla-${lengua}`}>
            <h4>{lengua === 'es' ? t.espanol : t.ingles}</h4>
            <label className="campo">
              {t.asunto}
              <input
                value={actual[lengua].asunto}
                maxLength={120}
                onChange={(e) => poner(lengua, 'asunto', e.target.value)}
              />
            </label>
            <label className="campo">
              {t.texto}
              <textarea
                rows={10}
                value={actual[lengua].texto}
                maxLength={1500}
                onChange={(e) => poner(lengua, 'texto', e.target.value)}
              />
            </label>
            <label className="campo">
              {t.sms}
              <textarea
                rows={3}
                value={actual[lengua].sms}
                maxLength={160}
                onChange={(e) => poner(lengua, 'sms', e.target.value)}
              />
              <small className={actual[lengua].sms.length > 150 ? 'rez-casi' : undefined}>
                {t.caracteres(actual[lengua].sms.length)}
              </small>
            </label>
          </div>
        ))}
      </div>
      {cambiada ? (
        <button type="button" className="boton secundario" onClick={restablecer}>
          {ambito ? t.quitarZona : t.restablecer}
        </button>
      ) : null}
    </section>
  );
}

function enlaceFicha(base: string, id: string, rol: string | null) {
  return `${base}/${rol === 'repartidor' ? 'drivers' : 'customers'}/${id}`;
}

function Lista({
  t,
  idioma,
  base,
  datos,
}: {
  t: Textos;
  idioma: Idioma;
  base: string;
  datos: DatosRezagados;
}) {
  const plazos = datos.ajustes.plazosHoras;
  const queHay = (p: FilaLista) => {
    if (p.toca) {
      const canales = p.canales.map((c) => nombreCanal(c, idioma).toLowerCase()).join(t.y);
      const texto = t.toca(p.toca, canales);
      return p.modo === 'previa' ? `${texto} (${t.soloPrevia})` : texto;
    }
    if (p.motivo === 'aun_no') return t.aunNo(plazos[p.delPaso] ?? plazos[2]);
    return new Map(Object.entries(t.motivo)).get(p.motivo ?? '') ?? p.motivo ?? '';
  };
  return (
    <section className="flex-tarjeta rez-tarjeta" data-testid="rez-lista">
      <h3>
        {t.lista} ({datos.lista.length})
      </h3>
      <p className="pista">{t.listaAyuda}</p>
      {datos.lista.length === 0 ? (
        <p className="pista">{t.listaVacia}</p>
      ) : (
        <div className="tabla-ancha">
          <table className="tabla rez-tabla">
            <thead>
              <tr>
                <th scope="col">{t.col.persona}</th>
                <th scope="col">{t.col.zona}</th>
                <th scope="col">{t.col.modo}</th>
                <th scope="col">{t.col.falta}</th>
                <th scope="col">{t.col.quieto}</th>
                <th scope="col">{t.col.toca}</th>
              </tr>
            </thead>
            <tbody>
              {datos.lista.map((p) => (
                <tr key={p.id} data-testid="rez-fila">
                  <td>
                    <Enlace a={enlaceFicha(base, p.id, p.rol)} className="enlace">
                      {p.nombre || t.sinNombre}
                    </Enlace>
                    <small className="pista rez-rol">
                      {new Map(Object.entries(t.rol)).get(p.rol) ?? p.rol}
                    </small>
                  </td>
                  <td>{p.zonaNombre}</td>
                  <td>
                    <Insignia tono={p.modo === 'encendido' ? 'hecho' : 'pendiente'}>
                      {new Map(Object.entries(t.modo)).get(p.modo) ?? p.modo}
                    </Insignia>
                  </td>
                  <td>{nombrePasoMensaje(p.paso, idioma)}</td>
                  <td>{t.horas(p.horasQuieto)}</td>
                  <td className="rez-celda-texto" data-testid="rez-que-pasa">
                    {queHay(p)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Recientes({
  t,
  idioma,
  base,
  datos,
}: {
  t: Textos;
  idioma: Idioma;
  base: string;
  datos: DatosRezagados;
}) {
  return (
    <section className="flex-tarjeta rez-tarjeta" data-testid="rez-recientes">
      <h3>{t.recientes}</h3>
      {datos.recientes.length === 0 ? (
        <p className="pista">{t.recientesVacio}</p>
      ) : (
        <div className="tabla-ancha">
          <table className="tabla rez-tabla">
            <thead>
              <tr>
                <th scope="col">{t.col.fecha}</th>
                <th scope="col">{t.col.persona}</th>
                <th scope="col">{t.col.paso}</th>
                <th scope="col">{t.col.canal}</th>
                <th scope="col">{t.col.quien}</th>
                <th scope="col">{t.col.estado}</th>
              </tr>
            </thead>
            <tbody>
              {datos.recientes.map((m, i) => {
                const motivo = motivoMensaje(m.estado, m.detalle ?? '', idioma);
                return (
                  <tr key={`${m.creado_en}-${m.usuario_id}-${m.canal}-${i}`}>
                    <td>{fechaCamila(m.creado_en, idioma)}</td>
                    <td>
                      <Enlace a={enlaceFicha(base, m.usuario_id, m.rol)} className="enlace">
                        {m.nombre || t.sinNombre}
                      </Enlace>
                    </td>
                    <td>{m.paso === 'libre' ? t.libre : nombrePasoMensaje(m.paso, idioma)}</td>
                    <td>{nombreCanal(m.canal, idioma)}</td>
                    <td>{m.origen === 'manual' ? t.equipo : t.camila}</td>
                    <td className="rez-celda-texto">
                      <Insignia tono={tonoMensaje(m.estado)} testId="rez-estado">
                        {palabraEstado(m.estado, idioma)}
                      </Insignia>
                      {motivo ? <small className="pista"> {motivo}</small> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
