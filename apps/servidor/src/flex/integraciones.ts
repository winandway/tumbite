import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { type Variables, base } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { actorDeEmpresa, exigirPermiso, nuevoIdFlex, sentenciaAuditoria } from './autorizacion';

/**
 * Divoox Flex · Fase 3: integraciones salientes (C-FLEX-INTEGRACIONES).
 *
 * La empresa registra una dirección HTTPS de SU sistema y elige qué eventos quiere. Divoox le manda
 * cada evento firmado (HMAC-SHA256 con marca de tiempo e id único), con reintentos y espera
 * creciente, registro de cada intento y desactivación automática si su sistema no responde.
 *
 * Seguridad:
 * - Anti-SSRF: solo HTTPS en el puerto 443, sin IP escritas, sin nombres internos; el nombre se
 *   resuelve por DNS sobre HTTPS y se rechaza si apunta a una red privada o reservada; las
 *   redirecciones no se siguen (cuentan como fallo). Se comprueba al registrar y antes de cada envío.
 * - El secreto se muestra UNA vez; se guarda cifrado (AES-GCM) y nunca vuelve a salir. Al rotarlo,
 *   el anterior sigue firmando durante el periodo de gracia (dos firmas en la cabecera).
 * - Cada empresa ve y recibe SOLO lo suyo. El cuerpo de la respuesta del receptor no se guarda.
 */

export const EVENTOS_INTEGRACION = [
  'package.created',
  'package.assigned',
  'package.loaded',
  'package.in_transit',
  'package.delivered',
  'package.failed',
  'package.returned',
  'route.assigned',
  'route.accepted',
  'route.started',
  'route.completed',
  'delivery.exception',
] as const;

/** Espera antes de cada reintento (minutos). 8 intentos en total, durante unas 22 horas. */
export const ESPERAS_MIN = [1, 5, 15, 60, 180, 360, 720] as const;
export const MAX_INTENTOS = ESPERAS_MIN.length + 1;
/** Fallos seguidos que desactivan el destino. */
export const FALLOS_PARA_DESACTIVAR = 15;
export const MAX_DESTINOS_EMPRESA = 10;
const TIEMPO_ESPERA_MS = 8_000;
export const CABECERA_FIRMA = 'Divoox-Signature';

// ───────────────────────────── Transporte y DNS (inyectables en pruebas) ─────────────────────────────

type Transporte = (url: string, init: RequestInit) => Promise<Response>;
let transporte: Transporte = (url, init) => fetch(url, init);
export function usarTransporteWebhooks(t: Transporte | null) {
  transporte = t ?? ((url, init) => fetch(url, init));
}

/** Devuelve las IP (v4 y v6) de un nombre. Por defecto, DNS sobre HTTPS de Cloudflare. */
type Resolver = (nombre: string) => Promise<string[]>;
async function resolverDoH(nombre: string): Promise<string[]> {
  const ips: string[] = [];
  for (const tipo of ['A', 'AAAA']) {
    const r = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(nombre)}&type=${tipo}`,
      { headers: { accept: 'application/dns-json' } },
    );
    if (!r.ok) throw new Error(`dns ${r.status}`);
    const j = (await r.json()) as { Answer?: { type: number; data: string }[] };
    for (const a of j.Answer ?? []) if (a.type === 1 || a.type === 28) ips.push(a.data);
  }
  return ips;
}
let resolver: Resolver = resolverDoH;
export function usarResolverDns(r: Resolver | null) {
  resolver = r ?? resolverDoH;
}

// ───────────────────────────── Anti-SSRF ─────────────────────────────

function ipv4Privada(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return true;
  const [a = 0, b = 0, c = 0] = p;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

/** ¿La IP es de una red privada, local, reservada o de documentación? (v4 y v6). */
export function ipPrivada(ip: string): boolean {
  const s = ip
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(s)) return ipv4Privada(s);
  if (!s.includes(':')) return true; // no es una IP que entendamos: se bloquea
  // IPv4 dentro de IPv6 (::ffff:a.b.c.d, 64:ff9b::a.b.c.d).
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(s)?.[1];
  if (v4) return ipv4Privada(v4) || !/^(::ffff:|64:ff9b::)/.test(s);
  if (s === '::' || s === '::1') return true;
  const primero = parseInt(s.split(':')[0] || '0', 16);
  if ((primero & 0xfe00) === 0xfc00) return true; // fc00::/7 privadas
  if ((primero & 0xffc0) === 0xfe80) return true; // fe80::/10 enlace local
  if ((primero & 0xff00) === 0xff00) return true; // ff00::/8 multidifusión
  if (s.startsWith('2001:db8') || s.startsWith('2001:0db8')) return true; // documentación
  if (s.startsWith('100::') || s.startsWith('64:ff9b:')) return true;
  if (primero === 0) return true; // ::/8 reservado
  return false;
}

const SUFIJOS_INTERNOS = [
  '.local',
  '.localhost',
  '.internal',
  '.intranet',
  '.lan',
  '.home',
  '.corp',
  '.private',
  '.localdomain',
  '.arpa',
  '.test',
  '.invalid',
  '.example',
];

/** Comprobación de forma (sin red). Devuelve la URL normalizada o lanza el motivo. */
export function revisarFormaDestino(texto: string): URL {
  let u: URL;
  try {
    u = new URL(texto.trim());
  } catch {
    throw new ErrorDatos('Esa dirección no es válida.', 'url');
  }
  if (u.protocol !== 'https:')
    throw new ErrorDatos('La dirección tiene que empezar con https://.', 'url');
  if (u.username || u.password)
    throw new ErrorDatos('La dirección no puede llevar usuario ni contraseña.', 'url');
  if (u.port && u.port !== '443')
    throw new ErrorDatos('Solo se admite el puerto 443 de HTTPS.', 'url');
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith('[') || host.includes(':'))
    throw new ErrorDatos('Usa un nombre de dominio, no una dirección IP.', 'url');
  if (
    !host.includes('.') ||
    host === 'localhost' ||
    SUFIJOS_INTERNOS.some((x) => host.endsWith(x)) ||
    host.endsWith('.divoox.com') ||
    host.endsWith('.tumbite.com') ||
    host === 'divoox.com' ||
    host === 'tumbite.com'
  )
    throw new ErrorDatos('Esa dirección apunta a una red interna o no permitida.', 'url');
  if (u.href.length > 500) throw new ErrorDatos('La dirección es demasiado larga.', 'url');
  u.hash = '';
  return u;
}

/** Forma + DNS: todas las IP del nombre tienen que ser públicas. */
export async function revisarDestino(texto: string): Promise<URL> {
  const u = revisarFormaDestino(texto);
  let ips: string[];
  try {
    ips = await resolver(u.hostname);
  } catch {
    throw new ErrorDatos(
      'No pudimos comprobar esa dirección (DNS). Intenta de nuevo en un momento.',
      'url',
      503,
    );
  }
  if (!ips.length) throw new ErrorDatos('Ese dominio no existe o no tiene dirección.', 'url');
  if (ips.some(ipPrivada))
    throw new ErrorDatos('Esa dirección apunta a una red interna o no permitida.', 'url');
  return u;
}

// ───────────────────────────── Secretos cifrados ─────────────────────────────

const b64 = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b as ArrayBuffer)));
const deB64 = (s: string) => Uint8Array.from(atob(s), (x) => x.charCodeAt(0));
const b64url = (b: Uint8Array) => b64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** De dónde sale la llave: la dedicada (d) o derivada del secreto del reloj (r, provisional). */
export function origenLlave(env: Env): 'dedicada' | 'derivada' | null {
  if (env.FLEX_LLAVE_WEBHOOKS) return 'dedicada';
  if (env.RELOJ_SECRETO) return 'derivada';
  return null;
}

async function llave(env: Env, origen: 'd' | 'r'): Promise<CryptoKey> {
  const material =
    origen === 'd'
      ? env.FLEX_LLAVE_WEBHOOKS
      : env.RELOJ_SECRETO
        ? `divoox-flex-webhooks:v1:${env.RELOJ_SECRETO}`
        : undefined;
  if (!material)
    throw new ErrorDatos(
      'Las integraciones no están activadas en este servidor todavía.',
      undefined,
      503,
    );
  const bruto = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material));
  return crypto.subtle.importKey('raw', bruto, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function cifrar(env: Env, texto: string): Promise<string> {
  const o = origenLlave(env);
  if (!o)
    throw new ErrorDatos(
      'Las integraciones no están activadas en este servidor todavía.',
      undefined,
      503,
    );
  const marca = o === 'dedicada' ? 'd' : 'r';
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await llave(env, marca),
    new TextEncoder().encode(texto),
  );
  return `v1:${marca}:${b64(iv)}:${b64(ct)}`;
}

export async function descifrar(env: Env, guardado: string): Promise<string> {
  const [v, marca, iv, ct] = guardado.split(':');
  if (v !== 'v1' || (marca !== 'd' && marca !== 'r') || !iv || !ct)
    throw new Error('secreto_ilegible');
  const claro = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: deB64(iv) },
    await llave(env, marca),
    deB64(ct),
  );
  return new TextDecoder().decode(claro);
}

const nuevoSecreto = () => `whsec_dvx_${b64url(crypto.getRandomValues(new Uint8Array(32)))}`;

async function hmacHex(secreto: string, texto: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const firma = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(texto));
  return [...new Uint8Array(firma)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** `t=<segundos>,v1=<hex>[,v1=<hex del secreto anterior>]` sobre `${t}.${cuerpo}`. */
export async function firmar(cuerpo: string, secretos: string[], t: number): Promise<string> {
  const firmas = await Promise.all(secretos.map((s) => hmacHex(s, `${t}.${cuerpo}`)));
  return [`t=${t}`, ...firmas.map((f) => `v1=${f}`)].join(',');
}

/**
 * Cómo verifica el receptor (lo mismo que se publica en la referencia de la API): firma correcta
 * con alguno de sus secretos y marca de tiempo dentro de la tolerancia (5 min, contra repeticiones).
 */
export async function verificarFirma(
  cuerpo: string,
  cabecera: string,
  secreto: string,
  ahoraSeg = Math.floor(Date.now() / 1000),
  toleranciaSeg = 300,
): Promise<boolean> {
  const partes = cabecera.split(',').map((p) => p.split('='));
  const t = Number(partes.find(([k]) => k === 't')?.[1]);
  if (!Number.isFinite(t) || Math.abs(ahoraSeg - t) > toleranciaSeg) return false;
  const esperada = await hmacHex(secreto, `${t}.${cuerpo}`);
  return partes.some(([k, v]) => k === 'v1' && v === esperada);
}

// ───────────────────────────── Despacho (lo llama el reloj y cada escritura) ─────────────────────────────

type FilaEntrega = {
  id: number;
  webhook_id: string;
  empresa_id: string;
  evento_id: string;
  intentos: number;
  es_prueba: number;
  url: string;
  secreto_cifrado: string;
  secreto_anterior_cifrado: string | null;
  secreto_anterior_vence_en: string | null;
  tipo: string;
  datos_json: string;
  evento_creado_en: string;
};

/** Reparte los eventos nuevos entre los destinos activos que los pidieron (una vez cada uno). */
export async function repartirEventos(db: D1Database, limite = 300): Promise<number> {
  const { results } = await db
    .prepare('SELECT id FROM flex_eventos WHERE repartido_en IS NULL ORDER BY id LIMIT ?')
    .bind(limite)
    .all<{ id: number }>();
  if (!results.length) return 0;
  const ids = JSON.stringify(results.map((r) => r.id));
  await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO flex_webhook_entregas (webhook_id, empresa_id, evento_id)
         SELECT w.id, w.empresa_id, e.evento_id
           FROM flex_eventos e
           JOIN flex_webhooks w ON w.empresa_id = e.empresa_id AND w.estado = 'activo'
                               AND w.creado_en <= e.creado_en
          WHERE e.id IN (SELECT value FROM json_each(?1))
            AND EXISTS (SELECT 1 FROM json_each(w.eventos_json) j WHERE j.value = e.tipo OR j.value = '*')`,
      )
      .bind(ids),
    db
      .prepare(
        "UPDATE flex_eventos SET repartido_en = datetime('now') WHERE id IN (SELECT value FROM json_each(?))",
      )
      .bind(ids),
  ]);
  return results.length;
}

/** Arma el cuerpo que recibe la empresa (estable: es parte del contrato público). */
export function cuerpoEvento(f: {
  evento_id: string;
  tipo: string;
  empresa_id: string;
  datos_json: string;
  evento_creado_en: string;
}): string {
  const data = ((): unknown => {
    try {
      return JSON.parse(f.datos_json);
    } catch {
      return {};
    }
  })();
  return JSON.stringify({
    id: f.evento_id,
    type: f.tipo,
    created_at: `${f.evento_creado_en.replace(' ', 'T')}Z`,
    company_id: f.empresa_id,
    api_version: 'v1',
    data,
  });
}

async function enviarUna(env: Env, db: D1Database, f: FilaEntrega) {
  const numero = f.intentos + 1;
  const inicio = Date.now();
  let http: number | null = null;
  let error = '';
  try {
    await revisarDestino(f.url);
    const secretos = [await descifrar(env, f.secreto_cifrado)];
    if (
      f.secreto_anterior_cifrado &&
      f.secreto_anterior_vence_en &&
      Date.parse(`${f.secreto_anterior_vence_en.replace(' ', 'T')}Z`) > Date.now()
    )
      secretos.push(await descifrar(env, f.secreto_anterior_cifrado));
    const cuerpo = cuerpoEvento(f);
    const t = Math.floor(Date.now() / 1000);
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), TIEMPO_ESPERA_MS);
    try {
      const res = await transporte(f.url, {
        method: 'POST',
        redirect: 'manual',
        signal: control.signal,
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Divoox-Webhooks/1.0',
          [CABECERA_FIRMA]: await firmar(cuerpo, secretos, t),
          'Divoox-Event-Id': f.evento_id,
          'Divoox-Event-Type': f.tipo,
          'Divoox-Delivery-Attempt': String(numero),
        },
        body: cuerpo,
      });
      http = res.status;
      // El cuerpo de la respuesta no se guarda ni se lee más allá de cerrarlo.
      await res.body?.cancel().catch(() => undefined);
      if (res.status >= 300 && res.status < 400) error = 'redirección no permitida';
      else if (res.status < 200 || res.status >= 300) error = `respondió ${res.status}`;
    } finally {
      clearTimeout(reloj);
    }
  } catch (e) {
    error =
      e instanceof ErrorDatos
        ? e.message
        : e instanceof Error && e.name === 'AbortError'
          ? 'tiempo de espera agotado'
          : 'no se pudo conectar';
  }
  const duracion = Date.now() - inicio;
  const ok = !error;
  const sentencias: D1PreparedStatement[] = [
    db
      .prepare(
        'INSERT INTO flex_webhook_intentos (entrega_id, webhook_id, numero, http_estado, error, duracion_ms) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(f.id, f.webhook_id, numero, http, error.slice(0, 200), duracion),
  ];
  if (ok) {
    sentencias.push(
      db
        .prepare(
          `UPDATE flex_webhook_entregas SET estado = 'entregado', intentos = ?, ultimo_http = ?, ultimo_error = '',
             entregado_en = datetime('now'), tomado_en = NULL WHERE id = ?`,
        )
        .bind(numero, http, f.id),
    );
    if (!f.es_prueba)
      sentencias.push(
        db
          .prepare(
            "UPDATE flex_webhooks SET fallos_seguidos = 0, ultimo_exito_en = datetime('now') WHERE id = ?",
          )
          .bind(f.webhook_id),
      );
  } else {
    const espera = ESPERAS_MIN[numero - 1];
    const agotado = f.es_prueba || numero >= MAX_INTENTOS || espera === undefined;
    sentencias.push(
      db
        .prepare(
          `UPDATE flex_webhook_entregas SET estado = ?, intentos = ?, ultimo_http = ?, ultimo_error = ?, tomado_en = NULL,
             proximo_en = datetime('now', '+' || ? || ' minutes') WHERE id = ?`,
        )
        .bind(
          agotado ? 'fallido' : 'pendiente',
          numero,
          http,
          error.slice(0, 200),
          espera ?? 0,
          f.id,
        ),
    );
    if (!f.es_prueba)
      sentencias.push(
        db
          .prepare('UPDATE flex_webhooks SET fallos_seguidos = fallos_seguidos + 1 WHERE id = ?')
          .bind(f.webhook_id),
        // Demasiados fallos seguidos: el destino se desactiva solo y queda en la auditoría.
        db
          .prepare(
            `UPDATE flex_webhooks SET estado = 'desactivado', desactivado_en = datetime('now'),
               motivo = 'Se desactivó solo: ' || fallos_seguidos || ' fallos seguidos.', actualizado_en = datetime('now')
             WHERE id = ? AND estado = 'activo' AND fallos_seguidos >= ?`,
          )
          .bind(f.webhook_id, FALLOS_PARA_DESACTIVAR),
        db
          .prepare(
            `INSERT INTO empresa_auditoria (empresa_id, actor_id, actor_tipo, accion, objeto, detalle_json)
             SELECT ?, NULL, 'sistema', 'integracion.desactivada', id, json_object('fallos', fallos_seguidos)
               FROM flex_webhooks WHERE id = ? AND estado = 'desactivado' AND desactivado_en >= datetime('now', '-2 seconds')
                AND NOT EXISTS (SELECT 1 FROM empresa_auditoria a WHERE a.objeto = flex_webhooks.id
                  AND a.accion = 'integracion.desactivada' AND a.creado_en >= flex_webhooks.desactivado_en)`,
          )
          .bind(f.empresa_id, f.webhook_id),
      );
  }
  await db.batch(sentencias);
  return { ok, http, error, duracionMs: duracion, intento: numero };
}

/**
 * Una vuelta de despacho: reparte lo nuevo, toma lo que toca (con candado por fila: dos vueltas a
 * la vez no mandan lo mismo) y lo envía. Lo atascado más de 5 min en «enviando» se vuelve a tomar.
 */
export async function despacharIntegraciones(
  env: Env,
  db: D1Database,
  opciones: {
    limite?: number;
    empresaId?: string;
    presupuestoMs?: number;
    vueltasReparto?: number;
  } = {},
) {
  // Repartir es barato (dos sentencias por cada 300 eventos): el reloj da varias vueltas para que
  // una importación grande no deje cola; tras cada escritura basta una.
  let repartidos = 0;
  for (let i = 0; i < (opciones.vueltasReparto ?? 1); i++) {
    const n = await repartirEventos(db);
    repartidos += n;
    if (n < 300) break;
  }
  const limite = opciones.limite ?? 25;
  const filtroEmpresa = opciones.empresaId ? 'AND empresa_id = ?2' : '';
  const tomadas = await db
    .prepare(
      `UPDATE flex_webhook_entregas SET estado = 'enviando', tomado_en = datetime('now')
        WHERE id IN (
          SELECT en.id FROM flex_webhook_entregas en JOIN flex_webhooks w ON w.id = en.webhook_id
           WHERE w.estado = 'activo' AND en.es_prueba = 0
             AND ((en.estado = 'pendiente' AND en.proximo_en <= datetime('now'))
               OR (en.estado = 'enviando' AND en.tomado_en < datetime('now', '-5 minutes')))
             ${filtroEmpresa.replace('empresa_id', 'en.empresa_id')}
           ORDER BY en.id LIMIT ?1)
        RETURNING id`,
    )
    .bind(...(opciones.empresaId ? [limite, opciones.empresaId] : [limite]))
    .all<{ id: number }>();
  if (!tomadas.results.length) return { repartidos, enviados: 0, fallidos: 0 };
  const { results } = await db
    .prepare(
      `SELECT en.id, en.webhook_id, en.empresa_id, en.evento_id, en.intentos, en.es_prueba,
              w.url, w.secreto_cifrado, w.secreto_anterior_cifrado, w.secreto_anterior_vence_en,
              e.tipo, e.datos_json, e.creado_en AS evento_creado_en
         FROM flex_webhook_entregas en
         JOIN flex_webhooks w ON w.id = en.webhook_id
         JOIN flex_eventos e ON e.evento_id = en.evento_id
        WHERE en.id IN (SELECT value FROM json_each(?)) ORDER BY en.id`,
    )
    .bind(JSON.stringify(tomadas.results.map((t) => t.id)))
    .all<FilaEntrega>();
  const hasta = Date.now() + (opciones.presupuestoMs ?? 20_000);
  let enviados = 0;
  let fallidos = 0;
  for (const f of results) {
    if (Date.now() > hasta) {
      // Sin tiempo: lo tomado vuelve a la cola tal cual.
      await db
        .prepare(
          "UPDATE flex_webhook_entregas SET estado = 'pendiente', tomado_en = NULL WHERE id = ? AND estado = 'enviando'",
        )
        .bind(f.id)
        .run();
      continue;
    }
    const r = await enviarUna(env, db, f);
    if (r.ok) enviados++;
    else fallidos++;
  }
  return { repartidos, enviados, fallidos };
}

// ───────────────────────────── Rutas de la API (panel e integraciones) ─────────────────────────────

export const flexIntegraciones = new Hono<{ Bindings: Env; Variables: Variables }>();

const esquemaEventos = z
  .array(z.enum([...EVENTOS_INTEGRACION, '*']))
  .min(1, 'Elige al menos un evento.')
  .max(EVENTOS_INTEGRACION.length + 1);
const esquemaAlta = z.object({
  url: z.string().trim().min(10).max(500),
  eventos: esquemaEventos,
  descripcion: z.string().trim().max(120).default(''),
});
const esquemaCambio = z.object({
  url: z.string().trim().min(10).max(500).optional(),
  eventos: esquemaEventos.optional(),
  descripcion: z.string().trim().max(120).optional(),
  estado: z.enum(['activo', 'pausado', 'desactivado']).optional(),
});
const esquemaRotar = z.object({ graciaHoras: z.number().int().min(0).max(168).default(24) });

type FilaWebhook = {
  id: string;
  empresa_id: string;
  url: string;
  eventos_json: string;
  descripcion: string;
  secreto_prefijo: string;
  secreto_anterior_vence_en: string | null;
  estado: string;
  fallos_seguidos: number;
  ultimo_exito_en: string | null;
  desactivado_en: string | null;
  motivo: string;
  creado_en: string;
};

const publico = (w: FilaWebhook) => ({
  id: w.id,
  url: w.url,
  eventos: JSON.parse(w.eventos_json) as string[],
  descripcion: w.descripcion,
  secretoPrefijo: w.secreto_prefijo,
  secretoAnteriorVenceEn: w.secreto_anterior_vence_en,
  estado: w.estado,
  fallosSeguidos: w.fallos_seguidos,
  ultimoExitoEn: w.ultimo_exito_en,
  desactivadoEn: w.desactivado_en,
  motivo: w.motivo,
  creadoEn: w.creado_en,
});

async function webhookDe(db: D1Database, empresaId: string, id: string): Promise<FilaWebhook> {
  const w = await db
    .prepare('SELECT * FROM flex_webhooks WHERE id = ? AND empresa_id = ?')
    .bind(id, empresaId)
    .first<FilaWebhook>();
  // Lo de otra empresa no existe (404, nunca 403: no se confirma que exista).
  if (!w) throw new ErrorDatos('Esa integración no existe.', undefined, 404);
  return w;
}

flexIntegraciones.get('/empresas/:id/integraciones', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'integraciones.gestionar');
  const db = base(c);
  const { results } = await db
    .prepare('SELECT * FROM flex_webhooks WHERE empresa_id = ? ORDER BY creado_en DESC')
    .bind(actor.empresaId)
    .all<FilaWebhook>();
  const cola = await db
    .prepare(
      `SELECT webhook_id, SUM(estado IN ('pendiente','enviando')) AS pendientes,
              SUM(estado = 'entregado') AS entregados, SUM(estado = 'fallido') AS fallidos
         FROM flex_webhook_entregas WHERE empresa_id = ? AND es_prueba = 0 GROUP BY webhook_id`,
    )
    .bind(actor.empresaId)
    .all<{ webhook_id: string; pendientes: number; entregados: number; fallidos: number }>();
  const porId = new Map(cola.results.map((x) => [x.webhook_id, x]));
  return c.json({
    activadas: origenLlave(c.env) !== null,
    eventosDisponibles: EVENTOS_INTEGRACION,
    integraciones: results.map((w) => ({
      ...publico(w),
      cola: {
        pendientes: Number(porId.get(w.id)?.pendientes ?? 0),
        entregados: Number(porId.get(w.id)?.entregados ?? 0),
        fallidos: Number(porId.get(w.id)?.fallidos ?? 0),
      },
    })),
  });
});

flexIntegraciones.post('/empresas/:id/integraciones', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'integraciones.gestionar');
  const d = await leerCuerpo(c, esquemaAlta);
  const db = base(c);
  const cuantas = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM flex_webhooks WHERE empresa_id = ? AND estado <> 'desactivado'",
    )
    .bind(actor.empresaId)
    .first<{ n: number }>();
  if (Number(cuantas?.n) >= MAX_DESTINOS_EMPRESA)
    throw new ErrorDatos(
      'Tu empresa llegó al máximo de integraciones activas (10).',
      undefined,
      409,
    );
  const u = await revisarDestino(d.url);
  const secreto = nuevoSecreto();
  const id = nuevoIdFlex();
  await db.batch([
    db
      .prepare(
        `INSERT INTO flex_webhooks (id, empresa_id, url, eventos_json, descripcion, secreto_cifrado, secreto_prefijo, creado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        actor.empresaId,
        u.href,
        JSON.stringify([...new Set(d.eventos)]),
        d.descripcion,
        await cifrar(c.env, secreto),
        secreto.slice(0, 14),
        actor.actorTipo === 'usuario' ? actor.actorId : null,
      ),
    sentenciaAuditoria(db, actor, 'integracion.crear', id, { url: u.origin, eventos: d.eventos }),
  ]);
  const w = await webhookDe(db, actor.empresaId, id);
  // El secreto sale UNA sola vez, aquí. Después solo se ve su prefijo.
  return c.json({ integracion: publico(w), secreto }, 201);
});

flexIntegraciones.patch('/empresas/:id/integraciones/:wid', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'integraciones.gestionar');
  const d = await leerCuerpo(c, esquemaCambio);
  const db = base(c);
  const w = await webhookDe(db, actor.empresaId, c.req.param('wid'));
  const url = d.url ? (await revisarDestino(d.url)).href : w.url;
  const reactivar = d.estado === 'activo' && w.estado !== 'activo';
  await db.batch([
    db
      .prepare(
        `UPDATE flex_webhooks SET url = ?, eventos_json = ?, descripcion = ?, estado = ?,
           fallos_seguidos = CASE WHEN ? THEN 0 ELSE fallos_seguidos END,
           desactivado_en = CASE WHEN ? = 'desactivado' AND estado <> 'desactivado' THEN datetime('now')
                                 WHEN ? = 'activo' THEN NULL ELSE desactivado_en END,
           motivo = CASE WHEN ? THEN '' WHEN ? = 'desactivado' AND estado <> 'desactivado' THEN 'Desactivada por la empresa.' ELSE motivo END,
           actualizado_en = datetime('now')
         WHERE id = ?`,
      )
      .bind(
        url,
        d.eventos ? JSON.stringify([...new Set(d.eventos)]) : w.eventos_json,
        d.descripcion ?? w.descripcion,
        d.estado ?? w.estado,
        reactivar ? 1 : 0,
        d.estado ?? w.estado,
        d.estado ?? w.estado,
        reactivar ? 1 : 0,
        d.estado ?? w.estado,
        w.id,
      ),
    sentenciaAuditoria(db, actor, 'integracion.cambiar', w.id, {
      estado: d.estado,
      eventos: d.eventos,
      url: d.url ? new URL(url).origin : undefined,
    }),
  ]);
  return c.json({ integracion: publico(await webhookDe(db, actor.empresaId, w.id)) });
});

/** Rotar el secreto: el nuevo sale una vez; el anterior sigue firmando durante la gracia. */
flexIntegraciones.post('/empresas/:id/integraciones/:wid/rotar', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'integraciones.gestionar');
  const d = await leerCuerpo(c, esquemaRotar);
  const db = base(c);
  const w = await webhookDe(db, actor.empresaId, c.req.param('wid'));
  const secreto = nuevoSecreto();
  await db.batch([
    db
      .prepare(
        `UPDATE flex_webhooks SET secreto_anterior_cifrado = CASE WHEN ?1 > 0 THEN secreto_cifrado END,
           secreto_anterior_vence_en = CASE WHEN ?1 > 0 THEN datetime('now', '+' || ?1 || ' hours') END,
           secreto_cifrado = ?2, secreto_prefijo = ?3, actualizado_en = datetime('now')
         WHERE id = ?4`,
      )
      .bind(d.graciaHoras, await cifrar(c.env, secreto), secreto.slice(0, 14), w.id),
    sentenciaAuditoria(db, actor, 'integracion.rotar_secreto', w.id, {
      graciaHoras: d.graciaHoras,
    }),
  ]);
  return c.json({ integracion: publico(await webhookDe(db, actor.empresaId, w.id)), secreto });
});

/** Botón de prueba: manda un evento «ping» firmado ahora mismo y dice qué respondió su sistema. */
flexIntegraciones.post('/empresas/:id/integraciones/:wid/probar', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'integraciones.gestionar');
  const db = base(c);
  const w = await webhookDe(db, actor.empresaId, c.req.param('wid'));
  const eventoId = `evt_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  await db.batch([
    db
      .prepare(
        `INSERT INTO flex_eventos (evento_id, empresa_id, tipo, objeto_id, datos_json, repartido_en)
         VALUES (?, ?, 'ping', ?, ?, datetime('now'))`,
      )
      .bind(eventoId, actor.empresaId, w.id, JSON.stringify({ integration_id: w.id, test: true })),
    db
      .prepare(
        `INSERT INTO flex_webhook_entregas (webhook_id, empresa_id, evento_id, estado, es_prueba, tomado_en)
         VALUES (?, ?, ?, 'enviando', 1, datetime('now'))`,
      )
      .bind(w.id, actor.empresaId, eventoId),
  ]);
  const f = await db
    .prepare(
      `SELECT en.id, en.webhook_id, en.empresa_id, en.evento_id, en.intentos, en.es_prueba,
              w.url, w.secreto_cifrado, w.secreto_anterior_cifrado, w.secreto_anterior_vence_en,
              e.tipo, e.datos_json, e.creado_en AS evento_creado_en
         FROM flex_webhook_entregas en JOIN flex_webhooks w ON w.id = en.webhook_id
         JOIN flex_eventos e ON e.evento_id = en.evento_id
        WHERE en.webhook_id = ? AND en.evento_id = ?`,
    )
    .bind(w.id, eventoId)
    .first<FilaEntrega>();
  if (!f) throw new ErrorDatos('No se pudo preparar la prueba.', undefined, 409);
  const r = await enviarUna(c.env, db, f);
  return c.json({ eventoId, ...r });
});

/** Registro de intentos (sin cuerpos ni secretos). */
flexIntegraciones.get('/empresas/:id/integraciones/:wid/intentos', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'integraciones.gestionar');
  const db = base(c);
  const w = await webhookDe(db, actor.empresaId, c.req.param('wid'));
  const limite = Math.min(200, Math.max(1, Number(c.req.query('limite') ?? 50) || 50));
  const { results } = await db
    .prepare(
      `SELECT i.id, i.numero, i.http_estado, i.error, i.duracion_ms, i.creado_en,
              en.evento_id, en.estado AS entrega_estado, en.es_prueba, e.tipo
         FROM flex_webhook_intentos i
         JOIN flex_webhook_entregas en ON en.id = i.entrega_id
         JOIN flex_eventos e ON e.evento_id = en.evento_id
        WHERE i.webhook_id = ? ORDER BY i.id DESC LIMIT ?`,
    )
    .bind(w.id, limite)
    .all<{
      id: number;
      numero: number;
      http_estado: number | null;
      error: string;
      duracion_ms: number | null;
      creado_en: string;
      evento_id: string;
      entrega_estado: string;
      es_prueba: number;
      tipo: string;
    }>();
  return c.json({
    intentos: results.map((x) => ({
      id: x.id,
      eventoId: x.evento_id,
      tipo: x.tipo,
      intento: x.numero,
      http: x.http_estado,
      error: x.error,
      duracionMs: x.duracion_ms,
      estadoEntrega: x.entrega_estado,
      prueba: Boolean(x.es_prueba),
      creadoEn: x.creado_en,
    })),
  });
});
