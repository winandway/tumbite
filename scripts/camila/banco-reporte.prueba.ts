/* eslint-disable security/detect-non-literal-fs-filename -- guion manual: las rutas salen del propio repositorio y de la variable SALIDA */
// Copia manual (ver banco-reporte.md). No corre en la verificación automática.
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { usarTransporteCorreo } from '../correo';
import { mundo } from '../pruebas/ayuda';

/**
 * C-CAMILA-REPORTE-CONVERSADO: conversaciones reales de reporte de fallo contra el modelo REAL, con
 * una captura de verdad. La primera es la de Richard del 19 nov 2026, tal cual. En ninguna puede
 * salir una pregunta del guion viejo ni pedirse dos veces un dato; todas terminan con su caso F-….
 */
const CAPTURA = readFileSync(
  join(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'docs',
    'capturas',
    'camila',
    'camila-driver-chat-es.png',
  ),
);
const GUION = /esperabas que pasara|justo antes|te pasa siempre|did you expect|right before/i;
const PIDE_CONTACTO = /a qué correo|correo o teléfono|what email|email or phone/i;

type Paso = { texto: string; captura?: boolean };
const CASOS: { nombre: string; idioma: 'es' | 'en'; pasos: Paso[]; correo?: string }[] = [
  {
    nombre: 'Richard, tal cual: la captura sola y después el problema con su correo',
    idioma: 'es',
    correo: 'prueba.camila@ejemplo.com',
    pasos: [
      { texto: '', captura: true },
      {
        texto:
          'lo que pasa es que no veo la tasa de cambio y me puedes avisar a este correo prueba.camila@ejemplo.com',
      },
    ],
  },
  {
    nombre: 'Todo en un mensaje: captura, problema, dónde, nombre y correo',
    idioma: 'es',
    correo: 'laura@ejemplo.com',
    pasos: [
      {
        texto:
          'Hola, soy Laura Ejemplo. En Divoox Driver, en la pantalla de recargar, no me aparece la tasa de cambio. Mi correo es laura@ejemplo.com',
        captura: true,
      },
    ],
  },
  {
    nombre: 'Sin captura y sin querer dar datos',
    idioma: 'es',
    pasos: [{ texto: 'la página no carga el menú del restaurante' }],
  },
  {
    nombre: 'En inglés, con teléfono',
    idioma: 'en',
    pasos: [
      {
        texto:
          'The app keeps closing when I open the map in Divoox Driver. You can text me at +1 248 555 0100',
        captura: true,
      },
    ],
  },
];

it('banco de reportes de fallo contra el modelo real', { timeout: 900_000 }, async () => {
  usarTransporteCorreo(
    async () => new Response(JSON.stringify({ success: true, message_id: 'm' })),
    { omitirDePrueba: false },
  );
  const m = mundo({
    YAD_TOKEN: 'tok',
    ADMIN_CORREOS: 'equipo@windoce.com',
    GEMINI_API_KEY: readFileSync(join(homedir(), '.config/tumbite/gemini-api-key'), 'utf8').trim(),
  });
  const filas: string[] = [];
  const problemas: string[] = [];
  let n = 0;
  for (const caso of CASOS) {
    n += 1;
    const cab = { 'x-camila-visita': `reporte-${n}`.padEnd(40, 'r'), 'x-idioma': caso.idioma };
    const respuestas: string[] = [];
    filas.push(`## ${n}. ${caso.nombre}\n`);
    const decir = async (p: Paso) => {
      let adjunto: string | undefined;
      if (p.captura) {
        const r = await m.crudo('/datos/camila/adjunto', {
          method: 'POST',
          headers: { ...cab, 'content-type': 'image/png', 'cf-connecting-ip': `10.6.6.${n}` },
          body: CAPTURA as BodyInit,
        });
        adjunto = ((await r.json()) as { adjunto: string }).adjunto;
      }
      const r = await m.llamar(
        'POST',
        '/datos/camila/mensaje',
        { texto: p.texto, ...(adjunto ? { adjunto } : {}) },
        undefined,
        cab,
      );
      const t = String(r.datos.respuesta);
      respuestas.push(t);
      filas.push(`**Persona:** ${p.captura ? '[captura] ' : ''}${p.texto}\n\n**Camila:** ${t}\n`);
      return t;
    };
    for (const p of caso.pasos) await decir(p);
    // Se contesta lo que Camila pregunte, hasta el cierre.
    const en = caso.idioma === 'en';
    for (let i = 0; i < 6 && !/F-[A-Z2-9]{5}/.test(respuestas.at(-1) ?? ''); i++) {
      // Se contesta a la PREGUNTA (lo último que dijo), no a lo que anotó antes.
      const todo = respuestas.at(-1) ?? '';
      const u = todo.slice(Math.max(todo.lastIndexOf('¿'), todo.lastIndexOf('. ') + 1, 0));
      const sinDatos = caso.nombre.startsWith('Sin captura');
      const texto = /llamas|nombre|your name/i.test(u)
        ? sinDatos
          ? 'prefiero no decirlo'
          : en
            ? 'Emily Example'
            : 'Laura Ejemplo'
        : /correo|teléfono|email|phone|contact/i.test(u)
          ? sinDatos
            ? 'no quiero dejar ninguno'
            : (caso.correo ?? 'emily@example.com')
          : en
            ? 'In Divoox Driver, on the map screen'
            : 'en la página del restaurante, donde sale el menú';
      await decir({ texto });
    }
    const junto = respuestas.join('\n');
    if (GUION.test(junto)) problemas.push(`${n}: salió una pregunta del guion viejo`);
    if (!/F-[A-Z2-9]{5}/.test(junto)) problemas.push(`${n}: no llegó al número de caso`);
    if (caso.correo) {
      if (!respuestas.at(-1)?.includes(caso.correo))
        problemas.push(`${n}: el cierre no dice el correo que dio`);
      if (respuestas.some((t) => PIDE_CONTACTO.test(t)))
        problemas.push(`${n}: pidió un contacto que ya tenía`);
    }
    if (respuestas.some((t) => /^[a-zñáéíóú]/.test(t)))
      problemas.push(`${n}: una respuesta empieza en minúscula`);
    if (/entendí: (entiendo|i understand)|understood: i /i.test(junto))
      problemas.push(`${n}: el cierre repite «entiendo que»`);
    if (new Set(respuestas).size !== respuestas.length)
      problemas.push(`${n}: repitió una respuesta`);
    if (/asistente virtual|virtual assistant/i.test(junto))
      problemas.push(`${n}: dijo «asistente virtual»`);
  }
  const g = await m.DB.prepare('SELECT microdolares, llamadas, error FROM camila_gasto').first();
  const fichas = await m.DB.prepare(
    'SELECT resumen, captura_lectura, campos_json FROM camila_reportes_fallo ORDER BY creado_en',
  ).all();
  writeFileSync(
    process.env.SALIDA!,
    `${filas.join('\n')}\n\n## Fichas\n\n${fichas.results.map((f) => `- ${JSON.stringify(f)}`).join('\n')}\n\nGasto: ${JSON.stringify(g)}\n\nProblemas: ${problemas.length ? problemas.join(' | ') : 'ninguno'}\n`,
  );
  expect(problemas).toEqual([]);
});
