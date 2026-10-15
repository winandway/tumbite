/**
 * Fase 2 · Comunicación HTTPS autenticada entre YaDominios Cloud (el servidor) y los Workers
 * externos de Cloudflare (reloj y tiempo real). docs/ARQUITECTURA-MULTISERVICIO-V1.2.md §4.1.
 *
 * Firma HMAC-SHA256 sobre «MÉTODO \n RUTA \n TIEMPO \n NONCE \n SHA256(cuerpo)». Una llave por
 * dirección. Cada lado acepta la llave actual y la anterior (rotación sin cortar el servicio).
 * El NONCE se acepta una sola vez: eso lo guarda quien recibe (en el servidor, la tabla
 * peticiones_internas; en el Durable Object, su propio almacén).
 *
 * Solo usa WebCrypto: corre igual en el servidor, en el Worker externo y en las pruebas.
 */

export const CABECERAS_FIRMA = {
  llave: 'x-tumbite-llave',
  tiempo: 'x-tumbite-tiempo',
  nonce: 'x-tumbite-nonce',
  firma: 'x-tumbite-firma',
} as const;

/** Diferencia máxima de reloj aceptada entre quien firma y quien recibe. */
export const VENTANA_FIRMA_S = 60;

const texto = new TextEncoder();

function hex(b: ArrayBuffer): string {
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(datos: string | Uint8Array<ArrayBuffer>): Promise<string> {
  const bytes = typeof datos === 'string' ? texto.encode(datos) : datos;
  return hex(await crypto.subtle.digest('SHA-256', bytes));
}

async function hmacHex(secreto: string, mensaje: string): Promise<string> {
  const llave = await crypto.subtle.importKey(
    'raw',
    texto.encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return hex(await crypto.subtle.sign('HMAC', llave, texto.encode(mensaje)));
}

/** Compara en tiempo constante (sobre los resúmenes, que miden lo mismo). */
export async function igualesConstante(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
  let dif = a.length === b.length ? 0 : 1;
  for (let i = 0; i < ha.length; i++) dif |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return dif === 0;
}

export function nuevoNonce(): string {
  const b = new Uint8Array(18);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

const lineaCanonica = (
  metodo: string,
  ruta: string,
  tiempo: string,
  nonce: string,
  cuerpoHash: string,
) => [metodo.toUpperCase(), ruta, tiempo, nonce, cuerpoHash].join('\n');

export type LlaveFirma = { id: string; secreto: string };

/** Cabeceras firmadas para una petición. `ruta` es solo el camino (sin dominio ni consulta). */
export async function firmarPeticion(
  llave: LlaveFirma,
  metodo: string,
  ruta: string,
  cuerpo: string,
  ahoraS = Math.floor(Date.now() / 1000),
  nonce = nuevoNonce(),
): Promise<Record<string, string>> {
  const tiempo = String(ahoraS);
  const firma = await hmacHex(
    llave.secreto,
    lineaCanonica(metodo, ruta, tiempo, nonce, await sha256Hex(cuerpo)),
  );
  return {
    [CABECERAS_FIRMA.llave]: llave.id,
    [CABECERAS_FIRMA.tiempo]: tiempo,
    [CABECERAS_FIRMA.nonce]: nonce,
    [CABECERAS_FIRMA.firma]: firma,
  };
}

export type ResultadoFirma =
  | { ok: true; llaveId: string; nonce: string }
  | {
      ok: false;
      motivo:
        | 'faltan_cabeceras'
        | 'llave_desconocida'
        | 'fuera_de_tiempo'
        | 'nonce_invalido'
        | 'firma_invalida';
    };

/**
 * Verifica la firma (sin el control de repetición, que depende del almacén de quien recibe).
 * `llaves`: la actual y, si existe, la anterior. Una llave vacía nunca vale.
 */
export async function verificarFirma(
  llaves: (LlaveFirma | null | undefined)[],
  metodo: string,
  ruta: string,
  cuerpo: string,
  leer: (cabecera: string) => string | null | undefined,
  ahoraS = Math.floor(Date.now() / 1000),
): Promise<ResultadoFirma> {
  const llaveId = leer(CABECERAS_FIRMA.llave) ?? '';
  const tiempo = leer(CABECERAS_FIRMA.tiempo) ?? '';
  const nonce = leer(CABECERAS_FIRMA.nonce) ?? '';
  const firma = leer(CABECERAS_FIRMA.firma) ?? '';
  if (!llaveId || !tiempo || !nonce || !firma) return { ok: false, motivo: 'faltan_cabeceras' };
  const validas = llaves.filter((l): l is LlaveFirma =>
    Boolean(l?.id && l.secreto && l.secreto.length >= 32),
  );
  const candidatas = validas.filter((l) => l.id === llaveId);
  if (!candidatas.length) return { ok: false, motivo: 'llave_desconocida' };
  const t = Number(tiempo);
  if (!/^\d{1,12}$/.test(tiempo) || Math.abs(ahoraS - t) > VENTANA_FIRMA_S)
    return { ok: false, motivo: 'fuera_de_tiempo' };
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(nonce)) return { ok: false, motivo: 'nonce_invalido' };
  const linea = lineaCanonica(metodo, ruta, tiempo, nonce, await sha256Hex(cuerpo));
  for (const l of candidatas)
    if (await igualesConstante(await hmacHex(l.secreto, linea), firma))
      return { ok: true, llaveId, nonce };
  return { ok: false, motivo: 'firma_invalida' };
}

// ------------------------------------------------------------------ pases cortos (WebSocket)

/**
 * Pase corto para el tiempo real (15 minutos). Lo emite el servidor con sesión; el Worker lo
 * verifica SIN llamar al servidor. Dice quién es, qué rol tiene, en qué zona está y, si sigue un
 * pedido, cuál y a qué repartidor. Formato: base64url(JSON) + "." + base64url(HMAC).
 */
export type PaseTiempoReal = {
  /** id de la llave con que se firmó (rotación) */
  k: string;
  /** usuario */
  u: string;
  rol: 'repartidor' | 'cliente';
  zona: string;
  /** pedido que sigue (solo cliente) */
  p?: string;
  /** repartidor de ese pedido (solo cliente) */
  r?: string;
  /** vence (segundos Unix) */
  exp: number;
  /** id único del pase */
  jti: string;
};

export const DURACION_PASE_S = 15 * 60;

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function desdeB64url(s: string): Uint8Array {
  const base = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(base + '='.repeat((4 - (base.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function emitirPase(
  llave: LlaveFirma,
  datos: Omit<PaseTiempoReal, 'k' | 'exp' | 'jti'>,
  ahoraS = Math.floor(Date.now() / 1000),
): Promise<{ pase: string; vence: number }> {
  const contenido: PaseTiempoReal = {
    ...datos,
    k: llave.id,
    exp: ahoraS + DURACION_PASE_S,
    jti: nuevoNonce(),
  };
  const cuerpo = b64url(texto.encode(JSON.stringify(contenido)));
  const firma = await hmacHex(llave.secreto, `pase.${cuerpo}`);
  return {
    pase: `${cuerpo}.${b64url(Uint8Array.from(firma.match(/../g) ?? [], (h) => parseInt(h, 16)))}`,
    vence: contenido.exp,
  };
}

export async function verificarPase(
  llaves: (LlaveFirma | null | undefined)[],
  pase: string,
  ahoraS = Math.floor(Date.now() / 1000),
): Promise<PaseTiempoReal | null> {
  if (pase.length > 2048) return null;
  const [cuerpo, firma, sobra] = pase.split('.');
  if (!cuerpo || !firma || sobra !== undefined) return null;
  let datos: PaseTiempoReal;
  try {
    datos = JSON.parse(new TextDecoder().decode(desdeB64url(cuerpo))) as PaseTiempoReal;
  } catch {
    return null;
  }
  if (!datos || typeof datos !== 'object' || typeof datos.k !== 'string') return null;
  const llave = llaves.find((l) => l?.id === datos.k && l.secreto.length >= 32);
  if (!llave) return null;
  const esperada = await hmacHex(llave.secreto, `pase.${cuerpo}`);
  let dada: string;
  try {
    dada = [...desdeB64url(firma)].map((x) => x.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
  if (!(await igualesConstante(esperada, dada))) return null;
  if (typeof datos.exp !== 'number' || datos.exp <= ahoraS) return null;
  if (datos.rol !== 'repartidor' && datos.rol !== 'cliente') return null;
  if (typeof datos.u !== 'string' || typeof datos.zona !== 'string') return null;
  if (datos.rol === 'cliente' && (typeof datos.p !== 'string' || !datos.p)) return null;
  return datos;
}
