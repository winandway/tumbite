/* eslint-disable security/detect-object-injection -- las claves son motivos, estados y países de listas propias o del servidor (validadas con zod) */
import { useCallback, useEffect, useId, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { Insignia } from './diseno/Insignia';
import { pedir } from './api';
import { usePermisos } from './permisosPanel';
import './rezagados.css';

/**
 * C-WHATSAPP-FALTA (25 nov 2026, encargo urgente de Richard) — todos los países, con interruptor por
 * país. Dos piezas:
 * - `MandarWhatsappFalta`: «Mandarle por WhatsApp lo que le falta», en la ficha del conductor y en
 *   Verificaciones (las dos usan RevisionConductor). Primero la vista previa con el texto exacto; para
 *   enviar hay que confirmar. Si ya se le mandó uno hace menos de 24 horas, se puede mandar igual
 *   confirmando otra vez; el consentimiento y el tope de tres por paso no se saltan nunca.
 * - `WhatsappFaltaAjustes`: en «Recordatorios de registro»: el estado del canal y de la plantilla, los
 *   países, el presupuesto, y «a todos los trabados de esta zona» con vista previa y confirmación.
 */

type Falta = { clave: string; texto: string } | null;
type Vista = {
  id: string;
  nombre: string;
  falta: Falta;
  texto: string | null;
  puede: boolean;
  motivo: string | null;
  esperaSaltable: boolean;
  delPaso: number;
  ultimoEn: string | null;
};

const T = {
  es: {
    boton: 'Mandarle por WhatsApp lo que le falta',
    titulo: 'WhatsApp: lo que le falta',
    armando: 'Armando el mensaje…',
    asi: 'Así le llega por WhatsApp',
    sinTexto: 'No hay nada que le toque a él ahora: no se le manda nada.',
    enviar: 'Mandar por WhatsApp',
    enviarIgual: 'Mandarlo igual',
    enviando: 'Mandando…',
    cancelar: 'Cancelar',
    cerrar: 'Cerrar',
    confirmar: '¿Le mandamos este WhatsApp ahora?',
    confirmarEspera:
      'Ya le mandamos un WhatsApp hace menos de 24 horas. ¿Se lo mandamos igual? Queda en la auditoría con tu nombre.',
    enviado: 'Listo: le mandamos el WhatsApp. Queda en su línea de tiempo.',
    fallido: 'Meta no aceptó el mensaje. Queda anotado en su línea de tiempo.',
    yaVan: (n: number) =>
      n === 1
        ? 'Ya le salió 1 por este paso (máximo 3).'
        : `Ya le salieron ${n} por este paso (máximo 3).`,
    error: 'No se pudo armar el mensaje.',
    reintentar: 'Reintentar',
    motivo: {
      sin_credenciales:
        'WhatsApp todavía no está conectado en este sitio (faltan las llaves de Meta).',
      proveedor_sin_plantilla: 'El proveedor de WhatsApp de este sitio no tiene esta plantilla.',
      plantilla_no_aprobada:
        'La plantilla todavía no está aprobada por Meta: no sale ningún mensaje.',
      plantilla_no_es_utilidad:
        'Meta pasó la plantilla a otra categoría (no utilidad): no se usa hasta revisarla.',
      sin_celular: 'No tiene un celular válido en su cuenta.',
      no_confirmo_por_whatsapp:
        'No confirmó su celular con el código por WhatsApp: no tenemos su permiso para este canal.',
      celular_cambio:
        'Cambió su celular después de confirmarlo por WhatsApp: hay que confirmar el nuevo.',
      whatsapp_fallo: 'El código por WhatsApp no le llegó: este canal no le sirve.',
      baja: 'Pidió no recibir más recordatorios.',
      pais_apagado: 'WhatsApp está apagado para el país de su ciudad.',
      idioma_sin_plantilla: 'Su cuenta está en inglés y todavía no hay plantilla en inglés.',
      nada_que_le_toque: 'Lo que falta le toca al equipo (o ya recibe carreras): no se le manda.',
      tope_paso: 'Ya le salieron los 3 mensajes de este paso: no se le mandan más.',
      ya_hoy: 'Ya le mandamos uno hace menos de 24 horas.',
      tope_diario: 'Se llegó al tope de mensajes o de dinero de hoy.',
      no_es_conductor: 'Esta cuenta no es de conductor.',
    } as Record<string, string>,
    // Ajustes
    ajustesTitulo: 'WhatsApp «te falta» (conductores)',
    ajustesAyuda:
      'Camila le manda al conductor trabado, solo por WhatsApp, lo que le falta según su barra de activación: uno cada 24 horas como mucho y tres por paso. Solo a quien confirmó su celular con el código por WhatsApp.',
    listo: 'Listo para salir',
    noListo: 'No sale ningún mensaje',
    plantilla: 'Plantilla en Meta',
    estadoPlantilla: {
      sin_crear: 'Sin crear',
      PENDING: 'En revisión',
      APPROVED: 'Aprobada',
      REJECTED: 'Rechazada',
      PAUSED: 'Pausada',
      DISABLED: 'Desactivada',
      IN_APPEAL: 'En apelación',
    } as Record<string, string>,
    marcarPlantilla: 'Marcar el estado a mano (lo que dice el administrador de WhatsApp de Meta)',
    paises: 'Países encendidos',
    tope: 'Mensajes al día',
    presupuesto: 'Dólares al día',
    costo: 'Costo estimado por mensaje (USD)',
    hoy: (n: number, usd: number) => `Hoy: ${n} mensajes, unos ${usd.toFixed(2)} USD.`,
    guardar: 'Guardar',
    guardando: 'Guardando…',
    guardado: 'Guardado.',
    zonaTitulo: 'A todos los trabados de una zona',
    zona: 'Zona',
    elegir: 'Elige una zona',
    verQuienes: 'Ver a quién se le manda',
    mirando: 'Mirando la barra de cada conductor…',
    col: { persona: 'Conductor', falta: 'Lo que le falta', sale: '¿Sale?' },
    si: 'Sí',
    no: 'No',
    mandarA: (n: number) => `Mandar a ${n} por WhatsApp`,
    confirmarZona: (n: number, zona: string) =>
      `¿Le mandamos el WhatsApp a ${n} conductores de ${zona}? Cada envío queda en la auditoría con tu nombre.`,
    resultadoZona: (e: number, f: number) =>
      `Salieron ${e}.${f ? ` ${f} no los aceptó Meta.` : ''} Vuelve a mirar la zona para los siguientes.`,
    hayMas: 'Hay más conductores en esta zona: después de mandar, mira la página siguiente.',
    siguiente: 'Página siguiente',
    nadieZona: 'En esta zona no hay conductores trabados en un paso suyo.',
  },
  en: {
    boton: 'Send them what is missing on WhatsApp',
    titulo: 'WhatsApp: what is missing',
    armando: 'Building the message…',
    asi: 'This is what they get on WhatsApp',
    sinTexto: 'Nothing depends on them right now: nothing is sent.',
    enviar: 'Send on WhatsApp',
    enviarIgual: 'Send it anyway',
    enviando: 'Sending…',
    cancelar: 'Cancel',
    cerrar: 'Close',
    confirmar: 'Send this WhatsApp message now?',
    confirmarEspera:
      'We already sent them a WhatsApp message less than 24 hours ago. Send it anyway? It is logged in the audit trail with your name.',
    enviado: 'Done: the WhatsApp message was sent. It shows on their timeline.',
    fallido: 'Meta did not accept the message. It is logged on their timeline.',
    yaVan: (n: number) => `${n} already sent for this step (3 at most).`,
    error: 'Could not build the message.',
    reintentar: 'Try again',
    motivo: {
      sin_credenciales: 'WhatsApp is not connected on this site yet (the Meta keys are missing).',
      proveedor_sin_plantilla: 'This site’s WhatsApp provider does not have this template.',
      plantilla_no_aprobada: 'Meta has not approved the template yet: no message goes out.',
      plantilla_no_es_utilidad:
        'Meta moved the template to another category (not utility): it is not used until reviewed.',
      sin_celular: 'Their account has no valid phone number.',
      no_confirmo_por_whatsapp:
        'They did not confirm their phone with the WhatsApp code: we do not have their permission for this channel.',
      celular_cambio:
        'They changed their phone after confirming it on WhatsApp: the new one must be confirmed.',
      whatsapp_fallo: 'Their WhatsApp code was not delivered: this channel does not work for them.',
      baja: 'They asked to stop reminders.',
      pais_apagado: 'WhatsApp is off for their city’s country.',
      idioma_sin_plantilla: 'Their account is in English and there is no English template yet.',
      nada_que_le_toque:
        'What is missing is up to the team (or they already get trips): nothing is sent.',
      tope_paso: 'All 3 messages for this step were already sent: no more go out.',
      ya_hoy: 'We already sent one less than 24 hours ago.',
      tope_diario: 'Today’s message or money cap was reached.',
      no_es_conductor: 'This is not a driver account.',
    } as Record<string, string>,
    ajustesTitulo: 'WhatsApp “what is missing” (drivers)',
    ajustesAyuda:
      'Camila sends a stuck driver, only on WhatsApp, what is missing according to their activation bar: at most one every 24 hours and three per step. Only to people who confirmed their phone with the WhatsApp code.',
    listo: 'Ready to send',
    noListo: 'No message goes out',
    plantilla: 'Template on Meta',
    estadoPlantilla: {
      sin_crear: 'Not created',
      PENDING: 'In review',
      APPROVED: 'Approved',
      REJECTED: 'Rejected',
      PAUSED: 'Paused',
      DISABLED: 'Disabled',
      IN_APPEAL: 'In appeal',
    } as Record<string, string>,
    marcarPlantilla: 'Set the status by hand (what Meta’s WhatsApp Manager shows)',
    paises: 'Countries turned on',
    tope: 'Messages per day',
    presupuesto: 'Dollars per day',
    costo: 'Estimated cost per message (USD)',
    hoy: (n: number, usd: number) => `Today: ${n} messages, about ${usd.toFixed(2)} USD.`,
    guardar: 'Save',
    guardando: 'Saving…',
    guardado: 'Saved.',
    zonaTitulo: 'Everyone stuck in a zone',
    zona: 'Zone',
    elegir: 'Pick a zone',
    verQuienes: 'See who gets it',
    mirando: 'Checking each driver’s bar…',
    col: { persona: 'Driver', falta: 'What is missing', sale: 'Goes out?' },
    si: 'Yes',
    no: 'No',
    mandarA: (n: number) => `Send to ${n} on WhatsApp`,
    confirmarZona: (n: number, zona: string) =>
      `Send the WhatsApp message to ${n} drivers in ${zona}? Each one is logged in the audit trail with your name.`,
    resultadoZona: (e: number, f: number) =>
      `${e} sent.${f ? ` Meta did not accept ${f}.` : ''} Check the zone again for the next ones.`,
    hayMas: 'There are more drivers in this zone: after sending, check the next page.',
    siguiente: 'Next page',
    nadieZona: 'No drivers in this zone are stuck on a step of their own.',
  },
};

/** El país en palabras («Venezuela», «United States»), nunca su código. */
function nombrePais(codigo: string, idioma: Idioma) {
  try {
    return new Intl.DisplayNames([idioma], { type: 'region' }).of(codigo) ?? codigo;
  } catch {
    return codigo;
  }
}

const mensajeDe = (x: unknown) => (x instanceof ErrorApi ? x.message : String(x));
const motivoEn = (t: (typeof T)['es'], m: string | null) =>
  m ? (new Map(Object.entries(t.motivo)).get(m) ?? m) : '';

function Ventana({
  titulo,
  alCerrar,
  children,
}: {
  titulo: string;
  alCerrar: () => void;
  children: React.ReactNode;
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
        className="rez-dialogo"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        data-testid="whatsapp-falta-ventana"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={`${id}-t`}>{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

/** El botón de la ficha y de Verificaciones. `alEnviar` refresca la línea de tiempo. */
export function MandarWhatsappFalta({
  id,
  idioma,
  alEnviar,
}: {
  id: string;
  idioma: Idioma;
  alEnviar?: () => void;
}) {
  const t = enIdioma(T, idioma);
  const { puedeVer } = usePermisos();
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<Vista | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [pedirEspera, setPedirEspera] = useState(false);
  const cerrar = useCallback(() => setAbierto(false), []);

  const ver = useCallback(() => {
    setVista(null);
    setError('');
    setOk('');
    setPedirEspera(false);
    pedir<{ vista: Vista }>('POST', `/datos/admin/camila/whatsapp/${encodeURIComponent(id)}`, {
      soloVista: true,
    })
      .then((r) => setVista(r.vista))
      .catch((x: unknown) => setError(mensajeDe(x) || t.error));
  }, [id, t.error]);

  async function mandar(saltarEspera: boolean) {
    if (!vista || ocupado) return;
    if (!window.confirm(saltarEspera ? t.confirmarEspera : t.confirmar)) return;
    setOcupado(true);
    setError('');
    try {
      const r = await pedir<{ vista: Vista; enviado: boolean; estado?: string; motivo?: string }>(
        'POST',
        `/datos/admin/camila/whatsapp/${encodeURIComponent(id)}`,
        { confirmar: true, saltarEspera },
      );
      setVista(r.vista);
      if (r.enviado) setOk(t.enviado);
      else if (r.estado === 'fallido') setError(t.fallido);
      else setError(motivoEn(t, r.motivo ?? null));
      alEnviar?.();
    } catch (x) {
      if (x instanceof ErrorApi && x.estado === 409) setPedirEspera(true);
      else setError(mensajeDe(x));
    } finally {
      setOcupado(false);
    }
  }

  // Sin permiso para escribirle a la persona, el botón no se ofrece (el servidor igual lo frena).
  if (!puedeVer('tickets.responder')) return null;
  return (
    <>
      <div className="fila-botones">
        <button
          type="button"
          className="boton secundario"
          data-testid="whatsapp-falta-boton"
          onClick={() => {
            setAbierto(true);
            ver();
          }}
        >
          {t.boton}
        </button>
      </div>
      {abierto ? (
        <Ventana titulo={t.titulo} alCerrar={cerrar}>
          {!vista && !error ? <p role="status">{t.armando}</p> : null}
          {vista ? (
            <>
              {vista.texto ? (
                <>
                  <p className="pista">{t.asi}</p>
                  <div className="rez-vista" data-testid="whatsapp-falta-texto">
                    <p>{vista.texto}</p>
                  </div>
                </>
              ) : (
                <p className="pista">{t.sinTexto}</p>
              )}
              {vista.delPaso > 0 ? <p className="pista">{t.yaVan(vista.delPaso)}</p> : null}
              {!vista.puede && vista.motivo && !ok ? (
                <p
                  className={vista.motivo === 'ya_hoy' ? 'pista' : 'error-general'}
                  role="status"
                  data-testid="whatsapp-falta-motivo"
                >
                  {motivoEn(t, vista.motivo)}
                </p>
              ) : null}
            </>
          ) : null}
          {pedirEspera ? (
            <p className="pista" role="alert">
              {t.confirmarEspera}
            </p>
          ) : null}
          {error ? (
            <p className="error-general" role="alert">
              {error}{' '}
              {!vista ? (
                <button type="button" className="enlace" onClick={ver}>
                  {t.reintentar}
                </button>
              ) : null}
            </p>
          ) : null}
          {ok ? (
            <p className="texto-exito" role="status">
              {ok}
            </p>
          ) : null}
          <div className="rez-dialogo-botones">
            <button type="button" className="boton secundario" onClick={cerrar}>
              {ok ? t.cerrar : t.cancelar}
            </button>
            {!ok &&
            (vista?.puede ||
              pedirEspera ||
              (vista?.motivo === 'ya_hoy' && vista.esperaSaltable)) ? (
              <button
                type="button"
                className="boton"
                disabled={ocupado}
                data-testid="whatsapp-falta-enviar"
                onClick={() =>
                  void mandar(
                    pedirEspera || (vista?.motivo === 'ya_hoy' && Boolean(vista?.esperaSaltable)),
                  )
                }
              >
                {ocupado
                  ? t.enviando
                  : pedirEspera || vista?.motivo === 'ya_hoy'
                    ? t.enviarIgual
                    : t.enviar}
              </button>
            ) : null}
          </div>
        </Ventana>
      ) : null}
    </>
  );
}

// ───────────────────────── Los ajustes y la zona ─────────────────────────

type Ajustes = {
  paises: Record<string, boolean>;
  topeDiario: number;
  presupuestoDiaUsd: number;
  costoUsd: number;
};
type Estado = {
  listo: boolean;
  motivo: string | null;
  plantilla: {
    nombre: string;
    estado: string;
    categoria: string | null;
    motivo: string | null;
    cuerpo: string;
  };
  ajustes: Ajustes;
  gasto: { mensajes: number; usd: number };
  zonas: { id: string; nombre: string; pais: string }[];
};
type FilaZona = Vista;
/** Lo que se escribe en el formulario de ajustes (guarda su borrador: regla de formularios). */
type ValoresAjustes = Ajustes & { plantillaEstado: string };
const VACIO: ValoresAjustes = {
  paises: {},
  topeDiario: 0,
  presupuestoDiaUsd: 0,
  costoUsd: 0,
  plantillaEstado: 'sin_crear',
};

export function WhatsappFaltaAjustes({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [e, setE] = useState<Estado | null>(null);
  const { puedeVer } = usePermisos();
  const puedeGuardar = puedeVer('tickets.configurar');
  const b = useBorrador<ValoresAjustes>({
    formulario: 'whatsapp-falta-ajustes',
    cuenta: 'superadmin',
    inicial: VACIO,
    almacen: almacenNavegador,
  });
  const aj = b.valores;
  const { cargarBase } = b;
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [zona, setZona] = useState('');
  const [pagina, setPagina] = useState(0);
  const [filas, setFilas] = useState<FilaZona[] | null>(null);
  const [hayMas, setHayMas] = useState(false);
  const [mirando, setMirando] = useState(false);
  const [resultado, setResultado] = useState('');

  const cargar = useCallback(
    () =>
      pedir<Estado>('GET', '/datos/admin/camila/whatsapp')
        .then((d) => {
          setE(d);
          cargarBase({ ...d.ajustes, plantillaEstado: d.plantilla.estado });
        })
        .catch((x: unknown) => setError(mensajeDe(x))),
    [cargarBase],
  );
  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function guardar() {
    if (!e) return;
    setOcupado(true);
    setError('');
    setOk('');
    const { plantillaEstado, ...ajustes } = aj;
    try {
      await pedir('PUT', '/datos/admin/camila/whatsapp', {
        ...ajustes,
        ...(plantillaEstado !== e.plantilla.estado
          ? { plantilla: { estado: plantillaEstado } }
          : {}),
      });
      setOk(t.guardado);
      // Guardado con éxito: el borrador ya no hace falta.
      b.cargar(aj);
      await cargar();
    } catch (x) {
      setError(mensajeDe(x));
    } finally {
      setOcupado(false);
    }
  }

  async function mirarZona(p = 0) {
    if (!zona) return;
    setMirando(true);
    setResultado('');
    setError('');
    try {
      const r = await pedir<{ filas: FilaZona[]; hayMas: boolean }>(
        'GET',
        `/datos/admin/camila/whatsapp/zona/${encodeURIComponent(zona)}?pagina=${p}`,
      );
      setFilas(r.filas);
      setHayMas(r.hayMas);
      setPagina(p);
    } catch (x) {
      setError(mensajeDe(x));
    } finally {
      setMirando(false);
    }
  }

  const salen = (filas ?? []).filter((f) => f.puede);
  const nombreZona = e?.zonas.find((z) => z.id === zona)?.nombre ?? zona;

  async function mandarZona() {
    if (!salen.length || ocupado) return;
    if (!window.confirm(t.confirmarZona(salen.length, nombreZona))) return;
    setOcupado(true);
    setError('');
    try {
      const r = await pedir<{ enviados: number; fallidos: number; filas: FilaZona[] }>(
        'POST',
        `/datos/admin/camila/whatsapp/zona/${encodeURIComponent(zona)}`,
        { ids: salen.map((f) => f.id), confirmar: true },
      );
      setResultado(t.resultadoZona(r.enviados, r.fallidos));
      setFilas(null);
      await cargar();
    } catch (x) {
      setError(mensajeDe(x));
    } finally {
      setOcupado(false);
    }
  }

  if (!e)
    return error ? (
      <p className="error-general" role="alert">
        {error}
      </p>
    ) : null;
  const paises = [...new Set([...Object.keys(aj.paises), ...e.zonas.map((z) => z.pais)])].sort();
  return (
    <section className="flex-tarjeta rez-tarjeta" data-testid="whatsapp-falta-ajustes">
      <h3>{t.ajustesTitulo}</h3>
      <p className="pista">{t.ajustesAyuda}</p>
      <p role="status" data-testid="whatsapp-falta-estado">
        <Insignia tono={e.listo ? 'hecho' : 'apagado'}>{e.listo ? t.listo : t.noListo}</Insignia>{' '}
        {e.listo ? '' : motivoEn(t, e.motivo)}
      </p>
      <p className="pista">{t.hoy(e.gasto.mensajes, e.gasto.usd)}</p>
      <div className="rez-vista">
        <p>
          <strong>{t.plantilla}:</strong> {e.plantilla.nombre} ·{' '}
          {new Map(Object.entries(t.estadoPlantilla)).get(e.plantilla.estado) ?? e.plantilla.estado}
          {e.plantilla.categoria ? ` · ${e.plantilla.categoria}` : ''}
          {e.plantilla.motivo ? ` · ${e.plantilla.motivo}` : ''}
        </p>
        <p className="pista">{e.plantilla.cuerpo}</p>
      </div>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <fieldset className="rez-sin-marco" disabled={!puedeGuardar}>
        <label className="campo">
          <span>{t.marcarPlantilla}</span>
          <select
            value={aj.plantillaEstado}
            onChange={(x) => b.cambiar('plantillaEstado', x.target.value)}
          >
            {Object.entries(t.estadoPlantilla).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="rez-canales">
          <legend>{t.paises}</legend>
          {paises.map((p) => (
            <label key={p} className="casilla-fila">
              <input
                type="checkbox"
                checked={Boolean(aj.paises[p])}
                onChange={(x) => b.cambiar('paises', { ...aj.paises, [p]: x.target.checked })}
              />{' '}
              {nombrePais(p, idioma)}
            </label>
          ))}
        </fieldset>
        <div className="wa-fila">
          <label className="campo">
            <span>{t.tope}</span>
            <input
              type="number"
              min={0}
              max={5000}
              value={aj.topeDiario}
              onChange={(x) =>
                b.cambiar('topeDiario', Math.max(0, Math.floor(Number(x.target.value) || 0)))
              }
            />
          </label>
          <label className="campo">
            <span>{t.presupuesto}</span>
            <input
              type="number"
              min={0}
              step="0.5"
              value={aj.presupuestoDiaUsd}
              onChange={(x) =>
                b.cambiar('presupuestoDiaUsd', Math.max(0, Number(x.target.value) || 0))
              }
            />
          </label>
          <label className="campo">
            <span>{t.costo}</span>
            <input
              type="number"
              min={0}
              step="0.001"
              value={aj.costoUsd}
              onChange={(x) => b.cambiar('costoUsd', Math.max(0, Number(x.target.value) || 0))}
            />
          </label>
        </div>
        {puedeGuardar ? (
          <div className="fila-botones">
            <button
              type="button"
              className="boton"
              disabled={ocupado}
              onClick={() => void guardar()}
            >
              {ocupado ? t.guardando : t.guardar}
            </button>
          </div>
        ) : null}
      </fieldset>
      {ok ? (
        <p className="texto-exito" role="status">
          {ok}
        </p>
      ) : null}

      <h3 className="wa-subtitulo">{t.zonaTitulo}</h3>
      <div className="wa-fila">
        <label className="campo">
          <span>{t.zona}</span>
          <select
            value={zona}
            data-testid="whatsapp-falta-zona"
            onChange={(x) => {
              setZona(x.target.value);
              setFilas(null);
              setResultado('');
            }}
          >
            <option value="">{t.elegir}</option>
            {e.zonas.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nombre} ({z.pais})
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="boton secundario"
          disabled={!zona || mirando}
          onClick={() => void mirarZona(0)}
        >
          {mirando ? t.mirando : t.verQuienes}
        </button>
      </div>
      {filas ? (
        filas.length === 0 ? (
          <p className="pista">{t.nadieZona}</p>
        ) : (
          <>
            <div className="tabla-ancha">
              <table className="tabla rez-tabla" data-testid="whatsapp-falta-tabla">
                <thead>
                  <tr>
                    <th scope="col">{t.col.persona}</th>
                    <th scope="col">{t.col.falta}</th>
                    <th scope="col">{t.col.sale}</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.id}>
                      <td>{f.nombre}</td>
                      <td className="rez-celda-texto">{f.falta?.texto ?? '—'}</td>
                      <td className="rez-celda-texto">
                        <Insignia tono={f.puede ? 'hecho' : 'apagado'}>
                          {f.puede ? t.si : t.no}
                        </Insignia>
                        {!f.puede ? (
                          <small className="pista"> {motivoEn(t, f.motivo)}</small>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hayMas ? (
              <p className="pista">
                {t.hayMas}{' '}
                <button type="button" className="enlace" onClick={() => void mirarZona(pagina + 1)}>
                  {t.siguiente}
                </button>
              </p>
            ) : null}
            <div className="fila-botones">
              <button
                type="button"
                className="boton"
                disabled={!salen.length || ocupado}
                data-testid="whatsapp-falta-zona-enviar"
                onClick={() => void mandarZona()}
              >
                {t.mandarA(salen.length)}
              </button>
            </div>
          </>
        )
      ) : null}
      {resultado ? (
        <p className="texto-exito" role="status">
          {resultado}
        </p>
      ) : null}
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
