import type { Env } from './env';
import { nuevoId } from './cripto';

/**
 * C-KYC-AUTO (29 oct 2026): la verificación del repartidor decidida al instante por el motor propio
 * (apps/verificador). Con VERIFICADOR_URL y VERIFICADOR_CLAVE el servidor le manda las fotos firmadas y
 * aplica la decisión; sin ellas, o si el motor no responde, todo sigue como hoy: la revisa el equipo.
 */
export type DecisionMotor = 'verificado' | 'revision' | 'repetir';
export type RespuestaMotor = {
  decision: DecisionMotor;
  motivos: string[];
  huella: number[] | null;
  similitud: number | null;
  parecidas: { id: string; similitud: number }[];
};

export const motorEncendido = (env: Env) => Boolean(env.VERIFICADOR_URL && env.VERIFICADOR_CLAVE);

/** Lo que lee la persona cuando tiene que repetir, en su idioma. Nada técnico ni interno. */
const TEXTOS = new Map<string, { es: string; en: string }>(
  Object.entries({
    documento_ilegible: {
      es: 'No pudimos leer tu documento. Toma la foto con buena luz, sin reflejos y con el documento entero.',
      en: 'We couldn’t read your ID. Take the photo in good light, with no glare and the whole ID in frame.',
    },
    vencido: {
      es: 'Tu documento está vencido. Usa uno vigente.',
      en: 'Your ID is expired. Please use a valid one.',
    },
    sin_cara_en_selfie: {
      es: 'No vimos tu cara en la selfie. Mira a la cámara, de frente y con buena luz.',
      en: 'We couldn’t see your face in the selfie. Look at the camera, straight on, in good light.',
    },
    sin_cara_en_documento: {
      es: 'No vimos la foto de tu documento. Toma el frente completo y nítido.',
      en: 'We couldn’t see the photo on your ID. Take the whole front, sharp and clear.',
    },
    cara_distinta: {
      es: 'Tu selfie no coincide con la foto del documento. Repite la selfie de frente, sin gafas ni gorra.',
      en: 'Your selfie doesn’t match the photo on your ID. Retake it straight on, without glasses or a hat.',
    },
    sin_prueba_de_vida: {
      es: 'Gira la cabeza a un lado y al otro cuando la app te lo pida.',
      en: 'Turn your head to one side and then the other when the app asks you to.',
    },
    otra_persona_en_las_tomas: {
      es: 'Las tres fotos tienen que ser tuyas. Repite las tomas.',
      en: 'All three photos must be of you. Please retake them.',
    },
  }),
);

export function textoMotivos(motivos: string[], idioma: 'es' | 'en'): string {
  return motivos
    .map((m) => {
      const t = TEXTOS.get(m);
      return t ? (idioma === 'en' ? t.en : t.es) : '';
    })
    .filter(Boolean)
    .join(' ');
}

function aBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function firmar(clave: string, hora: string, cuerpo: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(clave),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const firma = new Uint8Array(
    await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${hora}.${cuerpo}`)),
  );
  return [...firma].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type FotosKyc = {
  docTipo: 'licencia' | 'pasaporte' | 'identificacion';
  frente: string;
  reverso: string | null;
  selfie: string;
  giros: [string, string];
};

/**
 * Le pide la decisión al motor. Devuelve null si el motor no está, falta una foto o no respondió bien:
 * en ese caso la verificación queda para el equipo, como siempre.
 */
export async function pedirDecision(
  env: Env,
  db: D1Database,
  usuarioId: string,
  fotos: FotosKyc,
): Promise<RespuestaMotor | null> {
  if (!motorEncendido(env) || !env.BUCKET) return null;
  const leer = async (clave: string | null) => {
    if (!clave) return undefined;
    const obj = await env.BUCKET?.get(clave);
    return obj ? aBase64(new Uint8Array(await obj.arrayBuffer())) : undefined;
  };
  const [frente, reverso, selfie, g1, g2] = await Promise.all([
    leer(fotos.frente),
    leer(fotos.reverso),
    leer(fotos.selfie),
    leer(fotos.giros[0]),
    leer(fotos.giros[1]),
  ]);
  if (!frente || !selfie || !g1 || !g2) return null;
  const { results: malas } = await db
    .prepare(
      'SELECT usuario_id AS id, huella_json AS h FROM huellas_caras WHERE mala_conducta = 1 AND usuario_id <> ? LIMIT 5000',
    )
    .bind(usuarioId)
    .all<{ id: string; h: string }>();
  const cuerpo = JSON.stringify({
    docTipo: fotos.docTipo,
    frente,
    reverso,
    selfie,
    giros: [g1, g2],
    malaConducta: malas.map((m) => ({ id: m.id, huella: JSON.parse(m.h) as number[] })),
  });
  const hora = String(Date.now());
  try {
    const r = await fetch(`${String(env.VERIFICADOR_URL).replace(/\/$/, '')}/verificar`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hora': hora,
        'x-firma': await firmar(String(env.VERIFICADOR_CLAVE), hora, cuerpo),
      },
      body: cuerpo,
      signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) throw new Error(`motor respondió ${r.status}`);
    const d = (await r.json()) as RespuestaMotor;
    if (!['verificado', 'revision', 'repetir'].includes(d.decision))
      throw new Error('motor: decisión desconocida');
    return d;
  } catch (e) {
    // Visible en el registro y en la bandeja del equipo, nunca en silencio.
    console.error('verificador: sin respuesta del motor', e);
    await db
      .prepare(
        "INSERT INTO verificaciones_auto (id, usuario_id, decision, motivos_json) VALUES (?, ?, 'sin_respuesta', '[]')",
      )
      .bind(nuevoId(), usuarioId)
      .run();
    return null;
  }
}

/** Guarda la decisión y la huella de la cara (la de mala conducta, si ya estaba marcada, se respeta). */
export async function guardarDecision(db: D1Database, usuarioId: string, d: RespuestaMotor) {
  await db
    .prepare(
      'INSERT INTO verificaciones_auto (id, usuario_id, decision, motivos_json, similitud, parecidas_json) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(
      nuevoId(),
      usuarioId,
      d.decision,
      JSON.stringify(d.motivos),
      d.similitud,
      JSON.stringify(d.parecidas),
    )
    .run();
  if (d.huella?.length === 128)
    await db
      .prepare(
        `INSERT INTO huellas_caras (usuario_id, huella_json) VALUES (?, ?)
         ON CONFLICT(usuario_id) DO UPDATE SET huella_json = excluded.huella_json, creada_en = datetime('now')`,
      )
      .bind(usuarioId, JSON.stringify(d.huella))
      .run();
}
