import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { AvisoBorrador } from './AvisoBorrador';
import { EtiquetaPrueba } from './CuentasPrueba';
import { EncabezadoPagina } from './armazon/Piezas';
import { api, pedir } from './api';
import { HORAS_URGENTE, horasDesde } from './diseno/estados';
import { Insignia } from './diseno/Insignia';
import {
  type Comprobacion,
  FotoGrande,
  InsigniasComprobacion,
  type ResumenCara,
  T_VERIFICACIONES,
  deTabla,
  enlaceFicha,
  textoComprobacion,
} from './KycPiezas';
import { type DatosDeclarados, type LecturaIa, compararDatos } from './kycComparar';
import { MenuTresPuntos } from './MenuTresPuntos';
import { miniaturaWebp } from './SubirFoto';
import { caraEnNegro } from './fotoEnNegro';
import { PapelesConductor } from './SuperPapeles';
import { RevisionConductor } from './RevisionConductor';

/**
 * C-VERIFICACION-UNICA: aprobar la identidad desde «Aprobar todo lo que está en verde» o desde la lista
 * (la persona decide; la miniatura que verá el pasajero se guarda igual que al aprobar a mano).
 */
export async function aprobarIdentidad(id: string) {
  // C-CARA-EN-NEGRO: una cara en negro no se aprueba (el pasajero vería un círculo negro).
  if (await caraEnNegro(id)) throw new Error(T.es.caraNegra);
  await pedir('PATCH', `/datos/admin/kyc/${id}`, { estado: 'aprobado', motivo: '' });
  await guardarMiniatura(id);
}

/** La identidad está «en verde»: todas sus comprobaciones automáticas bien y la cara igual. */
export const identidadEnVerde = (
  estado: string,
  comprobaciones: readonly { tono: string }[] | undefined,
  cara: { tono: string } | null | undefined,
) =>
  estado === 'pendiente' &&
  (comprobaciones ?? []).length > 0 &&
  (comprobaciones ?? []).every((c) => c.tono === 'hecho') &&
  cara?.tono === 'hecho';

/** Reduce la selfie aprobada a una miniatura y la guarda; si no se puede, el pasajero no ve foto. */
export async function guardarMiniatura(id: string): Promise<boolean> {
  try {
    const r = await fetch(`/datos/admin/kyc/${id}/foto/selfie`, { credentials: 'same-origin' });
    if (!r.ok) return false;
    const mini = await miniaturaWebp(await r.blob());
    if (!mini) return false;
    await api.subirFoto(mini, `/datos/admin/kyc/${id}/miniatura`);
    return true;
  } catch (e) {
    console.error('kyc: miniatura de la selfie', e);
    return false;
  }
}

/** Los motivos de rechazo de cada día, en el idioma de la PERSONA (a ella le llega el texto). */
export const MOTIVOS_FRECUENTES = {
  es: [
    'La foto del documento está borrosa o cortada. Tómala de nuevo con buena luz.',
    'El documento está vencido. Envía uno vigente.',
    'La cara no coincide con la foto del documento.',
    'El nombre del documento no coincide con el de tu cuenta.',
    'Falta el reverso del documento.',
    'La foto es de una pantalla o de una fotocopia. Tómale la foto al documento original.',
  ],
  en: [
    'The photo of your ID is blurry or cut off. Please retake it in good light.',
    'Your ID is expired. Please send a valid one.',
    'Your face doesn’t match the photo on your ID.',
    'The name on your ID doesn’t match the name on your account.',
    'The back of your ID is missing.',
    'The photo is of a screen or a photocopy. Please take the photo of the original ID.',
  ],
};

const T = {
  es: {
    volver: '← Verificaciones',
    compara:
      'Compara la cara con la foto del documento, el nombre y la fecha de nacimiento, y que el documento no esté vencido.',
    fotos: 'Fotos',
    piezas: {
      doc_frente: 'Documento (frente)',
      doc_reverso: 'Documento (reverso)',
      selfie: 'Cara',
      local: 'Local',
      giro_1: 'Prueba de vida (1)',
      giro_2: 'Prueba de vida (2)',
    } as Record<string, string>,
    ampliar: (n: string) => `Ver ${n} en grande`,
    tabla: 'Lo que leyó la comprobación automática y lo que escribió la persona',
    tablaNota:
      'Solo para comparar: nada de esto se copia a su cuenta. Lo que no coincide va en ámbar.',
    sinLectura:
      'La comprobación automática no leyó datos de estas fotos (sin permiso del conductor, o se revisan a mano).',
    dato: 'Dato',
    leyo: 'Lo que leyó la comprobación automática',
    escribio: 'Lo que escribió la persona',
    resultado: 'Resultado',
    claves: {
      nombre: 'Nombre',
      numeroDocumento: 'Número del documento',
      venceDocumento: 'Vencimiento del documento',
      paisDocumento: 'País del documento',
      licenciaNumero: 'Número de licencia',
      licenciaVence: 'Vencimiento de la licencia',
      seguroPoliza: 'Número de póliza',
      seguroVence: 'Vencimiento del seguro',
    } as Record<string, string>,
    estadosComparacion: {
      coincide: 'Coincide',
      no_coincide: 'No coincide',
      vencido: 'Parece vencido',
      sin_dato: 'Sin dato para comparar',
    } as Record<string, string>,
    decision: 'Decisión',
    decisionNota:
      'Si apruebas, la selfie queda como su foto de perfil y no la puede cambiar. Si rechazas, le llega el motivo para que lo corrija.',
    aprobar: 'Aprobar',
    rechazar: 'Rechazar',
    motivo: 'Motivo del rechazo (le llega a la persona)',
    motivosFrecuentes: 'Motivos frecuentes',
    enIdiomaPersona: (i: string) => `Se le envía en ${i === 'en' ? 'inglés' : 'español'}.`,
    confirmarRechazo: 'Rechazar con este motivo',
    cancelar: 'Cancelar',
    faltaMotivo: 'Escribe o elige el motivo: le llega a la persona para que lo corrija.',
    caraNegra:
      'La foto de la cara salió en negro: así la vería el pasajero. No se puede aprobar; pídela de nuevo con «Pedir de nuevo».',
    estados: {
      pendiente: 'Pendiente',
      aprobado: 'Aprobada',
      rechazado: 'Rechazada',
      sin_enviar: 'Sin enviar',
    } as Record<string, string>,
    hecho: { aprobado: 'Verificación aprobada.', rechazado: 'Verificación rechazada.' } as Record<
      string,
      string
    >,
    distancia: 'Distancia entre la foto del local y la dirección registrada',
    metros: 'metros',
    antecedentes: 'Antecedentes (Checkr)',
    antecedentesEstados: {
      sin_pedir: 'Sin empezar',
      invitado: 'Invitación enviada',
      en_proceso: 'En proceso',
      aprobado: 'Aprobados',
      revisar: 'Para revisar (Checkr no dio «clear»)',
    } as Record<string, string>,
    controles: 'Fotos de control (identidad continua)',
    giroDerecha: 'Mirando a la derecha',
    conPruebaVida: 'con prueba de vida (frente y giro)',
    sinControles: 'Todavía no se le pidió ninguna.',
    pedida: 'Pedida',
    sinTomar: 'sin tomar',
    coincide: 'Coincide',
    noCoincide: 'No coincide',
    masOpciones: 'Más opciones',
    liberarFoto: 'Pedir una foto nueva',
    motivoFoto: 'Motivo para pedir una foto nueva (queda en el registro):',
    datos: 'Datos de la cuenta',
  },
  en: {
    volver: '← Verifications',
    compara:
      'Compare the face with the ID photo, the name and date of birth, and check the ID isn’t expired.',
    fotos: 'Photos',
    piezas: {
      doc_frente: 'ID (front)',
      doc_reverso: 'ID (back)',
      selfie: 'Face',
      local: 'Storefront',
      giro_1: 'Liveness check (1)',
      giro_2: 'Liveness check (2)',
    } as Record<string, string>,
    ampliar: (n: string) => `See ${n} full size`,
    tabla: 'What the automatic check read and what the person typed',
    tablaNota:
      'For comparison only: none of this is copied to their account. Mismatches show in amber.',
    sinLectura:
      'The automatic check didn’t read any data from these photos (no permission from the driver, or they’re reviewed by hand).',
    dato: 'Field',
    leyo: 'What the automatic check read',
    escribio: 'What the person typed',
    resultado: 'Result',
    claves: {
      nombre: 'Name',
      numeroDocumento: 'ID number',
      venceDocumento: 'ID expiration',
      paisDocumento: 'ID country',
      licenciaNumero: 'License number',
      licenciaVence: 'License expiration',
      seguroPoliza: 'Policy number',
      seguroVence: 'Insurance expiration',
    } as Record<string, string>,
    estadosComparacion: {
      coincide: 'Matches',
      no_coincide: 'Doesn’t match',
      vencido: 'Looks expired',
      sin_dato: 'Nothing to compare',
    } as Record<string, string>,
    decision: 'Decision',
    decisionNota:
      'If you approve, the selfie becomes their profile photo and they can’t change it. If you reject, they get the reason so they can fix it.',
    aprobar: 'Approve',
    rechazar: 'Reject',
    motivo: 'Rejection reason (the person receives it)',
    motivosFrecuentes: 'Common reasons',
    enIdiomaPersona: (i: string) => `It’s sent in ${i === 'en' ? 'English' : 'Spanish'}.`,
    confirmarRechazo: 'Reject with this reason',
    cancelar: 'Cancel',
    faltaMotivo: 'Write or pick the reason: the person receives it so they can fix it.',
    caraNegra:
      'The face photo came out black: that’s how the rider would see it. It can’t be approved; ask for it again with “Ask again”.',
    estados: {
      pendiente: 'Pending',
      aprobado: 'Approved',
      rechazado: 'Rejected',
      sin_enviar: 'Not sent',
    } as Record<string, string>,
    hecho: { aprobado: 'Verification approved.', rechazado: 'Verification rejected.' } as Record<
      string,
      string
    >,
    distancia: 'Distance between the storefront photo and the registered address',
    metros: 'meters',
    antecedentes: 'Background check (Checkr)',
    antecedentesEstados: {
      sin_pedir: 'Not started',
      invitado: 'Invitation sent',
      en_proceso: 'In progress',
      aprobado: 'Approved',
      revisar: 'Needs review (Checkr didn’t return “clear”)',
    } as Record<string, string>,
    controles: 'Identity check photos',
    giroDerecha: 'Looking to the right',
    conPruebaVida: 'with liveness check (front and turn)',
    sinControles: 'None requested yet.',
    pedida: 'Requested',
    sinTomar: 'not taken',
    coincide: 'Matches',
    noCoincide: 'Doesn’t match',
    masOpciones: 'More options',
    liberarFoto: 'Ask for a new photo',
    motivoFoto: 'Reason for asking for a new photo (kept in the log):',
    datos: 'Account details',
  },
};

type Detalle = {
  antecedentes?: { estado: string; url: string };
  selfiesControl?: {
    id: string;
    pedidaEn: string;
    tomadaEn: string | null;
    revisadaEn: string | null;
    resultado: string;
    conFoto: boolean;
    /** C-PRUEBA-DE-VIDA: trae también la foto mirando a la derecha. */
    conGiro?: boolean;
  }[];
  persona: {
    nombre: string;
    correo: string;
    telefono: string;
    fecha_nacimiento: string | null;
    rol: string;
    idioma?: string;
    restaurante: string | null;
    restaurante_id?: string | null;
    direccion: string | null;
    es_prueba?: number;
    codigo?: string | null;
    zona_id?: string | null;
    zona?: string | null;
  };
  kyc: {
    estado: string;
    docTipo: string;
    tiene: Record<string, boolean>;
    localDistanciaM: number | null;
    lejos: boolean;
    enviado?: string | null;
  };
  comprobaciones?: Comprobacion[];
  cara?: ResumenCara;
  lecturas?: LecturaIa[];
  declarado?: DatosDeclarados;
};

const PIEZAS_FOTO = ['doc_frente', 'doc_reverso', 'selfie', 'local', 'giro_1', 'giro_2'] as const;

/** La ficha de una verificación: fotos grandes, lo leído frente a lo escrito y la decisión. */
export function RevisarKyc({ base, idioma, id }: { base: string; idioma: Idioma; id: string }) {
  const t = enIdioma(T, idioma);
  const tv = enIdioma(T_VERIFICACIONES, idioma);
  const [d, setD] = useState<Detalle | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  /** null = sin tocar: se abre solo si se recuperó un motivo a medio escribir. */
  const [rechazandoElegido, setRechazando] = useState<boolean | null>(null);
  const [grande, setGrande] = useState<{ src: string; titulo: string } | null>(null);
  /** C-FICHA-SE-REFRESCA-AL-DECIDIR: sube al decidir; los papeles y la barra se vuelven a leer. */
  const [vueltaFicha, setVueltaFicha] = useState(0);
  const b = useBorrador({
    formulario: 'kyc-motivo',
    cuenta: id,
    inicial: { motivo: '' },
    almacen: almacenNavegador,
  });
  const cargar = useCallback(() => {
    pedir<Detalle>('GET', `/datos/admin/kyc/${id}`)
      .then(setD)
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [id]);
  useEffect(cargar, [cargar]);
  async function decidir(estado: 'aprobado' | 'rechazado') {
    setError('');
    setAviso('');
    const motivo = b.valores.motivo.trim();
    if (estado === 'rechazado' && !motivo) {
      setError(t.faltaMotivo);
      return;
    }
    // C-CARA-EN-NEGRO: una cara en negro no se aprueba; se pide de nuevo.
    if (estado === 'aprobado' && (await caraEnNegro(id))) {
      setError(t.caraNegra);
      return;
    }
    try {
      await pedir('PATCH', `/datos/admin/kyc/${id}`, {
        estado,
        motivo: estado === 'rechazado' ? motivo : '',
      });
      // C-FOTO-CONDUCTOR-MINIATURA: al aprobar, la miniatura que verá el pasajero (nunca la original).
      if (estado === 'aprobado') await guardarMiniatura(id);
      await b.limpiar();
      setRechazando(false);
      setAviso(deTabla(t.hecho, estado, ''));
      cargar();
      setVueltaFicha((v) => v + 1);
    } catch (x) {
      // Si falla, lo escrito se queda en pantalla para reintentar.
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function liberarFoto() {
    const motivo = window.prompt(t.motivoFoto) ?? '';
    if (motivo.trim().length < 5) return;
    try {
      await pedir('POST', `/datos/admin/kyc/${id}/liberar-foto`, { motivo });
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function calificar(cid: string, resultado: 'coincide' | 'no_coincide') {
    try {
      await pedir('PATCH', `/datos/admin/kyc/${id}/control/${cid}`, { resultado });
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  // Un motivo a medio escribir que se recuperó: el cuadro del rechazo vuelve a estar abierto.
  const rechazando = rechazandoElegido ?? (b.recuperado && b.valores.motivo.trim() !== '');
  if (!d) return <p role={error ? 'alert' : 'status'}>{error || '…'}</p>;
  const tiene = new Map(Object.entries(d.kyc.tiene ?? {}));
  const comprobacion = new Map((d.comprobaciones ?? []).map((c) => [c.pieza, c]));
  const p = d.persona;
  const ficha = enlaceFicha(base, { id, rol: p.rol, restauranteId: p.restaurante_id });
  const filas = compararDatos({
    lecturas: d.lecturas ?? [],
    nombre: p.nombre,
    pais: p.zona_id ? p.zona_id.slice(0, 2) : null,
    declarado: d.declarado ?? null,
  });
  const horas = horasDesde(d.kyc.enviado);
  const idiomaPersona = p.idioma === 'en' ? 'en' : 'es';
  const motivos = idiomaPersona === 'en' ? MOTIVOS_FRECUENTES.en : MOTIVOS_FRECUENTES.es;
  const opciones =
    d.kyc.estado === 'aprobado' && tiene.get('selfie')
      ? [{ texto: t.liberarFoto, peligro: true, alTocar: () => void liberarFoto() }]
      : [];

  return (
    <section className="super kyc-ficha">
      <Enlace a={`${base}/verifications`} className="docs-volver">
        {t.volver}
      </Enlace>
      <EncabezadoPagina
        titulo={p.nombre}
        detalle={
          <>
            {[
              p.codigo,
              p.zona || p.zona_id,
              p.rol === 'restaurante' ? tv.restaurante : tv.repartidor,
            ]
              .filter(Boolean)
              .join(' · ')}{' '}
            <EtiquetaPrueba si={Number(p.es_prueba) === 1} idioma={idioma} />
          </>
        }
      >
        {d.kyc.estado === 'pendiente' ? (
          <Insignia tono={horas >= HORAS_URGENTE ? 'problema' : 'pendiente'} testId="ficha-estado">
            {tv.espera(horas)}
          </Insignia>
        ) : (
          <Insignia estado={d.kyc.estado} testId="ficha-estado">
            {t.estados[d.kyc.estado] ?? d.kyc.estado}
          </Insignia>
        )}
        {ficha ? (
          <Enlace a={ficha} className="boton secundario chico">
            {tv.ficha}
          </Enlace>
        ) : null}
        {opciones.length ? <MenuTresPuntos etiqueta={t.masOpciones} opciones={opciones} /> : null}
      </EncabezadoPagina>

      <p className="kyc-ficha-datos">
        <span className="suave">{t.datos}:</span> {p.correo} · {p.telefono || '—'} ·{' '}
        {p.fecha_nacimiento ?? '—'}
        {p.restaurante ? ` · ${p.restaurante} · ${p.direccion ?? ''}` : ''}
      </p>

      <h2>{t.fotos}</h2>
      <p className="suave">{t.compara}</p>
      <div className="kyc-fotos-grandes" data-testid="kyc-fotos">
        {PIEZAS_FOTO.filter((pz) => tiene.get(pz)).map((pz) => {
          const nombre = deTabla(t.piezas, pz);
          const src = `/datos/admin/kyc/${id}/foto/${pz}`;
          const c = comprobacion.get(pz);
          return (
            <figure key={pz} className="kyc-foto">
              <button
                type="button"
                className="kyc-foto-boton"
                aria-label={t.ampliar(nombre)}
                onClick={() => setGrande({ src, titulo: nombre })}
              >
                <img src={src} alt={nombre} loading="lazy" />
              </button>
              <figcaption>
                <strong>{nombre}</strong>
                {c ? (
                  <Insignia tono={c.tono} testId={`ficha-comprobacion-${pz}`}>
                    {textoComprobacion(c, idioma).replace(/^[^:]+:\s*/, '')}
                  </Insignia>
                ) : null}
              </figcaption>
            </figure>
          );
        })}
      </div>
      <InsigniasComprobacion comprobaciones={[]} cara={d.cara ?? null} idioma={idioma} />
      {d.kyc.localDistanciaM != null ? (
        <p>
          <Insignia tono={d.kyc.lejos ? 'pendiente' : 'hecho'}>
            {t.distancia}: {d.kyc.localDistanciaM} {t.metros}
          </Insignia>
        </p>
      ) : null}

      <h2>{t.tabla}</h2>
      {filas.length ? (
        <>
          <p className="suave">{t.tablaNota}</p>
          <div className="tabla-ancha">
            <table className="tabla kyc-comparar" data-testid="kyc-comparar">
              <thead>
                <tr>
                  <th>{t.dato}</th>
                  <th>{t.leyo}</th>
                  <th>{t.escribio}</th>
                  <th>{t.resultado}</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr
                    key={f.clave}
                    className={
                      f.estado === 'no_coincide' || f.estado === 'vencido'
                        ? 'kyc-no-coincide'
                        : undefined
                    }
                    data-estado={f.estado}
                  >
                    <th scope="row">{t.claves[f.clave] ?? f.clave}</th>
                    <td>{f.leido || '—'}</td>
                    <td>{f.escrito || '—'}</td>
                    <td>
                      <Insignia
                        tono={
                          f.estado === 'coincide'
                            ? 'hecho'
                            : f.estado === 'sin_dato'
                              ? 'apagado'
                              : 'pendiente'
                        }
                      >
                        {t.estadosComparacion[f.estado] ?? f.estado}
                      </Insignia>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="suave">{t.sinLectura}</p>
      )}

      {aviso ? (
        <p className="exito-general" role="status">
          {aviso}
        </p>
      ) : null}
      {d.kyc.estado === 'pendiente' ? (
        <form
          className="formulario tarjeta-form kyc-decision"
          onSubmit={(e) => e.preventDefault()}
          noValidate
          data-testid="kyc-decision"
          id="kyc-decision"
        >
          <h2>{t.decision}</h2>
          <AvisoBorrador
            visible={b.recuperado}
            idioma={idioma}
            empezar={() => void b.empezarDeNuevo()}
          />
          <p className="suave">{t.decisionNota}</p>
          {rechazando ? (
            <fieldset className="kyc-rechazo">
              <legend>{t.motivosFrecuentes}</legend>
              <div className="kyc-motivos">
                {motivos.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`kyc-motivo${b.valores.motivo === m ? ' activo' : ''}`}
                    aria-pressed={b.valores.motivo === m}
                    onClick={() => b.cambiar('motivo', m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <label className="campo">
                <span>{t.motivo}</span>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={b.valores.motivo}
                  onChange={(e) => b.cambiar('motivo', e.target.value)}
                />
              </label>
              <p className="suave">{t.enIdiomaPersona(idiomaPersona)}</p>
            </fieldset>
          ) : null}
          {error ? (
            <p className="error-general" role="alert">
              {error}
            </p>
          ) : null}
          <div className="fila-botones">
            {rechazando ? (
              <>
                <button
                  type="button"
                  className="boton secundario"
                  onClick={() => void decidir('rechazado')}
                >
                  {t.confirmarRechazo}
                </button>
                <button
                  type="button"
                  className="boton terciario"
                  onClick={() => {
                    setRechazando(false);
                    setError('');
                  }}
                >
                  {t.cancelar}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="boton" onClick={() => void decidir('aprobado')}>
                  {t.aprobar}
                </button>
                <button
                  type="button"
                  className="boton secundario"
                  onClick={() => {
                    setRechazando(true);
                    setError('');
                  }}
                >
                  {t.rechazar}
                </button>
              </>
            )}
          </div>
        </form>
      ) : error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}

      {/* Las fotos grandes ya están arriba: aquí la tarjeta «Papeles» va en miniatura (plazo, licencia,
          seguro y «Pedir de nuevo» una sola foto). */}
      {p.rol === 'repartidor' ? (
        <PapelesConductor key={`papeles-${vueltaFicha}`} id={id} idioma={idioma} />
      ) : null}
      {/* C-VERIFICACION-UNICA: todo lo demás que se decide de él (vehículo, papeles, servicios) y su
          barra de activación, aquí mismo: la misma pieza que en su ficha. */}
      {p.rol === 'repartidor' ? (
        <RevisionConductor
          key={`revision-${vueltaFicha}`}
          id={id}
          base={base}
          idioma={idioma}
          identidad={{
            enVerde: identidadEnVerde(d.kyc.estado, d.comprobaciones, d.cara),
            aprobar: async () => {
              await aprobarIdentidad(id);
              cargar();
            },
          }}
        />
      ) : null}
      {d.antecedentes ? (
        <p>
          <strong>{t.antecedentes}:</strong>{' '}
          {t.antecedentesEstados[d.antecedentes.estado] ?? d.antecedentes.estado}
        </p>
      ) : null}
      {d.selfiesControl ? (
        <div className="kyc-controles">
          <h2>{t.controles}</h2>
          {d.selfiesControl.length === 0 ? <p className="suave">{t.sinControles}</p> : null}
          <div className="kyc-fotos">
            {d.selfiesControl.map((c) => (
              <figure key={c.id}>
                {c.conFoto ? (
                  <img
                    src={`/datos/admin/kyc/${id}/control/${c.id}`}
                    alt={t.controles}
                    loading="lazy"
                  />
                ) : null}
                {c.conGiro ? (
                  <img
                    src={`/datos/admin/kyc/${id}/control/${c.id}?pose=giro`}
                    alt={t.giroDerecha}
                    loading="lazy"
                  />
                ) : null}
                <figcaption>
                  {t.pedida} {c.pedidaEn}
                  {c.conGiro ? ` · ${t.conPruebaVida}` : ''}
                  {c.tomadaEn ? '' : ` · ${t.sinTomar}`}
                  {c.resultado
                    ? ` · ${c.resultado === 'coincide' ? t.coincide : t.noCoincide}`
                    : ''}
                </figcaption>
                {c.tomadaEn && !c.resultado ? (
                  <div className="fila-botones">
                    <button
                      type="button"
                      className="boton secundario chico"
                      onClick={() => void calificar(c.id, 'coincide')}
                    >
                      {t.coincide}
                    </button>
                    <button
                      type="button"
                      className="boton terciario chico"
                      onClick={() => void calificar(c.id, 'no_coincide')}
                    >
                      {t.noCoincide}
                    </button>
                  </div>
                ) : null}
              </figure>
            ))}
          </div>
        </div>
      ) : null}
      <FotoGrande foto={grande} cerrar={() => setGrande(null)} idioma={idioma} />
    </section>
  );
}
