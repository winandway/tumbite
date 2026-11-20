import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  PAPELES_PARA_EMPEZAR,
  PLAZO_DIAS_MAXIMO,
  type PapelParaEmpezar,
  type PasoVerificacion,
  type PoliticaPlazoPapeles,
  almacenNavegador,
  enIdioma,
  textosDePaso,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { pedir } from './api';
import { fechaSuper } from './horario';
import './superPapeles.css';

/**
 * C-PLAZO-PAPELES y C-VERIFICACION-IA en el superadmin (20 nov 2026) — todos los países.
 * Una sola pieza para: la insignia de la lista de conductores, la tarjeta «Papeles» de la ficha y de
 * Verificaciones (plazo, comprobaciones en verde, amarillo y rojo, lo que se leyó de cada foto y
 * «Pedir de nuevo» UNA sola foto), la política del país en Ajustes y el tablero de acierto.
 */

export type EstadoPapeles = 'sin_plazo' | 'en_plazo' | 'completo' | 'vencido';

const T = {
  es: {
    papeles: 'Papeles',
    sinPlazo: 'Sin plazo',
    enPlazo: (d: number) => (d === 1 ? 'En plazo · queda 1 día' : `En plazo · quedan ${d} días`),
    completo: 'Completos',
    vencido: 'Plazo vencido · en pausa',
    vence: 'Vence el',
    filtro: 'Papeles',
    todos: 'Todos',
    porVencer: 'Plazo por vencer (10 días o menos)',
    enPlazoFiltro: 'Dentro del plazo',
    vencidoFiltro: 'Plazo vencido',
    estados: {
      pendiente: 'Pendiente',
      por_enviar: 'Tomó las fotos, falta enviar',
      en_revision: 'En revisión',
      aprobado: 'Aprobado',
      repetir: 'Tiene que repetir',
    } as Record<string, string>,
    nombres: {
      identidad: 'Documento de identidad',
      licencia: 'Licencia',
      seguro: 'Seguro',
      cara: 'Cara',
    } as Record<string, string>,
    colores: {
      verde: 'La comprobación automática lo ve bien',
      amarillo: 'Hay dudas: míralo con cuidado',
      rojo: 'No coincide con lo que se pidió',
      sin_ia: 'Sin comprobación automática: revísalo a mano',
    } as Record<string, string>,
    cortos: { verde: 'Verde', amarillo: 'Amarillo', rojo: 'Rojo', sin_ia: 'A mano' } as Record<
      string,
      string
    >,
    clases: {
      identidad_frente: 'frente del documento de identidad',
      identidad_reverso: 'reverso del documento de identidad',
      licencia_frente: 'frente de la licencia',
      licencia_reverso: 'reverso de la licencia',
      seguro: 'seguro',
      cara: 'una cara',
      otra_cosa: 'otra cosa',
    } as Record<string, string>,
    comprobaciones: 'Comprobaciones',
    sinFoto: 'Todavía no la tomó',
    seVe: 'Se ve',
    confianza: 'confianza',
    legible: 'Se lee',
    noLegible: 'No se lee bien',
    vencidoDoc: 'Parece vencido',
    fotoDeFoto: 'Parece la foto de otra foto o de una pantalla',
    insistio: 'La persona la dejó pese al aviso',
    leido: 'Lo que se leyó (solo para comparar; no se escribe en su cuenta)',
    nombre: 'Nombre',
    numero: 'Número',
    venceDoc: 'Vence',
    paisDoc: 'País',
    caras: 'Cara en vivo contra la foto del documento',
    carasR: {
      misma: 'Misma persona',
      distinta: 'No parece la misma persona',
      dudoso: 'Dudoso',
      sin_ia: 'Sin comparar: compáralas a mano',
    } as Record<string, string>,
    pedirDeNuevo: 'Pedir de nuevo',
    motivo: 'Motivo (le llega a la persona)',
    motivoCorto: 'Escribe el motivo, con al menos 3 letras.',
    enviarPedido: 'Pedir esta foto otra vez',
    cancelar: 'Cancelar',
    pedida: 'Se le pidió repetirla',
    todoVerde:
      'Todas las comprobaciones vienen en verde. Mira las fotos y aprueba cada papel en su sección.',
    hayDudas: 'Hay comprobaciones en amarillo o en rojo: revisa esas fotos antes de aprobar.',
    darPlazo: 'Dar plazo de papeles',
    darPlazoAyuda:
      'Esta persona se registró antes de que existiera el plazo. Con esto empieza a contar su plazo desde hoy.',
    plazoDado: 'Listo: su plazo empezó a contar.',
    decision: { aprobado: 'El equipo aprobó', rechazado: 'El equipo rechazó' } as Record<
      string,
      string
    >,
    // Política del país
    politica: 'Plazo de papeles del conductor',
    politicaAyuda:
      'Con plazo, el conductor trabaja desde que crea la cuenta y tiene estos días para subir y aprobar el resto. Con cero días, todo se aprueba antes del primer viaje.',
    dias: 'Días de plazo (0 = sin plazo)',
    paraEmpezar: 'Se exige para empezar, aunque haya plazo',
    papelesEmpezar: {
      cara: 'Foto de la cara',
      identidad: 'Documento de identidad',
      licencia: 'Licencia',
      seguro: 'Seguro',
    } as Record<PapelParaEmpezar, string>,
    exentos: 'Requisitos que este país no exige nunca',
    exentosNombres: {
      antecedentes: 'Antecedentes (reparto)',
      antecedentes_pasajeros: 'Antecedentes (pasajeros)',
    } as Record<string, string>,
    asistente: 'Subir los papeles con el asistente de fotos',
    automatica: 'Aprobación automática',
    automaticaAyuda:
      'Apagada, una persona aprueba siempre. Encendida, lo que venga todo en verde y con confianza alta se aprueba solo; lo demás sigue llegando al revisor.',
    acierto: 'Acierto medido en este país',
    sinCasos: 'Todavía no hay casos decididos para medirlo.',
    casos: (p: number, n: number) => `${p} % de acierto en ${n} fotos decididas por el equipo`,
    guardarPolitica: 'Guardar el plazo de papeles',
    guardado: 'Guardado.',
    riesgo:
      'Durante el plazo hay conductores trabajando sin licencia ni seguro verificados por el equipo.',
    // Tablero
    tablero: 'Comprobación automática de fotos',
    hoy: 'Hoy',
    llamadas: 'consultas',
    gastado: 'gastado',
    tope: 'tope del día',
    fallos: 'sin respuesta',
    pais: 'País',
    foto: 'Foto',
    decididas: 'Decididas',
    aciertoCol: 'Acierto',
    tableroVacio: 'Cuando el equipo apruebe o rechace fotos, aquí sale cuánto acierta.',
  },
  en: {
    papeles: 'Documents',
    sinPlazo: 'No grace period',
    enPlazo: (d: number) =>
      d === 1 ? 'Grace period · 1 day left' : `Grace period · ${d} days left`,
    completo: 'Complete',
    vencido: 'Grace period over · paused',
    vence: 'Ends on',
    filtro: 'Documents',
    todos: 'All',
    porVencer: 'Grace period ending (10 days or less)',
    enPlazoFiltro: 'Within the grace period',
    vencidoFiltro: 'Grace period over',
    estados: {
      pendiente: 'Pending',
      por_enviar: 'Photos taken, not sent yet',
      en_revision: 'In review',
      aprobado: 'Approved',
      repetir: 'Needs to retake',
    } as Record<string, string>,
    nombres: {
      identidad: 'ID document',
      licencia: 'License',
      seguro: 'Insurance',
      cara: 'Face',
    } as Record<string, string>,
    colores: {
      verde: 'The automatic check sees it as fine',
      amarillo: 'There are doubts: look closely',
      rojo: 'It doesn’t match what was asked',
      sin_ia: 'No automatic check: review it by hand',
    } as Record<string, string>,
    cortos: { verde: 'Green', amarillo: 'Yellow', rojo: 'Red', sin_ia: 'By hand' } as Record<
      string,
      string
    >,
    clases: {
      identidad_frente: 'front of the ID document',
      identidad_reverso: 'back of the ID document',
      licencia_frente: 'front of the license',
      licencia_reverso: 'back of the license',
      seguro: 'insurance',
      cara: 'a face',
      otra_cosa: 'something else',
    } as Record<string, string>,
    comprobaciones: 'Checks',
    sinFoto: 'Not taken yet',
    seVe: 'It shows',
    confianza: 'confidence',
    legible: 'Readable',
    noLegible: 'Hard to read',
    vencidoDoc: 'Looks expired',
    fotoDeFoto: 'Looks like a photo of another photo or of a screen',
    insistio: 'The person kept it despite the warning',
    leido: 'What was read (only to compare; nothing is written to their account)',
    nombre: 'Name',
    numero: 'Number',
    venceDoc: 'Expires',
    paisDoc: 'Country',
    caras: 'Live face against the document photo',
    carasR: {
      misma: 'Same person',
      distinta: 'Doesn’t look like the same person',
      dudoso: 'Unsure',
      sin_ia: 'Not compared: compare them by hand',
    } as Record<string, string>,
    pedirDeNuevo: 'Ask again',
    motivo: 'Reason (the person receives it)',
    motivoCorto: 'Write the reason, at least 3 letters.',
    enviarPedido: 'Ask for this photo again',
    cancelar: 'Cancel',
    pedida: 'They were asked to retake it',
    todoVerde: 'Every check is green. Look at the photos and approve each document in its section.',
    hayDudas: 'Some checks are yellow or red: review those photos before approving.',
    darPlazo: 'Give a documents grace period',
    darPlazoAyuda:
      'This person signed up before the grace period existed. This starts their grace period today.',
    plazoDado: 'Done: their grace period started.',
    decision: { aprobado: 'The team approved', rechazado: 'The team rejected' } as Record<
      string,
      string
    >,
    politica: 'Driver documents grace period',
    politicaAyuda:
      'With a grace period, the driver works from the moment they create the account and has these days to upload and get the rest approved. With zero days, everything is approved before the first ride.',
    dias: 'Grace period days (0 = none)',
    paraEmpezar: 'Required to start, even with a grace period',
    papelesEmpezar: {
      cara: 'Face photo',
      identidad: 'ID document',
      licencia: 'License',
      seguro: 'Insurance',
    } as Record<PapelParaEmpezar, string>,
    exentos: 'Requirements this country never asks for',
    exentosNombres: {
      antecedentes: 'Background check (delivery)',
      antecedentes_pasajeros: 'Background check (passengers)',
    } as Record<string, string>,
    asistente: 'Upload documents with the photo assistant',
    automatica: 'Automatic approval',
    automaticaAyuda:
      'Off, a person always approves. On, whatever comes all green with high confidence is approved on its own; everything else still goes to the reviewer.',
    acierto: 'Measured accuracy in this country',
    sinCasos: 'No decided cases yet to measure it.',
    casos: (p: number, n: number) => `${p}% accuracy over ${n} photos decided by the team`,
    guardarPolitica: 'Save the documents grace period',
    guardado: 'Saved.',
    riesgo:
      'During the grace period, drivers work without a license or insurance verified by the team.',
    tablero: 'Automatic photo check',
    hoy: 'Today',
    llamadas: 'checks',
    gastado: 'spent',
    tope: 'daily cap',
    fallos: 'unanswered',
    pais: 'Country',
    foto: 'Photo',
    decididas: 'Decided',
    aciertoCol: 'Accuracy',
    tableroVacio: 'Once the team approves or rejects photos, the accuracy shows here.',
  },
};

/** Lee un texto por su clave sin indexar el objeto con un valor que viene de fuera. */
const de = (textos: Record<string, string>, clave: string) =>
  new Map(Object.entries(textos)).get(clave) ?? clave;
const mensaje = (x: unknown) => (x instanceof ErrorApi ? x.message : String(x));
// C-HORARIO-EMPLEADO: con el reloj y la zona del empleado (la misma pieza de todo el superadmin).
const fechaDia = (s: string | null, idioma: Idioma) => fechaSuper(s, idioma, { estilo: 'fecha' });

/** La insignia de papeles: verde lo completo, rojo el plazo vencido, neutro lo demás. */
export function InsigniaPapeles({
  papeles,
  dias,
  idioma,
}: {
  papeles: EstadoPapeles | string;
  dias: number | null;
  idioma: Idioma;
}) {
  const t = enIdioma(T, idioma);
  if (papeles === 'completo')
    return <span className="insignia insignia-aprobado">{t.completo}</span>;
  if (papeles === 'vencido')
    return <span className="insignia insignia-rechazado">{t.vencido}</span>;
  if (papeles === 'en_plazo')
    return (
      <span className={`insignia ${dias !== null && dias <= 10 ? 'papeles-por-vencer' : ''}`}>
        {t.enPlazo(dias ?? 0)}
      </span>
    );
  return <span className="suave">{t.sinPlazo}</span>;
}

/** El filtro «Papeles» de la lista de conductores. */
export function FiltroPapeles({
  valor,
  cambiar,
  idioma,
}: {
  valor: string;
  cambiar: (v: string) => void;
  idioma: Idioma;
}) {
  const t = enIdioma(T, idioma);
  return (
    <select
      value={valor}
      onChange={(e) => cambiar(e.target.value)}
      aria-label={t.filtro}
      data-testid="filtro-papeles"
    >
      <option value="">
        {t.filtro}: {t.todos}
      </option>
      <option value="por_vencer">{t.porVencer}</option>
      <option value="en_plazo">{t.enPlazoFiltro}</option>
      <option value="vencido">{t.vencidoFiltro}</option>
    </select>
  );
}

type Lectura = {
  clase?: string;
  legible?: boolean;
  vencido?: string;
  pais?: string;
  nombre?: string;
  numero?: string;
  vence?: string;
  fotoDeOtraFoto?: boolean;
} | null;

type FotoEquipo = {
  paso: PasoVerificacion;
  papel: string;
  foto: {
    id: string;
    estado: 'vigente' | 'repetir';
    motivo: string;
    insistio: boolean;
    color: string;
    clase: string;
    confianza: number | null;
    lectura: Lectura;
    decision: string;
    creadoEn: string;
  } | null;
};

type Verificacion = {
  nombre: string;
  pais: string;
  plazo: { estado: EstadoPapeles; venceEn: string | null; dias: number };
  papeles: { papel: string; pasos: string[]; estado: string; motivo: string }[];
  caras: { resultado: string; confianza: number | null; color: string } | null;
  fotos: FotoEquipo[];
};

function Luz({ color, idioma }: { color: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const c = ['verde', 'amarillo', 'rojo'].includes(color) ? color : 'sin_ia';
  return (
    <span className={`papeles-luz papeles-luz-${c}`} title={de(t.colores, c)}>
      <span aria-hidden="true" />
      {de(t.cortos, c)}
    </span>
  );
}

function PedirFoto({
  id,
  paso,
  idioma,
  listo,
}: {
  id: string;
  paso: PasoVerificacion;
  idioma: Idioma;
  listo: () => void;
}) {
  const t = enIdioma(T, idioma);
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState('');
  const b = useBorrador({
    formulario: `pedir-foto-${paso}`,
    cuenta: id,
    inicial: { motivo: '' },
    almacen: almacenNavegador,
  });
  async function enviar() {
    const motivo = b.valores.motivo.trim();
    if (motivo.length < 3) {
      setError(t.motivoCorto);
      return;
    }
    setError('');
    try {
      await pedir('POST', `/datos/admin/verificacion/${id}/pedir-foto`, { paso, motivo });
      await b.limpiar();
      setAbierto(false);
      listo();
    } catch (x) {
      // Si falla, lo escrito se queda en pantalla para reintentar.
      setError(mensaje(x));
    }
  }
  if (!abierto && !b.recuperado)
    return (
      <button
        type="button"
        className="enlace"
        onClick={() => setAbierto(true)}
        data-testid={`pedir-${paso}`}
      >
        {t.pedirDeNuevo}
      </button>
    );
  return (
    <form className="papeles-pedir" onSubmit={(e) => e.preventDefault()} noValidate>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <label className="campo">
        <span>{t.motivo}</span>
        <input
          value={b.valores.motivo}
          maxLength={200}
          onChange={(e) => b.cambiar('motivo', e.target.value)}
          aria-label={t.motivo}
        />
      </label>
      {error && (
        <p className="error-general" role="alert">
          {error}
        </p>
      )}
      <div className="fila-botones">
        <button type="button" className="boton chico" onClick={() => void enviar()}>
          {t.enviarPedido}
        </button>
        <button
          type="button"
          className="boton secundario chico"
          onClick={() => {
            void b.limpiar();
            setAbierto(false);
            setError('');
          }}
        >
          {t.cancelar}
        </button>
      </div>
    </form>
  );
}

/**
 * La tarjeta «Papeles» de un conductor: su plazo, cada foto con su miniatura, lo que dijo la
 * comprobación automática y lo que se leyó, y «Pedir de nuevo» una sola foto. `completa` enseña las
 * fotos en grande (Verificaciones); en la ficha van en miniatura.
 */
export function PapelesConductor({
  id,
  idioma,
  completa = false,
}: {
  id: string;
  idioma: Idioma;
  completa?: boolean;
}) {
  const t = enIdioma(T, idioma);
  const [v, setV] = useState<Verificacion | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const cargar = useCallback(() => {
    pedir<Verificacion>('GET', `/datos/admin/verificacion/${id}`)
      .then((r) => {
        // Una respuesta que no trae el plazo ni las fotos no se pinta (nunca una tarjeta rota).
        setV(r?.plazo && Array.isArray(r.fotos) && Array.isArray(r.papeles) ? r : null);
        setError('');
      })
      .catch((x: unknown) => setError(mensaje(x)));
  }, [id]);
  useEffect(cargar, [cargar]);
  async function darPlazo() {
    setAviso('');
    try {
      await pedir('POST', `/datos/admin/verificacion/${id}/plazo`, {});
      setAviso(t.plazoDado);
      cargar();
    } catch (x) {
      setError(mensaje(x));
    }
  }
  if (!v) return error ? null : <p role="status">…</p>;
  const conFoto = v.fotos.filter((f) => f.foto);
  // Sin plazo y sin ninguna foto del asistente no hay nada que enseñar (conductores de siempre).
  if (v.plazo.estado === 'sin_plazo' && conFoto.length === 0 && !completa) return null;
  const colores = [
    ...conFoto.map((f) => f.foto?.color ?? 'sin_ia'),
    ...(v.caras ? [v.caras.color] : []),
  ];
  const todoVerde = colores.length > 0 && colores.every((c) => c === 'verde');
  const hayDudas = colores.some((c) => c === 'amarillo' || c === 'rojo');
  return (
    <div className="tarjeta-form papeles-tarjeta" data-testid="papeles-conductor">
      <h2>
        {t.papeles}{' '}
        <InsigniaPapeles
          papeles={v.plazo.estado}
          dias={v.plazo.estado === 'en_plazo' ? v.plazo.dias : null}
          idioma={idioma}
        />
      </h2>
      {v.plazo.venceEn && v.plazo.estado !== 'completo' ? (
        <p className="suave">
          {t.vence} {fechaDia(v.plazo.venceEn, idioma)}
        </p>
      ) : null}
      <ul className="papeles-estados">
        {v.papeles.map((p) => (
          <li key={p.papel}>
            <strong>{t.nombres[p.papel] ?? p.papel}</strong>{' '}
            <span
              className={`insignia ${
                p.estado === 'aprobado'
                  ? 'insignia-aprobado'
                  : p.estado === 'repetir'
                    ? 'insignia-rechazado'
                    : ''
              }`}
            >
              {t.estados[p.estado] ?? p.estado}
            </span>
            {p.motivo ? <small> · {p.motivo}</small> : null}
          </li>
        ))}
      </ul>
      {conFoto.length > 0 ? (
        <>
          <h3>{t.comprobaciones}</h3>
          {todoVerde ? <p className="exito-general">{t.todoVerde}</p> : null}
          {hayDudas ? <p className="papeles-dudas">{t.hayDudas}</p> : null}
          <div className={completa ? 'papeles-fotos papeles-fotos-grandes' : 'papeles-fotos'}>
            {v.fotos.map((f) => {
              const nombre = textosDePaso(f.paso, v.pais, idioma === 'en').nombre;
              const foto = f.foto;
              if (!foto)
                return (
                  <figure key={f.paso} className="papeles-foto papeles-foto-vacia">
                    <div className={`papeles-horma ${f.paso === 'cara' ? 'redonda' : ''}`} />
                    <figcaption>
                      <strong>{nombre}</strong>
                      <span className="suave">{t.sinFoto}</span>
                    </figcaption>
                  </figure>
                );
              const l = foto.lectura;
              const leidos = [
                [t.nombre, l?.nombre],
                [t.numero, l?.numero],
                [t.venceDoc, l?.vence],
                [t.paisDoc, l?.pais],
              ].filter(([, valor]) => Boolean(valor));
              return (
                <figure key={f.paso} className="papeles-foto" data-testid={`foto-${f.paso}`}>
                  <a
                    href={`/datos/admin/verificacion/${id}/foto/${foto.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      className={f.paso === 'cara' ? 'redonda' : undefined}
                      src={`/datos/admin/verificacion/${id}/foto/${foto.id}`}
                      alt={nombre}
                      loading="lazy"
                    />
                  </a>
                  <figcaption>
                    <strong>{nombre}</strong>
                    <Luz color={foto.color} idioma={idioma} />
                    {foto.clase ? (
                      <span>
                        {t.seVe}: {t.clases[foto.clase] ?? foto.clase}
                        {foto.confianza !== null ? ` · ${foto.confianza} % ${t.confianza}` : ''}
                      </span>
                    ) : null}
                    {l && l.legible === false ? (
                      <span className="doc-por_vencer">{t.noLegible}</span>
                    ) : null}
                    {l?.vencido === 'si' ? (
                      <span className="doc-vencido">{t.vencidoDoc}</span>
                    ) : null}
                    {l?.fotoDeOtraFoto ? <span className="doc-vencido">{t.fotoDeFoto}</span> : null}
                    {foto.insistio ? <span className="doc-por_vencer">{t.insistio}</span> : null}
                    {leidos.length ? (
                      <dl className="papeles-leido" title={t.leido}>
                        {leidos.map(([k, valor]) => (
                          <div key={k}>
                            <dt>{k}</dt>
                            <dd>{valor}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                    {foto.decision ? (
                      <span className="suave">{t.decision[foto.decision] ?? foto.decision}</span>
                    ) : null}
                    {foto.estado === 'repetir' ? (
                      <span className="doc-por_vencer">
                        {t.pedida}: {foto.motivo}
                      </span>
                    ) : foto.decision !== 'aprobado' ? (
                      <PedirFoto id={id} paso={f.paso} idioma={idioma} listo={cargar} />
                    ) : null}
                  </figcaption>
                </figure>
              );
            })}
          </div>
          {v.caras ? (
            <p className="papeles-caras" data-testid="papeles-caras">
              <strong>{t.caras}:</strong> <Luz color={v.caras.color} idioma={idioma} />{' '}
              {t.carasR[v.caras.resultado] ?? v.caras.resultado}
              {v.caras.confianza !== null ? ` · ${v.caras.confianza} % ${t.confianza}` : ''}
            </p>
          ) : null}
        </>
      ) : null}
      {v.plazo.estado === 'sin_plazo' ? (
        <p>
          <button type="button" className="enlace" onClick={() => void darPlazo()}>
            {t.darPlazo}
          </button>{' '}
          <small className="suave">{t.darPlazoAyuda}</small>
        </p>
      ) : null}
      {aviso ? <p className="exito-general">{aviso}</p> : null}
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type FilaAcierto = {
  pais: string;
  paso: string;
  decididas: number;
  conOpinion: number;
  aciertos: number;
  porcentaje: number | null;
};
type Tablero = {
  acierto: FilaAcierto[];
  hoy: { microdolares: number; llamadas: number; fallos: number; topeMicrodolares: number };
};

function useTablero() {
  const [x, setX] = useState<Tablero | null>(null);
  useEffect(() => {
    pedir<Tablero>('GET', '/datos/admin/verificacion-ia/tablero')
      .then((r) => setX(r?.hoy && Array.isArray(r.acierto) ? r : null))
      .catch(() => setX(null));
  }, []);
  return x;
}

const dolares = (micro: number) => `$${(micro / 1_000_000).toFixed(2)}`;

/** Cuánto acierta la comprobación automática y cuánto lleva gastado hoy. */
export function TableroVerificacionIa({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const x = useTablero();
  if (!x) return null;
  return (
    <details className="tarjeta-form papeles-tablero" data-testid="tablero-ia">
      <summary>
        <strong>{t.tablero}</strong> · {t.hoy}: {x.hoy.llamadas} {t.llamadas} ·{' '}
        {dolares(x.hoy.microdolares)} {t.gastado} · {t.tope} {dolares(x.hoy.topeMicrodolares)}
        {x.hoy.fallos ? ` · ${x.hoy.fallos} ${t.fallos}` : ''}
      </summary>
      {x.acierto.length === 0 ? (
        <p className="suave">{t.tableroVacio}</p>
      ) : (
        <div className="tabla-ancha">
          <table className="tabla">
            <thead>
              <tr>
                <th>{t.pais}</th>
                <th>{t.foto}</th>
                <th>{t.decididas}</th>
                <th>{t.aciertoCol}</th>
              </tr>
            </thead>
            <tbody>
              {x.acierto.map((f) => (
                <tr key={`${f.pais}-${f.paso}`}>
                  <td>{f.pais}</td>
                  <td>
                    {textosDePaso(f.paso as PasoVerificacion, f.pais, idioma === 'en').nombre}
                  </td>
                  <td>{f.decididas}</td>
                  <td>{f.porcentaje === null ? '—' : `${f.porcentaje} %`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}

const EXENTOS_CONOCIDOS = ['antecedentes', 'antecedentes_pasajeros'];

/** La política del plazo de papeles de un país, en Ajustes. Se guarda entera con su botón. */
export function PoliticaPapelesPais({
  pais,
  politica,
  guardar,
  idioma,
}: {
  pais: string;
  politica: PoliticaPlazoPapeles;
  guardar: (p: PoliticaPlazoPapeles) => Promise<void>;
  idioma: Idioma;
}) {
  const t = enIdioma(T, idioma);
  const [p, setP] = useState<PoliticaPlazoPapeles>(politica);
  const [estado, setEstado] = useState<{ ok?: string; error?: string }>({});
  const tablero = useTablero();
  const suyos = (tablero?.acierto ?? []).filter((f) => f.pais === pais);
  const conOpinion = suyos.reduce((n, f) => n + f.conOpinion, 0);
  const aciertos = suyos.reduce((n, f) => n + f.aciertos, 0);
  const conValor = <V extends string>(lista: V[], valor: V, si: boolean) =>
    si ? [...new Set([...lista, valor])] : lista.filter((x) => x !== valor);
  // Los exentos que el país ya tenga y no estén en la lista conocida se conservan y se enseñan.
  const exentos = [...new Set([...EXENTOS_CONOCIDOS, ...p.exentos])];
  async function enviar() {
    setEstado({});
    try {
      await guardar({
        ...p,
        dias: Math.max(0, Math.min(PLAZO_DIAS_MAXIMO, Math.round(p.dias) || 0)),
      });
      setEstado({ ok: t.guardado });
    } catch (x) {
      setEstado({ error: mensaje(x) });
    }
  }
  return (
    <fieldset className="papeles-politica" data-testid="politica-papeles">
      <legend>{t.politica}</legend>
      <p className="suave">{t.politicaAyuda}</p>
      <label className="campo campo-num">
        <span>{t.dias}</span>
        <input
          inputMode="numeric"
          value={String(p.dias)}
          onChange={(e) =>
            setP({ ...p, dias: Number(e.target.value.replace(/\D/g, '').slice(0, 2) || '0') })
          }
          aria-label={t.dias}
          data-testid="politica-dias"
        />
      </label>
      {p.dias > 0 ? <p className="papeles-dudas">{t.riesgo}</p> : null}
      <p className="papeles-grupo">{t.paraEmpezar}</p>
      {PAPELES_PARA_EMPEZAR.map((x) => (
        <label key={x} className="casilla">
          <input
            type="checkbox"
            checked={p.paraEmpezar.includes(x)}
            onChange={(e) =>
              setP({ ...p, paraEmpezar: conValor(p.paraEmpezar, x, e.target.checked) })
            }
          />{' '}
          {de(t.papelesEmpezar, x)}
        </label>
      ))}
      <p className="papeles-grupo">{t.exentos}</p>
      {exentos.map((x) => (
        <label key={x} className="casilla">
          <input
            type="checkbox"
            checked={p.exentos.includes(x)}
            onChange={(e) => setP({ ...p, exentos: conValor(p.exentos, x, e.target.checked) })}
          />{' '}
          {de(t.exentosNombres, x)}
        </label>
      ))}
      <label className="casilla papeles-grupo">
        <input
          type="checkbox"
          checked={p.asistente}
          onChange={(e) => setP({ ...p, asistente: e.target.checked })}
        />{' '}
        {t.asistente}
      </label>
      <label className="casilla">
        <input
          type="checkbox"
          checked={p.aprobacionAutomatica}
          onChange={(e) => setP({ ...p, aprobacionAutomatica: e.target.checked })}
          data-testid="politica-automatica"
        />{' '}
        <strong>{t.automatica}</strong>
      </label>
      <p className="suave">{t.automaticaAyuda}</p>
      <p data-testid="politica-acierto">
        <strong>{t.acierto}:</strong>{' '}
        {conOpinion > 0
          ? t.casos(Math.round((aciertos * 100) / conOpinion), conOpinion)
          : t.sinCasos}
      </p>
      <button type="button" className="boton secundario" onClick={() => void enviar()}>
        {t.guardarPolitica}
      </button>
      {estado.ok ? <p className="exito-general">{estado.ok}</p> : null}
      {estado.error ? (
        <p className="error-general" role="alert">
          {estado.error}
        </p>
      ) : null}
    </fieldset>
  );
}
