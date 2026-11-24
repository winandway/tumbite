import { useEffect } from 'react';
import { type Idioma, enIdioma } from '@tumbite/compartido';
import { Insignia } from './diseno/Insignia';

/**
 * C-VERIFICACIONES-BANDEJA (22 nov 2026, Gerencia) — todos los países. Las piezas que comparten la
 * bandeja de Verificaciones y la ficha de una persona: los textos, las insignias de la comprobación
 * automática de cada foto, la foto en grande y el enlace a la ficha completa.
 */
export const T_VERIFICACIONES = {
  es: {
    titulo: 'Verificaciones',
    detalle:
      'La comprobación automática de cada foto solo adelanta trabajo: siempre decide una persona.',
    configuracion: 'Configuración',
    pendientes: 'Pendientes',
    aprobadas: 'Aprobadas',
    rechazadas: 'Rechazadas',
    sinEnviar: 'Sin enviar',
    sinEnviarDetalle:
      'Se registraron y todavía no mandan sus fotos. Aquí no hay nada que aprobar: sirve para saber quién se quedó a medias.',
    registro: (h: number) =>
      h < 1
        ? 'Se registró hace menos de 1 h'
        : h < 24
          ? `Se registró hace ${h} h`
          : Math.floor(h / 24) === 1
            ? 'Se registró hace 1 día'
            : `Se registró hace ${Math.floor(h / 24)} días`,
    sinFotos: 'No ha enviado sus fotos',
    fotosSinEnviar: (n: number) =>
      n === 1 ? 'Subió 1 foto y no la ha enviado' : `Subió ${n} fotos y no las ha enviado`,
    // C-LLEGA-SOLO-A-REVISION: lo que le falta para que su identidad llegue sola a revisión.
    falta: {
      doc_frente: 'Falta el documento por delante',
      doc_reverso: 'Falta el documento por detrás',
      cara: 'Falta la foto de la cara',
      consentimiento: 'Falta aceptar el consentimiento',
      local: 'Falta la foto del local',
    } as Record<string, string>,
    correoSinConfirmar: 'Correo sin confirmar',
    buscar: 'Nombre, ID, correo, teléfono o zona',
    zona: 'Zona',
    todasZonas: 'Todas las zonas',
    vacio: {
      pendiente: 'No hay verificaciones pendientes.',
      aprobado: 'No hay verificaciones aprobadas.',
      rechazado: 'No hay verificaciones rechazadas.',
      sin_enviar: 'Nadie se quedó sin enviar sus fotos.',
    } as Record<string, string>,
    sinResultados: 'Nada coincide con esa búsqueda en esta pestaña.',
    enOtra: (n: number, pestana: string) =>
      n === 1 ? `Hay 1 en ${pestana}.` : `Hay ${n} en ${pestana}.`,
    verEn: (pestana: string) => `Ver ${pestana}`,
    resultados: (n: number, mas: boolean) =>
      `${n}${mas ? '+' : ''} ${n === 1 ? 'persona' : 'personas'}`,
    cargando: 'Cargando…',
    error: 'No pudimos cargar las verificaciones. Revisa tu conexión.',
    reintentar: 'Reintentar',
    verMas: 'Ver más',
    // C-VERIFICACION-UNICA: un pendiente por conductor, lo que espera de él y aprobar en verde.
    porDecidir: 'Por decidir',
    decidir: { identidad: 'Identidad', vehiculo: 'Vehículo', papeles: 'Papeles' } as Record<
      string,
      string
    >,
    orden: 'Orden',
    ordenLlegada: 'Por llegada',
    ordenCerca: 'Más cerca de activarse',
    elegir: (n: string) => `Elegir a ${n} para aprobar en verde`,
    enVerde: 'En verde',
    aprobarVerdes: (n: number) =>
      n === 1 ? 'Aprobar 1 identidad en verde' : `Aprobar ${n} identidades en verde`,
    aprobarVerdesAyuda:
      'Solo se pueden elegir las identidades con todas sus comprobaciones en verde y nada más por decidir. Un vehículo o un papel se revisan en la ficha de la persona.',
    confirmarVerdes: (n: number) =>
      n === 1
        ? '¿Aprobar la identidad de 1 conductor? Miraste sus fotos y decides tú.'
        : `¿Aprobar la identidad de ${n} conductores? Miraste sus fotos y decides tú.`,
    verdesHechas: (n: number) =>
      n === 1 ? 'Aprobaste 1 identidad.' : `Aprobaste ${n} identidades.`,
    verdesFallo: (n: number, e: string) => `Aprobaste ${n}; la siguiente no se pudo: ${e}`,
    revisar: 'Revisar',
    ficha: 'Ficha completa',
    verFoto: (n: string) => `Ver la foto de ${n} en grande`,
    sinFoto: 'Sin foto',
    cerrar: 'Cerrar',
    repartidor: 'Conductor',
    restaurante: 'Restaurante',
    sinZona: 'Sin zona',
    lejos: 'El local está lejos de su dirección',
    espera: (h: number) =>
      h < 1
        ? 'Llegó hace menos de 1 h'
        : h < 48
          ? `Espera hace ${h} h`
          : `Espera hace ${Math.floor(h / 24)} días`,
    aprobadaEl: (f: string) => `Aprobada · ${f}`,
    rechazadaEl: (f: string) => `Rechazada · ${f}`,
    motivoRechazo: 'Motivo',
    piezas: {
      doc_frente: 'Documento (frente)',
      doc_reverso: 'Documento (reverso)',
      selfie: 'Cara',
      local: 'Local',
    } as Record<string, string>,
    motivos: {
      cuadra: 'todo cuadra',
      otra_clase: 'parece otra cosa',
      vencido: 'parece vencido',
      ilegible: 'no se lee bien',
      foto_de_foto: 'parece foto de una pantalla o de otra foto',
      confianza_baja: 'poca confianza, míralo',
      repetir: 'se le pidió repetirla',
      a_mano: 'a mano',
      cerca: 'en su dirección',
      lejos: 'lejos de su dirección',
    } as Record<string, string>,
    clases: {
      identidad_frente: 'el frente de un documento',
      identidad_reverso: 'el reverso de un documento',
      licencia_frente: 'el frente de una licencia',
      licencia_reverso: 'el reverso de una licencia',
      seguro: 'un seguro',
      cara: 'una cara',
      otra_cosa: 'otra cosa',
    } as Record<string, string>,
    cara: 'Cara y documento',
    caras: {
      misma: 'misma persona',
      dudoso: 'dudoso',
      distinta: 'no parece la misma persona',
      sin_ia: 'sin comparar',
    } as Record<string, string>,
    comprobacion: 'Comprobación automática',
  },
  en: {
    titulo: 'Verifications',
    detalle: 'The automatic check of each photo only saves work: a person always decides.',
    configuracion: 'Settings',
    pendientes: 'Pending',
    aprobadas: 'Approved',
    rechazadas: 'Rejected',
    sinEnviar: 'Not submitted',
    sinEnviarDetalle:
      'They signed up and haven’t sent their photos yet. There’s nothing to approve here: it shows who stopped halfway.',
    registro: (h: number) =>
      h < 1
        ? 'Signed up less than 1 h ago'
        : h < 24
          ? `Signed up ${h} h ago`
          : Math.floor(h / 24) === 1
            ? 'Signed up 1 day ago'
            : `Signed up ${Math.floor(h / 24)} days ago`,
    sinFotos: 'Hasn’t sent their photos',
    fotosSinEnviar: (n: number) =>
      n === 1
        ? 'Uploaded 1 photo but hasn’t submitted it'
        : `Uploaded ${n} photos but hasn’t submitted them`,
    falta: {
      doc_frente: 'Missing the front of the ID',
      doc_reverso: 'Missing the back of the ID',
      cara: 'Missing the face photo',
      consentimiento: 'Missing the consent',
      local: 'Missing the storefront photo',
    } as Record<string, string>,
    correoSinConfirmar: 'Email not confirmed',
    buscar: 'Name, ID, email, phone or area',
    zona: 'Area',
    todasZonas: 'All areas',
    vacio: {
      pendiente: 'No pending verifications.',
      aprobado: 'No approved verifications.',
      rechazado: 'No rejected verifications.',
      sin_enviar: 'No one is missing their photos.',
    } as Record<string, string>,
    sinResultados: 'Nothing in this tab matches that search.',
    enOtra: (n: number, pestana: string) => `${n} in ${pestana}.`,
    verEn: (pestana: string) => `See ${pestana}`,
    resultados: (n: number, mas: boolean) =>
      `${n}${mas ? '+' : ''} ${n === 1 ? 'person' : 'people'}`,
    cargando: 'Loading…',
    error: 'We couldn’t load the verifications. Check your connection.',
    reintentar: 'Try again',
    verMas: 'Show more',
    porDecidir: 'To decide',
    decidir: { identidad: 'Identity', vehiculo: 'Vehicle', papeles: 'Documents' } as Record<
      string,
      string
    >,
    orden: 'Order',
    ordenLlegada: 'By arrival',
    ordenCerca: 'Closest to activation',
    elegir: (n: string) => `Select ${n} to approve in green`,
    enVerde: 'In green',
    aprobarVerdes: (n: number) =>
      n === 1 ? 'Approve 1 identity in green' : `Approve ${n} identities in green`,
    aprobarVerdesAyuda:
      'You can only select identities with every check in green and nothing else to decide. A vehicle or a document is reviewed in the person’s file.',
    confirmarVerdes: (n: number) =>
      n === 1
        ? 'Approve the identity of 1 driver? You looked at their photos and you decide.'
        : `Approve the identity of ${n} drivers? You looked at their photos and you decide.`,
    verdesHechas: (n: number) =>
      n === 1 ? 'You approved 1 identity.' : `You approved ${n} identities.`,
    verdesFallo: (n: number, e: string) => `You approved ${n}; the next one failed: ${e}`,
    revisar: 'Review',
    ficha: 'Full profile',
    verFoto: (n: string) => `See ${n}’s photo full size`,
    sinFoto: 'No photo',
    cerrar: 'Close',
    repartidor: 'Driver',
    restaurante: 'Restaurant',
    sinZona: 'No area',
    lejos: 'The storefront is far from its address',
    espera: (h: number) =>
      h < 1
        ? 'Arrived less than 1 h ago'
        : h < 48
          ? `Waiting ${h} h`
          : `Waiting ${Math.floor(h / 24)} days`,
    aprobadaEl: (f: string) => `Approved · ${f}`,
    rechazadaEl: (f: string) => `Rejected · ${f}`,
    motivoRechazo: 'Reason',
    piezas: {
      doc_frente: 'ID (front)',
      doc_reverso: 'ID (back)',
      selfie: 'Face',
      local: 'Storefront',
    } as Record<string, string>,
    motivos: {
      cuadra: 'all good',
      otra_clase: 'looks like something else',
      vencido: 'looks expired',
      ilegible: 'hard to read',
      foto_de_foto: 'looks like a photo of a screen or another photo',
      confianza_baja: 'low confidence, check it',
      repetir: 'asked to retake',
      a_mano: 'by hand',
      cerca: 'at its address',
      lejos: 'far from its address',
    } as Record<string, string>,
    clases: {
      identidad_frente: 'the front of an ID',
      identidad_reverso: 'the back of an ID',
      licencia_frente: 'the front of a license',
      licencia_reverso: 'the back of a license',
      seguro: 'an insurance card',
      cara: 'a face',
      otra_cosa: 'something else',
    } as Record<string, string>,
    cara: 'Face and ID',
    caras: {
      misma: 'same person',
      dudoso: 'unsure',
      distinta: 'doesn’t look like the same person',
      sin_ia: 'not compared',
    } as Record<string, string>,
    comprobacion: 'Automatic check',
  },
};

/** Un texto de una tabla por su clave (sin acceso dinámico a objetos). */
export const deTabla = (tabla: Record<string, string>, clave: string, porDefecto = clave) =>
  new Map(Object.entries(tabla)).get(clave) ?? porDefecto;

export type Comprobacion = {
  pieza: string;
  tono: 'hecho' | 'pendiente' | 'apagado';
  motivo: string;
  clase?: string;
};
export type ResumenCara = { resultado: string; tono: 'hecho' | 'pendiente' | 'apagado' } | null;

/** El texto de la comprobación de una foto: «Documento (frente): todo cuadra». */
export function textoComprobacion(c: Comprobacion, idioma: Idioma): string {
  const t = enIdioma(T_VERIFICACIONES, idioma);
  const pieza = t.piezas[c.pieza] ?? c.pieza;
  const motivo = t.motivos[c.motivo] ?? c.motivo;
  const clase = c.motivo === 'otra_clase' && c.clase ? ` (${t.clases[c.clase] ?? c.clase})` : '';
  return `${pieza}: ${motivo}${clase}`;
}

/** Las insignias de la comprobación automática de cada foto (y de la cara contra el documento). */
export function InsigniasComprobacion({
  comprobaciones,
  cara,
  idioma,
}: {
  comprobaciones: Comprobacion[];
  cara: ResumenCara;
  idioma: Idioma;
}) {
  const t = enIdioma(T_VERIFICACIONES, idioma);
  if (!comprobaciones.length && !cara) return null;
  return (
    <ul className="kyc-comprobaciones" aria-label={t.comprobacion}>
      {comprobaciones.map((c) => (
        <li key={c.pieza}>
          <Insignia tono={c.tono} testId={`comprobacion-${c.pieza}`}>
            {textoComprobacion(c, idioma)}
          </Insignia>
        </li>
      ))}
      {cara ? (
        <li>
          <Insignia tono={cara.tono} testId="comprobacion-cara">
            {t.cara}: {t.caras[cara.resultado] ?? cara.resultado}
          </Insignia>
        </li>
      ) : null}
    </ul>
  );
}

/** La foto en grande, en una capa que se cierra con Escape o tocando fuera. */
export function FotoGrande({
  foto,
  cerrar,
  idioma,
}: {
  foto: { src: string; titulo: string } | null;
  cerrar: () => void;
  idioma: Idioma;
}) {
  const t = enIdioma(T_VERIFICACIONES, idioma);
  useEffect(() => {
    if (!foto) return;
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
    };
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [foto, cerrar]);
  if (!foto) return null;
  return (
    <div
      className="foto-grande"
      role="dialog"
      aria-modal="true"
      aria-label={foto.titulo}
      data-testid="foto-grande"
      onClick={cerrar}
    >
      <div className="foto-grande-barra">
        <strong>{foto.titulo}</strong>
        <button type="button" className="boton secundario chico" onClick={cerrar}>
          {t.cerrar}
        </button>
      </div>
      <img src={foto.src} alt={foto.titulo} onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

/** El enlace a la ficha completa de la persona (correo, teléfono, vehículo, papeles). */
export function enlaceFicha(
  base: string,
  p: { id: string; rol: string; restauranteId?: string | null },
): string | null {
  if (p.rol === 'repartidor') return `${base}/drivers/${p.id}`;
  if (p.rol === 'restaurante')
    return p.restauranteId ? `${base}/restaurants/${p.restauranteId}` : null;
  if (p.rol === 'cliente') return `${base}/customers/${p.id}`;
  return null;
}
