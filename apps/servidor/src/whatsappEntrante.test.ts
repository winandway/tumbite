import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { mundo } from './pruebas/ayuda';
import { esBaja } from './whatsappEntrante';

/**
 * C-WHATSAPP-ENTRANTE (25 nov 2026) — todos los países. Lo que nos escriben por WhatsApp entra a la
 * bandeja de soporte (el hilo de Camila, canal «WhatsApp»), con la firma de Meta comprobada, una sola
 * vez por id de mensaje, con la baja respetada y sin datos para un número desconocido. Meta va
 * SIMULADO: ninguna prueba le habla a Meta de verdad.
 */
const SECRETO = 'secreto-de-la-app-de-prueba';
const META = {
  META_WHATSAPP_TOKEN: 'token-meta-de-prueba',
  META_WHATSAPP_PHONE_ID: '1000000000000001',
  META_APP_SECRET: SECRETO,
  GEMINI_API_KEY: undefined,
};

type Salida = { para: string; tipo: string; texto: string };
function simularMeta() {
  const salidas: Salida[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (String(url).includes('graph.facebook.com') && init?.method === 'POST') {
      const b = JSON.parse(String(init.body)) as {
        to: string;
        type: string;
        text?: { body: string };
      };
      salidas.push({ para: b.to, tipo: b.type, texto: b.text?.body ?? '' });
      return new Response(JSON.stringify({ messages: [{ id: `wamid.sale${salidas.length}` }] }), {
        status: 200,
      });
    }
    return new Response('{}', { status: 200 });
  });
  return salidas;
}
afterEach(() => vi.unstubAllGlobals());

async function escenario() {
  const m = mundo(META);
  const rep = await m.cuenta('repartidor', 'Marina Ejemplo');
  await m.DB.prepare(
    "UPDATE usuarios SET idioma = 'es', telefono = '+584121234567', telefono_canonico = '+584121234567' WHERE id = ?",
  )
    .bind(rep.id)
    .run();
  // Su ficha de Camila (la bienvenida ya la creó) en español, como su cuenta.
  await m.DB.prepare("UPDATE camila_personas SET idioma = 'es' WHERE usuario_id = ?")
    .bind(rep.id)
    .run();
  const entra = (
    mensajes: Record<string, unknown>[],
    o: { firma?: string; desde?: string } = {},
  ) => {
    const cuerpo = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                contacts: [{ profile: { name: 'Marina' }, wa_id: o.desde ?? '584121234567' }],
                messages: mensajes.map((x) => ({
                  from: o.desde ?? '584121234567',
                  timestamp: '1764100000',
                  ...x,
                })),
              },
            },
          ],
        },
      ],
    });
    return m.crudo('/datos/whatsapp/aviso', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256':
          o.firma ?? `sha256=${createHmac('sha256', SECRETO).update(cuerpo).digest('hex')}`,
      },
      body: cuerpo,
    });
  };
  const hilo = async (usuarioId = rep.id) =>
    (
      await m.DB.prepare(
        `SELECT mm.autor, mm.canal, mm.texto FROM camila_mensajes mm JOIN camila_personas p ON p.id = mm.persona_id
          WHERE p.usuario_id = ? AND mm.canal = 'whatsapp' ORDER BY mm.creado_en, mm.rowid`,
      )
        .bind(usuarioId)
        .all<{ autor: string; canal: string; texto: string }>()
    ).results;
  const contar = async (tabla: string) =>
    Number(
      (await m.DB.prepare(`SELECT COUNT(*) AS n FROM ${tabla}`).first<{ n: number }>())?.n ?? 0,
    );
  return { m, rep, entra, hilo, contar };
}

describe('C-WHATSAPP-ENTRANTE', () => {
  it('FIRMA: una firma inválida da 401 y no guarda nada', async () => {
    const s = await escenario();
    const salidas = simularMeta();
    const r = await s.entra([{ id: 'wamid.uno', type: 'text', text: { body: 'Hola' } }], {
      firma: 'sha256=0000',
    });
    expect(r.status).toBe(401);
    expect(await s.contar('whatsapp_entrantes')).toBe(0);
    expect(await s.contar("camila_mensajes WHERE canal = 'whatsapp'")).toBe(0);
    expect(salidas).toHaveLength(0);
  });

  it('BANDEJA: el mensaje entra al hilo del conductor con canal WhatsApp; sin permiso de IA queda para el equipo con un aviso fijo', async () => {
    const s = await escenario();
    const salidas = simularMeta();
    const r = await s.entra([
      { id: 'wamid.uno', type: 'text', text: { body: '¿Cómo envío mi moto?' } },
    ]);
    expect(r.status).toBe(200);
    const h = await s.hilo();
    expect(h[0]).toEqual({ autor: 'persona', canal: 'whatsapp', texto: '¿Cómo envío mi moto?' });
    expect(await s.contar("camila_casos WHERE estado = 'abierto'")).toBe(1);
    // El aviso fijo sale por WhatsApp como mensaje de sesión (sin plantilla) y sin la palabra prohibida.
    expect(salidas).toHaveLength(1);
    expect(salidas[0]).toMatchObject({ para: '584121234567', tipo: 'text' });
    expect(salidas[0]!.texto).not.toMatch(/asistente virtual/i);
  });

  it('con su permiso de IA, Camila le contesta por el mismo canal', async () => {
    const s = await escenario();
    const salidas = simularMeta();
    await s.m.DB.prepare('UPDATE camila_personas SET permiso_ia = 1 WHERE usuario_id = ?')
      .bind(s.rep.id)
      .run();
    await s.entra([
      { id: 'wamid.uno', type: 'text', text: { body: '¿Cómo envío mi moto a revisión?' } },
    ]);
    const h = await s.hilo();
    expect(h.map((x) => x.autor)).toEqual(['persona', 'camila']);
    expect(salidas).toHaveLength(1);
    expect(salidas[0]!.texto).toBe(h[1]!.texto);
    expect(salidas[0]!.texto).not.toMatch(/asistente virtual/i);
  });

  it('REINTENTO: Meta manda el mismo mensaje dos veces y entra una sola', async () => {
    const s = await escenario();
    const salidas = simularMeta();
    const msg = [{ id: 'wamid.uno', type: 'text', text: { body: 'Hola' } }];
    await s.entra(msg);
    await s.entra(msg);
    expect((await s.hilo()).filter((x) => x.autor === 'persona')).toHaveLength(1);
    expect(await s.contar('whatsapp_entrantes')).toBe(1);
    expect(salidas).toHaveLength(1);
  });

  it('FOTO o AUDIO: se anota qué mandó, sin descargar nada', async () => {
    const s = await escenario();
    const salidas = simularMeta();
    await s.entra([
      { id: 'wamid.foto', type: 'image', image: { id: 'media-1', mime_type: 'image/jpeg' } },
      { id: 'wamid.audio', type: 'audio', audio: { id: 'media-2', mime_type: 'audio/ogg' } },
    ]);
    const textos = (await s.hilo()).filter((x) => x.autor === 'persona').map((x) => x.texto);
    expect(textos).toEqual(['(mandó una foto)', '(mandó un audio)']);
    // Ninguna llamada para bajar el archivo (solo el aviso fijo que sale una vez).
    expect(salidas.every((x) => x.tipo === 'text')).toBe(true);
  });

  it('BAJA: «BAJA» lo da de baja de los avisos (la misma baja del correo) y se le confirma', async () => {
    expect(esBaja('BAJA')).toBe(true);
    expect(esBaja('Stop')).toBe(true);
    expect(esBaja('no más!')).toBe(true);
    expect(esBaja('no más preguntas sobre mi moto')).toBe(false);
    const s = await escenario();
    const salidas = simularMeta();
    await s.entra([{ id: 'wamid.baja', type: 'text', text: { body: 'No más' } }]);
    const b = await s.m.DB.prepare('SELECT canal FROM rezagados_bajas WHERE usuario_id = ?')
      .bind(s.rep.id)
      .first<{ canal: string }>();
    expect(b?.canal).toBe('whatsapp');
    expect(salidas).toHaveLength(1);
    expect(salidas[0]!.texto).toMatch(/no te enviaremos más avisos/);
    // No abre un caso ni pasa por la IA.
    expect(await s.contar('camila_casos')).toBe(0);
  });

  it('NÚMERO DESCONOCIDO: deja su caso sin cuenta y no se le responde con datos', async () => {
    const s = await escenario();
    const salidas = simularMeta();
    await s.entra([{ id: 'wamid.x', type: 'text', text: { body: '¿Cuál es mi saldo?' } }], {
      desde: '584149990000',
    });
    const p = await s.m.DB.prepare(
      "SELECT id, usuario_id FROM camila_personas WHERE telefono = '+584149990000'",
    ).first<{ id: string; usuario_id: string | null }>();
    expect(p?.usuario_id).toBeNull();
    expect(await s.contar(`camila_casos WHERE persona_id = '${p!.id}'`)).toBe(1);
    expect(salidas).toHaveLength(1);
    expect(salidas[0]!.texto).not.toMatch(/Marina|saldo|\d/);
  });

  it('VENTANA: el equipo responde dentro de las 24 h; fuera, no sale y lo dice', async () => {
    const s = await escenario();
    const salidas = simularMeta();
    const admin = await s.m.cuenta('admin', 'Soporte Divoox');
    await s.entra([{ id: 'wamid.uno', type: 'text', text: { body: 'Hola' } }]);
    const p = await s.m.DB.prepare('SELECT id FROM camila_personas WHERE usuario_id = ?')
      .bind(s.rep.id)
      .first<{ id: string }>();
    const dentro = await s.m.llamar(
      'POST',
      `/datos/admin/camila/hilos/${p!.id}/responder`,
      { texto: 'Hola, te ayudo con tu moto.' },
      admin.token,
    );
    expect(dentro.datos.enviado).toBe(true);
    expect(salidas.at(-1)!.texto).toContain('Hola, te ayudo con tu moto.');
    await s.m.DB.prepare(
      "UPDATE camila_mensajes SET creado_en = datetime('now', '-25 hours') WHERE autor = 'persona'",
    ).run();
    const fuera = await s.m.llamar(
      'POST',
      `/datos/admin/camila/hilos/${p!.id}/responder`,
      { texto: 'Seguimos aquí.' },
      admin.token,
    );
    expect(fuera.datos).toMatchObject({ enviado: false, motivo: 'fuera_de_ventana' });
    expect(salidas.some((x) => x.texto.includes('Seguimos aquí.'))).toBe(false);
  });
});
