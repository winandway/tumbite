import type { Env } from '../env';

/**
 * C-CAMILA-TOPE (17 nov 2026) — todos los países. El gasto de IA de Camila tiene TOPE DIARIO EN CÓDIGO.
 *
 * - Lo normal va con el modelo barato (Gemini 3.1 Flash-Lite); solo lo difícil con Gemini 3.6 Flash.
 *   Precios oficiales leídos el 17 nov 2026 en ai.google.dev/gemini-api/docs/pricing (USD por millón de
 *   fichas, la salida incluye el razonamiento). La serie 2.5 ya no se ofrece a cuentas nuevas.
 *   Ningún otro modelo puede correr: la lista es cerrada (MODELOS_CAMILA) y `assertModelo` va delante
 *   de cada llamada.
 * - Antes de CADA llamada se mira lo gastado hoy (tabla camila_gasto, en millonésimas de dólar). Si
 *   llegó al tope, no se llama: Camila sigue contestando sin IA (Docs y respuestas aprobadas) hasta el
 *   día siguiente, y el equipo recibe UN aviso ese día.
 * - El tope lo pone el equipo en los ajustes de Camila, pero nunca por encima de TOPE_MAXIMO_CENTAVOS.
 * - Una conversación tampoco puede hacer más de LLAMADAS_POR_MENSAJE llamadas por mensaje.
 */
export const MODELOS_CAMILA = {
  normal: { id: 'gemini-3.1-flash-lite', entrada: 0.25, salida: 1.5 },
  dificil: { id: 'gemini-3.6-flash', entrada: 0.75, salida: 3.75 },
} as const;
export type NivelModelo = keyof typeof MODELOS_CAMILA;

/** 1 USD al día por defecto; el equipo lo puede subir hasta 5 USD, nunca más. */
export const TOPE_DIARIO_CENTAVOS = 100;
export const TOPE_MAXIMO_CENTAVOS = 500;
export const LLAMADAS_POR_MENSAJE = 4;

export function assertModelo(id: string) {
  if (!Object.values(MODELOS_CAMILA).some((m) => m.id === id))
    throw new Error(`Camila: el modelo ${id} no está permitido.`);
}

/** Lo que cuesta una llamada, en millonésimas de dólar (precio por millón de fichas = µ$ por ficha). */
export function costoMicro(nivel: NivelModelo, entrada: number, salida: number) {
  const m = nivel === 'dificil' ? MODELOS_CAMILA.dificil : MODELOS_CAMILA.normal;
  return Math.ceil(entrada * m.entrada + salida * m.salida);
}

export type Parte =
  | { text: string }
  // Una imagen (la captura de un reporte de fallo), en base64. Solo la lee el modelo; no se guarda aquí.
  | { inlineData: { mimeType: string; data: string } }
  | { functionCall: { name: string; args?: Record<string, unknown>; id?: string } }
  | { functionResponse: { name: string; response: Record<string, unknown>; id?: string } };
export type Turno = { role: 'user' | 'model'; parts: Parte[] };
export type Herramienta = {
  name: string;
  description: string;
  parameters?: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
};
export type PedidoModelo = {
  nivel: NivelModelo;
  sistema: string;
  turnos: Turno[];
  herramientas: Herramienta[];
  /** Salida obligada en JSON con esta forma (el reporte de fallo conversado). Sin herramientas. */
  json?: Record<string, unknown>;
};
export type RespuestaModelo = { partes: Parte[]; entrada: number; salida: number };
export type LlamadaModelo = (env: Env, p: PedidoModelo) => Promise<RespuestaModelo>;

async function llamarGemini(env: Env, p: PedidoModelo): Promise<RespuestaModelo> {
  const m = p.nivel === 'dificil' ? MODELOS_CAMILA.dificil : MODELOS_CAMILA.normal;
  assertModelo(m.id);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${m.id}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY ?? '' },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: p.sistema }] },
        contents: p.turnos,
        tools: p.herramientas.length ? [{ functionDeclarations: p.herramientas }] : undefined,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 700,
          ...(p.json ? { responseMimeType: 'application/json', responseSchema: p.json } : {}),
        },
      }),
    },
  );
  if (!res.ok)
    throw new Error(`Gemini respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const d = (await res.json()) as {
    candidates?: { content?: { parts?: Parte[] } }[];
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      thoughtsTokenCount?: number;
    };
  };
  const u = d.usageMetadata ?? {};
  return {
    partes: d.candidates?.[0]?.content?.parts ?? [],
    entrada: u.promptTokenCount ?? 0,
    salida: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
  };
}

let llamada: LlamadaModelo = llamarGemini;
/** Pruebas: un modelo de mentira (null vuelve al de verdad). Nunca se le pega a Gemini en una prueba. */
export function usarModeloCamila(f: LlamadaModelo | null) {
  llamada = f ?? llamarGemini;
}

export const hoy = () => new Date().toISOString().slice(0, 10);

export async function gastoDeHoy(db: D1Database) {
  const f = await db
    .prepare('SELECT microdolares, llamadas, regalos, avisado FROM camila_gasto WHERE dia = ?')
    .bind(hoy())
    .first<{ microdolares: number; llamadas: number; regalos: number; avisado: number }>();
  return {
    microdolares: Number(f?.microdolares ?? 0),
    llamadas: Number(f?.llamadas ?? 0),
    regalos: Number(f?.regalos ?? 0),
    avisado: Number(f?.avisado ?? 0) === 1,
  };
}

export const topeEnMicro = (topeCentavos: number) =>
  Math.min(Math.max(0, Math.floor(topeCentavos)), TOPE_MAXIMO_CENTAVOS) * 10_000;

/** ¿Se puede llamar a la IA ahora? Falso sin llave, apagada o con el tope del día alcanzado. */
export async function iaDisponible(
  env: Env,
  db: D1Database,
  topeCentavos: number,
  encendida: boolean,
) {
  if (!encendida || !env.GEMINI_API_KEY) return { ok: false as const, motivo: 'sin_ia' as const };
  const g = await gastoDeHoy(db);
  if (g.microdolares >= topeEnMicro(topeCentavos))
    return { ok: false as const, motivo: 'tope' as const, avisado: g.avisado };
  return { ok: true as const };
}

/**
 * Una llamada al modelo, contada. Mira el tope ANTES de llamar (si se pasó entre dos llamadas del
 * mismo mensaje, también se corta) y suma lo gastado DESPUÉS, en una sola escritura.
 */
export async function preguntarAlModelo(
  env: Env,
  db: D1Database,
  topeCentavos: number,
  p: PedidoModelo,
): Promise<RespuestaModelo | null> {
  const g = await gastoDeHoy(db);
  if (g.microdolares >= topeEnMicro(topeCentavos)) return null;
  assertModelo(p.nivel === 'dificil' ? MODELOS_CAMILA.dificil.id : MODELOS_CAMILA.normal.id);
  const r = await llamada(env, p);
  const costo = costoMicro(p.nivel, r.entrada, r.salida);
  await db
    .prepare(
      `INSERT INTO camila_gasto (dia, microdolares, llamadas) VALUES (?, ?, 1)
       ON CONFLICT(dia) DO UPDATE SET microdolares = microdolares + excluded.microdolares, llamadas = llamadas + 1`,
    )
    .bind(hoy(), costo)
    .run();
  return r;
}

/** Marca que hoy ya se avisó del tope (una sola vez por día). Devuelve true si es la primera. */
export async function marcarAvisoTope(db: D1Database) {
  const r = await db
    .prepare(
      `INSERT INTO camila_gasto (dia, avisado) VALUES (?, 1)
       ON CONFLICT(dia) DO UPDATE SET avisado = 1 WHERE camila_gasto.avisado = 0`,
    )
    .bind(hoy())
    .run();
  return (r.meta.changes ?? 0) > 0;
}

/** El modelo falló (caído, modelo retirado, sin saldo): queda anotado para que el canario lo vea. */
export async function anotarErrorModelo(db: D1Database, e: unknown) {
  const texto = (e instanceof Error ? e.message : String(e)).slice(0, 300);
  await db
    .prepare(
      `INSERT INTO camila_gasto (dia, error_en, error) VALUES (?, datetime('now'), ?)
       ON CONFLICT(dia) DO UPDATE SET error_en = excluded.error_en, error = excluded.error`,
    )
    .bind(hoy(), texto)
    .run();
}

/** Topes del día que no son de IA: fichas anónimas nuevas y correos de «caso nuevo» al equipo. */
export const TOPE_ANONIMOS_DIA = 1500;
export const TOPE_CORREOS_CASO_DIA = 40;
export const MENSAJES_POR_ANONIMO = 40;
/** Códigos de «unir el chat» que se mandan a una misma dirección en un día, como mucho. */
export const CODIGOS_POR_CORREO_DIA = 3;
/** Mensajes de una misma persona que se contestan con IA en un día; después, sin IA. */
export const MENSAJES_IA_POR_PERSONA_DIA = 50;
/**
 * C-CAMILA-VISITANTE (18 nov 2026): el chat de la web sin cuenta también se contesta con IA, porque
 * es la puerta de entrada de todo visitante. Sus frenos, para que nadie se gaste el tope del día:
 * - cada visitante, como mucho estos mensajes con IA al día (después, sin IA);
 * - los visitantes solo usan IA mientras lo gastado hoy no pase de esta parte del tope: el resto queda
 *   reservado para los conductores y clientes con cuenta;
 * - su mensaje se recorta a este largo, y hay un máximo de mensajes por minuto.
 */
export const MENSAJES_IA_POR_ANONIMO_DIA = 20;
export const PARTE_DEL_TOPE_PARA_ANONIMOS = 0.6;
export const LARGO_MENSAJE_ANONIMO = 600;
export const MENSAJES_POR_MINUTO_ANONIMO = 8;

/** Capturas de reportes de fallo que se guardan en un día, como mucho (el almacén no se llena). */
export const TOPE_CAPTURAS_DIA = 300;

const SQL_CONTADOR = {
  anonimos: `INSERT INTO camila_gasto (dia, anonimos) VALUES (?1, 1)
     ON CONFLICT(dia) DO UPDATE SET anonimos = anonimos + 1 WHERE camila_gasto.anonimos < ?2`,
  casos: `INSERT INTO camila_gasto (dia, casos) VALUES (?1, 1)
     ON CONFLICT(dia) DO UPDATE SET casos = casos + 1 WHERE camila_gasto.casos < ?2`,
  capturas: `INSERT INTO camila_gasto (dia, capturas) VALUES (?1, 1)
     ON CONFLICT(dia) DO UPDATE SET capturas = capturas + 1 WHERE camila_gasto.capturas < ?2`,
  resumen_fallos: `INSERT INTO camila_gasto (dia, resumen_fallos) VALUES (?1, 1)
     ON CONFLICT(dia) DO UPDATE SET resumen_fallos = resumen_fallos + 1 WHERE camila_gasto.resumen_fallos < ?2`,
} as const;

/** Suma uno al contador del día si todavía no llegó a su tope. Falso = tope alcanzado. */
export async function contarDelDia(db: D1Database, cual: keyof typeof SQL_CONTADOR, tope: number) {
  const sql = new Map(Object.entries(SQL_CONTADOR)).get(cual) ?? SQL_CONTADOR.casos;
  const r = await db.prepare(sql).bind(hoy(), tope).run();
  return (r.meta.changes ?? 0) > 0;
}
