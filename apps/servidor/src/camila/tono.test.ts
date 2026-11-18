import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { aHtml, usarTransporteCorreo } from '../correo';
import { mundo } from '../pruebas/ayuda';
import { trozosDeMensaje } from '@tumbite/compartido';
import { buscarGuias, conEnlacesDeGuia } from './buscadorDocs';
import { buscarEnDocs } from './conocimiento';
import { cuidarTono } from './cerebro';
import { DOCS_PUBLICOS } from './docsPublicos';
import { cortesiaDe } from './identidad';
import { type LlamadaModelo, usarModeloCamila } from './modelo';

/**
 * C-CAMILA-CONOCIMIENTO y C-CAMILA-TONO (18 nov 2026, Richard, después de leer una conversación real:
 * «Hola Camila, ¿cómo pido una moto?» → «Todavía no tengo esa respuesta»). Todos los países.
 * 1. Camila sabe lo básico de Divoox: TODAS las guías públicas del cliente y del conductor, en los
 *    dos idiomas, y treinta preguntas comunes que tiene que contestar bien.
 * 2. No repite quién es: se saluda una vez y no se vuelve a presentar.
 * 3. No dice «asistente virtual» si nadie lo pregunta (si preguntan, dice la verdad).
 * 4. No ofrece hablar con una persona: solo pasa si se lo piden, si la persona está molesta o tras
 *    dos intentos sin poder resolver.
 */
afterEach(() => {
  usarModeloCamila(null);
  usarTransporteCorreo(null);
});

/** Pregunta, idioma, quién pregunta y la guía (o guías) que la responde bien. */
const TREINTA: [string, 'es' | 'en', 'cliente' | 'conductor', string[]][] = [
  ['Hola Camila, ¿cómo pido una moto?', 'es', 'cliente', ['ordering/ride-moto']],
  ['¿cómo pido un carro?', 'es', 'cliente', ['ordering/ride-car']],
  ['quiero pedir comida', 'es', 'cliente', ['ordering/first-order']],
  ['¿cómo mando un paquete?', 'es', 'cliente', ['ordering/send-package']],
  [
    '¿puedo pagar en efectivo?',
    'es',
    'cliente',
    ['ordering/pay-on-delivery-venezuela', 'ordering/pay-on-delivery'],
  ],
  ['¿cómo pago la moto?', 'es', 'cliente', ['ordering/ride-moto-pago']],
  ['tengo un cupón, ¿dónde lo pongo?', 'es', 'cliente', ['ordering/coupons']],
  [
    '¿cómo uso un código de regalo?',
    'es',
    'cliente',
    ['ordering/gift-codes', 'ordering/gift-cards'],
  ],
  ['¿cómo guardo mi casa?', 'es', 'cliente', ['ordering/saved-addresses']],
  ['lugares guardados', 'es', 'cliente', ['ordering/saved-addresses']],
  ['¿cómo cancelo mi pedido?', 'es', 'cliente', ['ordering/cancel-order']],
  ['¿cómo comparto mi viaje?', 'es', 'cliente', ['ordering/ride-seguridad']],
  ['¿cómo califico al conductor?', 'es', 'cliente', ['ordering/rate']],
  ['¿cómo agrego una parada?', 'es', 'cliente', ['ordering/ride-car-stops']],
  ['¿cómo programo un viaje?', 'es', 'cliente', ['ordering/regular-rides']],
  ['¿cómo borro mi cuenta?', 'es', 'cliente', ['account/delete']],
  ['¿cómo invito a un amigo?', 'es', 'cliente', ['ordering/invite-a-friend']],
  ['¿es seguro viajar en moto?', 'es', 'cliente', ['ordering/ride-seguridad']],
  ['¿cómo chateo con mi conductor?', 'es', 'cliente', ['ordering/chat-with-your-driver']],
  [
    '¿cómo recargo mi saldo?',
    'es',
    'conductor',
    ['drivers/driver-balance', 'drivers/cash-orders-and-top-ups', 'drivers/drive-moto-saldo'],
  ],
  ['¿cuánto es la comisión?', 'es', 'conductor', ['drivers/driver-balance']],
  [
    '¿cómo me conecto para recibir carreras?',
    'es',
    'conductor',
    ['drivers/get-started', 'drivers/online-for-several-services'],
  ],
  ['¿cómo me registro como conductor?', 'es', 'conductor', ['drivers/get-started']],
  ['¿cómo verifico mi identidad?', 'es', 'conductor', ['drivers/verify']],
  ['¿qué hago si el pasajero tiene un regalo?', 'es', 'conductor', ['drivers/divoox-gift-trips']],
  ['how do I order a moto ride?', 'en', 'cliente', ['ordering/ride-moto']],
  [
    'how do I pay in cash?',
    'en',
    'cliente',
    ['ordering/pay-on-delivery', 'ordering/pay-on-delivery-venezuela'],
  ],
  ['how do I use a coupon?', 'en', 'cliente', ['ordering/coupons']],
  ['how do I send a package?', 'en', 'cliente', ['ordering/send-package']],
  [
    'how do I top up my balance?',
    'en',
    'conductor',
    ['drivers/driver-balance', 'drivers/cash-orders-and-top-ups'],
  ],
];

describe('C-CAMILA-CONOCIMIENTO: Camila sabe lo básico de Divoox', () => {
  it('tiene TODAS las guías públicas del cliente y del conductor, en los dos idiomas, y al día', () => {
    const rutas = (i: string) =>
      new Set(DOCS_PUBLICOS.filter((g) => g.idioma === i).map((g) => g.ruta));
    expect(rutas('es').size).toBeGreaterThan(100);
    expect([...rutas('es')].sort()).toEqual([...rutas('en')].sort());
    for (const seccion of ['ordering', 'drivers', 'trust', 'account'])
      expect(
        [...rutas('es')].some((r) => r.startsWith(`${seccion}/`)),
        seccion,
      ).toBe(true);
    // Solo guías públicas: nada del superadmin ni de la ayuda interna.
    expect(JSON.stringify(DOCS_PUBLICOS)).not.toMatch(
      /superadmin|ayuda interna|camila-support-inbox/i,
    );
    // El archivo sale de las guías del sitio: si una guía cambia y no se regenera, esto se pone en rojo.
    const raiz = join(__dirname, '..', '..', '..', '..');
    expect(() =>
      execFileSync('node', [join(raiz, 'scripts', 'camila', 'generar-docs.mjs'), '--check'], {
        cwd: raiz,
        stdio: 'pipe',
      }),
    ).not.toThrow();
  }, 60_000);

  it.each(TREINTA)('«%s» (%s, %s)', (pregunta, idioma, quien, esperadas) => {
    const [mejor] = buscarGuias(
      pregunta,
      idioma,
      1,
      quien === 'conductor' ? 'drivers' : 'ordering',
    );
    expect(mejor?.guia.ruta, pregunta).toBeDefined();
    expect(esperadas, `${pregunta} → ${mejor?.guia.ruta}`).toContain(mejor?.guia.ruta);
  });

  it('lo que no está en ninguna guía no se contesta con una guía cualquiera', () => {
    for (const p of [
      '¿Dónde queda la oficina de Divoox en El Vigía?',
      'cuéntame un chiste',
      '¿quién ganó el partido de ayer?',
    ])
      expect(buscarGuias(p, 'es'), p).toEqual([]);
  });
});

async function escenario(extra: Record<string, unknown> = {}) {
  const enviados: { para: string; asunto: string }[] = [];
  usarTransporteCorreo(
    async (_u, init) => {
      const c = JSON.parse(String(init.body)) as { to: { address: string }[]; subject: string };
      enviados.push({ para: c.to[0]!.address, asunto: c.subject });
      return new Response(JSON.stringify({ success: true, message_id: 'm1' }));
    },
    { omitirDePrueba: false },
  );
  const m = mundo({
    YAD_TOKEN: 'tok',
    ADMIN_CORREOS: 'equipo@windoce.com',
    GEMINI_API_KEY: 'llave-de-prueba-de-gemini-1234',
    ...extra,
  });
  const cliente = await m.cuenta('cliente', 'Carla Cliente');
  const decir = (t: string, token = cliente.token, idioma: 'es' | 'en' = 'es') =>
    m.llamar('POST', '/datos/camila/mensaje', { texto: t, canal: 'web' }, token, {
      'x-idioma': idioma,
      'cf-ipcountry': 'VE',
    });
  const casos = async () =>
    (await m.DB.prepare('SELECT COUNT(*) AS n FROM camila_casos').first<{ n: number }>())?.n;
  return { m, cliente, decir, casos, enviados };
}
const modelo = (f: LlamadaModelo) => usarModeloCamila(f);

describe('C-CAMILA-TONO: la conversación que leyó Richard, arreglada', () => {
  it('sin IA: «Hola Camila, ¿cómo pido una moto?» se contesta con la guía, sin presentarse, sin «asistente virtual» y sin ofrecer una persona', async () => {
    const e = await escenario({ GEMINI_API_KEY: undefined });
    const r = await e.decir('Hola Camila, ¿cómo pido una moto?');
    const texto = r.datos.respuesta as string;
    expect(texto).toMatch(/moto/i);
    // C-CAMILA-ENLACE-GUIA: termina con el enlace a la guía, como texto que se toca.
    expect(texto).toMatch(
      /\n\nVer la guía con capturas → https:\/\/divoox\.com\/es\/docs\/ordering\/ride-moto$/,
    );
    // La guía dice el botón como está hoy en la app.
    expect(texto).toContain('«Solicitar moto»');
    expect(texto).not.toMatch(
      /Todavía no tengo esa respuesta|Soy Camila|asistente virtual|hablar con una persona|persona del equipo/i,
    );
    expect(await e.casos()).toBe(0);
  });

  it('2 · no repite la identidad: el modelo se vuelve a presentar y a saludar, y sale sin eso', async () => {
    const e = await escenario();
    modelo(async () => ({
      partes: [
        {
          text: 'Hola, Carla. Soy Camila Campos, del equipo de soporte de Divoox. Para pedir una moto, abre Moto y escribe tu destino.',
        },
      ],
      entrada: 10,
      salida: 10,
    }));
    const primero = (await e.decir('hola, necesito ayuda con la app')).datos.respuesta as string;
    // En el primer mensaje puede saludar, pero no presentarse (el encabezado ya lo dice).
    expect(primero).toMatch(/^Hola, Carla\./);
    expect(primero).not.toMatch(/Soy Camila|del equipo de soporte/);
    const segundo = (await e.decir('¿cómo pido una moto?')).datos.respuesta as string;
    expect(segundo).toBe('Para pedir una moto, abre Moto y escribe tu destino.');
    expect(cuidarTono('Hola. Soy Camila. Toca Moto.', { yaEmpezo: true, puedePasar: false })).toBe(
      'Toca Moto.',
    );
  });

  it('3 · no dice «asistente virtual» si nadie lo pregunta (Venezuela, interruptor apagado); si preguntan, dice la verdad', async () => {
    const e = await escenario();
    modelo(async () => ({
      partes: [
        { text: 'Como asistente virtual de Divoox, te cuento. Abre Moto y escribe tu destino.' },
      ],
      entrada: 10,
      salida: 10,
    }));
    const r = (await e.decir('¿cómo pido una moto?')).datos.respuesta as string;
    expect(r).toBe('Abre Moto y escribe tu destino.');
    const hilo = await e.m.llamar('GET', '/datos/camila/hilo', undefined, e.cliente.token);
    expect(JSON.stringify(hilo.datos.mensajes)).not.toMatch(/asistente virtual/i);
    expect((await e.decir('¿eres una persona?')).datos.respuesta).toMatch(
      /soy la asistente virtual de Divoox, no una persona/,
    );
  });

  it('4 · no ofrece una persona: ni en la respuesta ni a la primera duda; solo tras dos intentos, si la piden o si está molesta', async () => {
    const e = await escenario();
    // El modelo intenta ofrecer una persona y abrir un caso sin motivo: no pasa.
    let intentoCaso = 0;
    modelo(async (_env, p) => {
      const ultima = p.turnos[p.turnos.length - 1]?.parts[0];
      if (ultima && 'text' in ultima && !intentoCaso++)
        return {
          partes: [{ functionCall: { name: 'abrir_caso', args: { resumen: 'quiere una moto' } } }],
          entrada: 10,
          salida: 10,
        };
      return {
        partes: [
          {
            text: 'Abre Moto y escribe tu destino. Si prefieres hablar con una persona del equipo, solo dímelo.',
          },
        ],
        entrada: 10,
        salida: 10,
      };
    });
    expect((await e.decir('¿cómo pido una moto?')).datos.respuesta).toBe(
      'Abre Moto y escribe tu destino.',
    );
    expect(await e.casos()).toBe(0);
    // Sin IA: algo que no sabe. Primero pide que se lo cuenten de otra forma; a la segunda, pasa.
    usarModeloCamila(null);
    const sinIa = await escenario({ GEMINI_API_KEY: undefined });
    const uno = (await sinIa.decir('¿dónde queda la oficina de Divoox?')).datos.respuesta as string;
    expect(uno).toBe('No estoy segura de haberte entendido. ¿Me lo cuentas con otras palabras?');
    expect(await sinIa.casos()).toBe(0);
    expect((await sinIa.decir('la oficina, ¿dónde está?')).datos.respuesta).toMatch(
      /lo vea alguien del equipo/,
    );
    expect(await sinIa.casos()).toBe(1);
    expect(sinIa.enviados.filter((x) => /caso nuevo/.test(x.asunto))).toHaveLength(1);
    // Molesta: pasa de una vez, con una disculpa corta.
    const otra = await sinIa.m.cuenta('cliente', 'Dora Cliente');
    expect(
      (await sinIa.decir('esto es una estafa, pésimo servicio', otra.token)).datos.respuesta,
    ).toMatch(/Entiendo tu molestia/);
    expect(await sinIa.casos()).toBe(2);
  });

  it('el saludo fijo del chat es corto, y la etiqueta de cada mensaje es solo «Camila»', async () => {
    const { TEXTOS_CHAT_SOPORTE, nombreAutorCamila } = await import('@tumbite/compartido');
    for (const t of [TEXTOS_CHAT_SOPORTE.es, TEXTOS_CHAT_SOPORTE.en]) {
      expect(t.saludo.length).toBeLessThan(40);
      expect(t.saludo).not.toMatch(/Camila|soporte|support|persona|person/i);
    }
    expect(nombreAutorCamila('camila', 'es')).toBe('Camila');
    expect(TEXTOS_CHAT_SOPORTE.es.camila).toBe('Camila Campos, del equipo de soporte de Divoox');
  });
});

describe('C-CAMILA-ENLACE-GUIA: toda respuesta que sale de una guía termina con su enlace', () => {
  const rutasDe = (t: string) =>
    [...t.matchAll(/https:\/\/divoox\.com(?:\/es)?\/docs\/([a-z0-9/-]+)/g)].map((m) => m[1]);

  it.each(TREINTA)(
    '«%s» termina con el enlace de su guía, en su idioma',
    async (pregunta, idioma, quien) => {
      const e = await escenario({ GEMINI_API_KEY: undefined });
      const token =
        quien === 'conductor'
          ? (await e.m.cuenta('repartidor', 'Diego Conductor')).token
          : undefined;
      const texto = (await e.decir(pregunta, token, idioma)).datos.respuesta as string;
      const ultima = texto.split('\n').at(-1) ?? '';
      // Lo que no sale de una guía (el estado de la cuenta del conductor) no lleva enlace.
      if (quien === 'conductor' && !texto.includes('divoox.com')) return;
      expect(ultima).toMatch(
        idioma === 'es'
          ? /^Ver la guía con capturas → https:\/\/divoox\.com\/es\/docs\/[a-z0-9/-]+$/
          : /^See the guide with screenshots → https:\/\/divoox\.com\/docs\/[a-z0-9/-]+$/,
      );
      // Nunca inventa un enlace: todos son guías que existen en Docs, en ese idioma.
      for (const ruta of rutasDe(texto))
        expect(DOCS_PUBLICOS.some((g) => g.idioma === idioma && g.ruta === ruta)).toBe(true);
      // Y la dirección va una sola vez, al final (no suelta en medio del texto).
      expect(texto.split('\n').slice(0, -1).join('\n')).not.toMatch(/divoox\.com/);
    },
  );

  it('con IA: quita los enlaces inventados, pone el de la guía usada, en el idioma de la persona, y dos si usó dos', async () => {
    expect(
      conEnlacesDeGuia(
        'Abre Moto y elige tu destino. Mira https://divoox.com/docs/ordering/no-existe y también divoox.com/docs/ordering/ride-moto.',
        'es',
      ),
    ).toBe(
      'Abre Moto y elige tu destino.\n\nVer la guía con capturas → https://divoox.com/es/docs/ordering/ride-moto',
    );
    // Sin enlace en el texto: el de la guía de la que salió la respuesta.
    expect(conEnlacesDeGuia('Toca «Solicitar moto».', 'en', ['ordering/ride-moto'])).toBe(
      'Toca «Solicitar moto».\n\nSee the guide with screenshots → https://divoox.com/docs/ordering/ride-moto',
    );
    // Dos guías: las dos, una por línea. Tres: solo dos.
    const dos = conEnlacesDeGuia(
      'Paga en mano.\nGuía completa: https://divoox.com/es/docs/ordering/ride-moto-pago\n[Cupones](https://divoox.com/es/docs/ordering/coupons)\nhttps://divoox.com/es/docs/ordering/ride-moto',
      'es',
    );
    expect(dos.split('\n').slice(-2)).toEqual([
      'Ver la guía con capturas → https://divoox.com/es/docs/ordering/ride-moto-pago',
      'Ver la guía con capturas → https://divoox.com/es/docs/ordering/coupons',
    ]);
    expect(dos.startsWith('Paga en mano.\n\nVer la guía')).toBe(true);
    // Una guía que no existe y ninguna usada: sin enlace (nunca uno inventado).
    expect(conEnlacesDeGuia('Listo. https://divoox.com/docs/x/y', 'es')).toBe('Listo.');
    expect(conEnlacesDeGuia('Gracias a ti.', 'es')).toBe('Gracias a ti.');

    const e = await escenario();
    modelo(async (_env, pedido) => {
      const yaBusco = JSON.stringify(pedido).includes('functionResponse');
      return yaBusco
        ? {
            partes: [{ text: 'Abre Moto, elige tu destino y toca «Solicitar moto».' }],
            entrada: 10,
            salida: 10,
          }
        : {
            partes: [{ functionCall: { name: 'buscar_respuesta', args: { tema: 'pedir moto' } } }],
            entrada: 10,
            salida: 10,
          };
    });
    const r = (await e.decir('¿cómo pido una moto?')).datos.respuesta as string;
    expect(r).toBe(
      'Abre Moto, elige tu destino y toca «Solicitar moto».\n\nVer la guía con capturas → https://divoox.com/es/docs/ordering/ride-moto',
    );
  });

  it('el chat la pinta como enlace que se toca y el correo como su botón, sin repetir la etiqueta', () => {
    const texto =
      'Abre Moto.\n1. Elige tu destino.\n\nVer la guía con capturas → https://divoox.com/es/docs/ordering/ride-moto';
    expect(trozosDeMensaje(texto)).toEqual([
      { texto: 'Abre Moto.\n1. Elige tu destino.' },
      {
        etiqueta: 'Ver la guía con capturas →',
        url: 'https://divoox.com/es/docs/ordering/ride-moto',
      },
    ]);
    // Una dirección de otro sitio no se vuelve enlace de guía.
    expect(trozosDeMensaje('Ver la guía con capturas → https://otro.com/docs/x')).toEqual([
      { texto: 'Ver la guía con capturas → https://otro.com/docs/x' },
    ]);
    const html = aHtml(texto, 'es');
    expect(html).toContain('>Ver la guía con capturas</a>');
    expect(html).toContain('href="https://divoox.com/es/docs/ordering/ride-moto"');
    expect(html).not.toContain('Ver la guía con capturas →');
    expect(
      aHtml(texto.replace('Ver la guía con capturas', 'See the guide with screenshots'), 'en'),
    ).toContain('>See the guide with screenshots</a>');
  });

  it('las respuestas curadas y la del saldo solo apuntan a guías que existen', () => {
    for (const idioma of ['es', 'en'] as const)
      for (const r of buscarEnDocs('saldo comision recargar empezar verificar soporte', idioma, 50))
        if (r.guia)
          expect(
            DOCS_PUBLICOS.some((g) => g.ruta === r.guia),
            r.guia,
          ).toBe(true);
    expect(DOCS_PUBLICOS.some((g) => g.ruta === 'drivers/driver-balance')).toBe(true);
  });
});

describe('C-CAMILA-CORTESIA: un saludo se contesta con un saludo, nunca con «no te entendí»', () => {
  const NO =
    /No estoy segura|not sure I understood|asistente virtual|virtual assistant|persona del equipo|someone on the team/i;
  const CASOS: [string, 'es' | 'en', RegExp][] = [
    ['Hola', 'es', /^¡Hola! ¿En qué te puedo ayudar\?$/],
    ['hola camila', 'es', /^¡Hola! ¿En qué te puedo ayudar\?$/],
    ['buenas', 'es', /^¡Hola! ¿En qué te puedo ayudar\?$/],
    ['Buenos días', 'es', /^¡Hola! ¿En qué te puedo ayudar\?$/],
    ['buenas tardes!', 'es', /^¡Hola!/],
    ['gracias', 'es', /^Con mucho gusto\./],
    ['Muchas gracias, Camila', 'es', /^Con mucho gusto\./],
    ['ok', 'es', /^Perfecto\./],
    ['listo', 'es', /^Perfecto\./],
    ['chao', 'es', /^¡Hasta luego!/],
    ['Hello', 'en', /^Hi! How can I help you\?$/],
    ['good morning', 'en', /^Hi! How can I help you\?$/],
    ['thanks', 'en', /^You are welcome\./],
    ['ok', 'en', /^Great\./],
    ['bye', 'en', /^Bye!/],
  ];
  it.each(CASOS)('sin IA: «%s» (%s)', async (texto, idioma, espera) => {
    const e = await escenario({ GEMINI_API_KEY: undefined });
    const r = (await e.decir(texto, undefined, idioma)).datos.respuesta as string;
    expect(r).toMatch(espera);
    expect(r).not.toMatch(NO);
    expect(await e.casos()).toBe(0);
  });
  it.each(CASOS)(
    'con IA: «%s» (%s) sale igual y no gasta una llamada',
    async (texto, idioma, espera) => {
      const e = await escenario();
      let llamadas = 0;
      modelo(async () => {
        llamadas += 1;
        return {
          partes: [{ text: 'No estoy segura de haberte entendido.' }],
          entrada: 1,
          salida: 1,
        };
      });
      const r = (await e.decir(texto, undefined, idioma)).datos.respuesta as string;
      expect(r).toMatch(espera);
      expect(r).not.toMatch(NO);
      expect(llamadas).toBe(0);
    },
  );
  it('saludar no cuenta como intento fallido ni abre un caso; y un saludo con pregunta sigue a la guía', async () => {
    const e = await escenario({ GEMINI_API_KEY: undefined });
    for (const t of ['hola', 'buenas', 'ok', 'gracias', 'chao', 'hola'])
      expect((await e.decir(t)).datos.respuesta).not.toMatch(NO);
    expect(await e.casos()).toBe(0);
    expect((await e.decir('Hola, ¿cómo pido una moto?')).datos.respuesta).toMatch(/Solicitar moto/);
    expect(cortesiaDe('hola necesito ayuda con mi cuenta')).toBeNull();
    expect(cortesiaDe('¡¡Hola!!')).toBe('saludo');
  });
});
