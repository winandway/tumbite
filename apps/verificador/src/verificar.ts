import type { DatosDocumento } from './aamva';
import { leerAamva } from './aamva';
import { buscarParecidas, compararHuellas, decidirVida, leerCara } from './caras';
import { leerCodigoDeFoto } from './codigoBarras';
import { cruzarConFrente, datosDelFrente, revisarDocumento } from './documento';
import { leerFrente, leerMrzDeFoto } from './ocr';

/**
 * La verificación completa en un solo paso, como el motor de Idswyft: documento, cruce con el frente,
 * persona viva, cara contra el documento y caras repetidas. Devuelve la decisión al instante:
 * - verificado: todo cuadra;
 * - revision: algo queda en duda y lo mira el equipo, con el motivo escrito;
 * - repetir: la persona tiene que volver a tomar las fotos (ilegible, vencido, cara distinta, sin giro).
 */
export type Motivo =
  | 'documento_ilegible'
  | 'documento_sin_codigo'
  | 'vencido'
  | 'menor_de_edad'
  | 'frente_no_coincide'
  | 'sin_cara_en_selfie'
  | 'sin_cara_en_documento'
  | 'cara_distinta'
  | 'sin_prueba_de_vida'
  | 'otra_persona_en_las_tomas'
  | 'cara_parecida_a_cuenta_cerrada';

export type Entrada = {
  docTipo: 'licencia' | 'pasaporte' | 'identificacion';
  frente: Buffer;
  reverso?: Buffer;
  selfie: Buffer;
  /** Las dos tomas girando la cabeza (a un lado y al otro). */
  giros?: [Buffer, Buffer];
  edadMinima?: number;
  /** Huellas de cuentas cerradas por mala conducta. */
  malaConducta?: { id: string; huella: number[] }[];
  hoy?: Date;
};

export type Decision = 'verificado' | 'revision' | 'repetir';

export type Resultado = {
  decision: Decision;
  motivos: Motivo[];
  datos: DatosDocumento | null;
  /** Huella de la cara de la selfie, para guardarla y compararla en el futuro. */
  huella: number[] | null;
  similitud: number | null;
  parecidas: { id: string; similitud: number }[];
};

/** Lo que obliga a repetir las fotos; el resto de los motivos va a revisión del equipo. */
const REPETIR: ReadonlySet<Motivo> = new Set<Motivo>([
  'documento_ilegible',
  'vencido',
  'sin_cara_en_selfie',
  'sin_cara_en_documento',
  'cara_distinta',
  'sin_prueba_de_vida',
  'otra_persona_en_las_tomas',
]);

export function decidir(motivos: Motivo[]): Decision {
  if (!motivos.length) return 'verificado';
  return motivos.some((m) => REPETIR.has(m)) ? 'repetir' : 'revision';
}

async function leerDocumento(e: Entrada): Promise<DatosDocumento | 'ilegible' | 'sin_codigo'> {
  if (e.docTipo === 'pasaporte') {
    const r = await leerMrzDeFoto(e.frente, e.hoy);
    return r?.controlesOk ? r.datos : 'ilegible';
  }
  if (e.docTipo === 'licencia') {
    const texto = e.reverso ? await leerCodigoDeFoto(e.reverso) : null;
    const datos = texto ? leerAamva(texto) : null;
    return datos ?? 'ilegible';
  }
  // Las cédulas de otros países no traen un código estándar: las mira el equipo.
  return 'sin_codigo';
}

export async function verificar(e: Entrada): Promise<Resultado> {
  const hoy = e.hoy ?? new Date();
  const motivos: Motivo[] = [];
  const doc = await leerDocumento(e);
  const datos = typeof doc === 'string' ? null : doc;
  if (doc === 'ilegible') motivos.push('documento_ilegible');
  if (doc === 'sin_codigo') motivos.push('documento_sin_codigo');
  if (datos) {
    const rev = revisarDocumento(datos, hoy, e.edadMinima ?? 18);
    if (rev.problemas.includes('fecha_ilegible')) motivos.push('documento_ilegible');
    if (rev.problemas.includes('vencido')) motivos.push('vencido');
    if (rev.problemas.includes('menor_de_edad')) motivos.push('menor_de_edad');
    // La licencia se cruza con su frente; en el pasaporte la franja y la foto están en la misma página.
    if (datos.tipo === 'licencia_eeuu') {
      const cruce = cruzarConFrente(datos, datosDelFrente(datos, await leerFrente(e.frente)));
      if (!cruce.coincide) motivos.push('frente_no_coincide');
    }
  }

  const caraSelfie = await leerCara(e.selfie);
  const caraDocumento = await leerCara(e.frente);
  let similitud: number | null = null;
  if (!caraSelfie) motivos.push('sin_cara_en_selfie');
  if (!caraDocumento) motivos.push('sin_cara_en_documento');
  if (caraSelfie && caraDocumento) {
    const c = compararHuellas(caraSelfie.huella, caraDocumento.huella);
    similitud = c.similitud;
    if (!c.coincide) motivos.push('cara_distinta');
  }

  if (!e.giros) motivos.push('sin_prueba_de_vida');
  else if (caraSelfie) {
    const vida = decidirVida([caraSelfie, await leerCara(e.giros[0]), await leerCara(e.giros[1])]);
    if (!vida.viva)
      motivos.push(
        vida.motivo === 'otra_persona' ? 'otra_persona_en_las_tomas' : 'sin_prueba_de_vida',
      );
  }

  const parecidas = caraSelfie ? buscarParecidas(caraSelfie.huella, e.malaConducta ?? []) : [];
  if (parecidas.length) motivos.push('cara_parecida_a_cuenta_cerrada');

  const unicos = [...new Set(motivos)];
  return {
    decision: decidir(unicos),
    motivos: unicos,
    datos,
    huella: caraSelfie?.huella ?? null,
    similitud,
    parecidas: parecidas.map(({ id, similitud: s }) => ({ id, similitud: s })),
  };
}
