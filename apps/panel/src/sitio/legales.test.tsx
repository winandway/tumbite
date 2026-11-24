import { describe, expect, it } from 'vitest';
import {
  BORRAR_CUENTA,
  PRIVACIDAD,
  SOPORTE,
  TERMINOS,
  TERMINOS_REPARTIDORES,
  TERMINOS_RESTAURANTES,
} from './legales';

/**
 * Candado C-LEGALES-TIENDAS: lo que Apple (5.1.1) y Google Play (datos de usuario y borrado
 * de cuenta) revisan. Si alguien recorta un texto y quita una pieza exigida, esto se pone rojo.
 */
const texto = (d: { secciones: { titulo: string; parrafos: string[] }[]; intro?: string }) =>
  [d.intro ?? '', ...d.secciones.flatMap((s) => [s.titulo, ...s.parrafos])].join(' ');

describe('política de privacidad lista para las tiendas', () => {
  for (const idioma of ['es', 'en'] as const) {
    const p = texto(PRIVACIDAD[idioma]);
    it(`(${idioma}) nombra a la empresa y un contacto de privacidad`, () => {
      expect(p).toContain('Windoce, LLC');
      expect(p).toContain('soporte+divoox@windoce.com');
    });
    it(`(${idioma}) dice cuánto tiempo se guardan los datos y cómo borrarlos`, () => {
      expect(PRIVACIDAD[idioma].secciones.some((s) => s.id && /tiempo|long/i.test(s.titulo))).toBe(
        true,
      );
      expect(p).toContain('/delete-account');
      expect(p).toMatch(/30 (días|days)/);
    });
    it(`(${idioma}) explica ubicación, terceros con igual protección y que no se venden datos`, () => {
      expect(p).toMatch(/Stripe/);
      expect(p).toMatch(/igual o mayor|at least as well/);
      expect(p).toMatch(/no vendemos|don’t sell/i);
      expect(p).toMatch(/ubicación|location/i);
    });
  }
});

describe('mensajes de texto (verificación de Twilio y CTIA), C-SMS-LEGAL', () => {
  for (const idioma of ['es', 'en'] as const) {
    // C-SMS-CONSENTIMIENTO (9 nov 2026, Twilio 30513): Privacidad Y Términos llevan la sección
    // completa: casilla aparte y sin marcar, qué se envía, frecuencia, tarifas, STOP/HELP y que el
    // número no se vende ni se comparte para publicidad.
    for (const doc of [PRIVACIDAD, TERMINOS]) {
      const p = texto(doc[idioma]);
      it(`(${idioma}) ${doc[idioma].titulo}: cómo se aceptan, STOP/HELP, tarifas y que el número no se comparte`, () => {
        expect(doc[idioma].secciones.some((s) => s.id === 'sms')).toBe(true);
        expect(p).toMatch(/STOP/);
        expect(p).toMatch(/HELP/);
        expect(p).toMatch(/tarifas de mensajes y datos|Msg & data rates|Message and data rates/);
        expect(p).toMatch(/sin marcar|unchecked by default/);
        expect(p).toMatch(/no es una condición para comprar|not a condition of purchase/);
        expect(p).toMatch(/no compartimos|ni compartimos|do not sell or share|do not share/i);
        expect(p).toContain('sms-consent');
      });
    }
  }
});

describe('página pública para borrar la cuenta (Google Play)', () => {
  for (const idioma of ['es', 'en'] as const) {
    const b = BORRAR_CUENTA[idioma];
    it(`(${idioma}) tiene el botón directo, el pedido por correo y qué se borra y qué se guarda`, () => {
      expect(b.accion?.href).toBe('/panel/settings');
      const t = texto(b);
      expect(t).toContain('Divoox');
      expect(t).toContain('soporte+divoox@windoce.com');
      expect(b.secciones.length).toBeGreaterThanOrEqual(4);
    });
  }
});

describe('términos para cada público, en los dos idiomas', () => {
  it('existen y tienen contenido', () => {
    for (const doc of [TERMINOS, TERMINOS_RESTAURANTES, TERMINOS_REPARTIDORES, SOPORTE])
      for (const idioma of ['es', 'en'] as const)
        expect(doc[idioma].secciones.length).toBeGreaterThanOrEqual(3);
  });
  it('el repartidor queda como contratista independiente', () => {
    expect(texto(TERMINOS_REPARTIDORES.es)).toMatch(/contratista independiente/);
    expect(texto(TERMINOS_REPARTIDORES.en)).toMatch(/independent contractor/);
  });
});

/**
 * C-LEGALES-COHERENTES (18 nov 2026, auditor de tiendas): la política no se contradice entre
 * secciones y dice lo que el código hace de verdad.
 */
describe('la privacidad no se contradice', () => {
  const seccion = (idioma: 'es' | 'en', n: number) =>
    (PRIVACIDAD[idioma].secciones.find((s) => s.titulo.startsWith(`${n}.`))?.parrafos ?? []).join(
      ' ',
    );
  it('la contraseña: hash de una vía en la sección 2 y en la 9, nunca «cifrada»', () => {
    expect(seccion('es', 2)).toContain('hash de una vía');
    expect(seccion('es', 9)).toContain('hash de una vía');
    expect(seccion('es', 2)).not.toContain('la guardamos cifrada');
    expect(seccion('en', 2)).toContain('one-way hash');
    expect(seccion('en', 9)).toContain('one-way hash');
    expect(seccion('en', 2)).not.toContain('stored encrypted');
  });
  it('Flex: lo que se guarda tras borrar la cuenta lo dicen igual la sección 2 y la 6', () => {
    expect(seccion('es', 6)).toMatch(/Divoox Flex[^.]*siete años/);
    expect(seccion('en', 6)).toMatch(/Divoox Flex[^.]*seven years/);
    expect(seccion('es', 6)).toContain('tu posición en vivo en las rutas de Divoox Flex');
    expect(seccion('en', 6)).toContain('your live position on Divoox Flex routes');
  });
  // Tercera auditoría de tiendas (18 nov 2026): lo que la app recoge y la Data safety declara.
  it('sección 2: el chat de soporte con la asistente virtual y los reportes de sus respuestas', () => {
    expect(seccion('es', 2)).toContain('Chat de soporte con nuestra asistente virtual');
    expect(seccion('es', 2)).toContain('reportas una respuesta de la asistente');
    expect(seccion('en', 2)).toContain('Support chat with our virtual assistant');
    expect(seccion('en', 2)).toContain('report one of the assistant’s replies');
  });
  it('sección 2: alergias y dificultad auditiva como datos opcionales que da la persona', () => {
    expect(seccion('es', 2)).toMatch(/opcional[^.]*alergias|alergias[^.]*opcional/);
    expect(seccion('es', 2)).toMatch(/opcional[^.]*dificultad auditiva/);
    expect(seccion('en', 2)).toMatch(/optional[^.]*allerg|allerg[^.]*optional/);
    expect(seccion('en', 2)).toMatch(/optional[^.]*hearing/);
  });
  it('sección 4: la ubicación del conductor sigue con la pantalla apagada o en segundo plano', () => {
    expect(seccion('es', 4)).toContain('con la pantalla apagada o la app en segundo plano');
    expect(seccion('en', 4)).toContain('with the screen off or the app in the background');
  });
  it('sección 5: lo que se escribe en las casillas de dirección va a Google', () => {
    expect(seccion('es', 5)).toContain('lo que escribes en las casillas de dirección');
    expect(seccion('en', 5)).toContain('what you type in address fields');
  });
  it('sección 6: el borrado incluye los códigos de invitación, igual que borrar la cuenta', () => {
    expect(seccion('es', 6)).toContain('tus códigos de invitación');
    expect(seccion('en', 6)).toContain('your invite codes');
  });
  it('Stripe: se borra lo que escribiste para cobrar; de Stripe solo guardamos la referencia', () => {
    expect(seccion('es', 6)).toContain('la referencia de tu cuenta de Stripe');
    expect(seccion('en', 6)).toContain('the reference to your Stripe account');
  });
});

describe('borrar la cuenta lista todo lo que se borra', () => {
  const que = (idioma: 'es' | 'en') =>
    (
      BORRAR_CUENTA[idioma].secciones.find((s) => /Qué se borra|What gets deleted/.test(s.titulo))
        ?.parrafos ?? []
    ).join(' ');
  it('el chat con la asistente virtual, los lugares guardados y los códigos de invitación', () => {
    expect(que('es')).toContain('el chat con nuestra asistente virtual');
    expect(que('es')).toContain('tus lugares guardados');
    expect(que('es')).toContain('tus códigos de invitación');
    expect(que('en')).toContain('the chat with our virtual assistant');
    expect(que('en')).toContain('your saved places');
    expect(que('en')).toContain('your invite codes');
  });
});

/**
 * C-PRIVACIDAD-REGALO-LINEAS (19 nov 2026) — todos los países. El auditor de tiendas dio NO APTO a
 * la candidata porque la política no contaba dos usos nuevos de datos: la ubicación del pasajero en
 * un viaje con regalo (antifraude, sin guardar el punto) y lo que comparten las líneas de taxi y
 * mototaxi (el líder ve nombre y teléfono; la emergencia avisa al líder y al segundo contacto con
 * nombre, teléfono y lugar). En ROJO antes de escribir los párrafos.
 */
describe('C-PRIVACIDAD-REGALO-LINEAS · la política cuenta el regalo y las líneas', () => {
  it('(es) ubicación del pasajero en un viaje con regalo, sin guardar el punto', () => {
    const p = texto(PRIVACIDAD.es);
    expect(p).toMatch(/regalo de Divoox.*una vez por minuto.*evitar fraudes/);
    expect(p).toMatch(/No guardamos ese punto/);
  });
  it('(en) rider location on a ride with a gift, without storing the point', () => {
    const p = texto(PRIVACIDAD.en);
    expect(p).toMatch(/Divoox gift.*once a minute.*prevent gift fraud/);
    expect(p).toMatch(/We do not store that point/);
  });
  it('(es y en) las líneas: qué ve el líder y a quién avisa la emergencia', () => {
    expect(texto(PRIVACIDAD.es)).toMatch(
      /Líneas de taxi y mototaxi.*líder.*nombre y tu teléfono.*segundo contacto.*mensaje de texto/,
    );
    expect(texto(PRIVACIDAD.en)).toMatch(
      /Taxi and moto-taxi lines.*leader.*name and phone number.*second contact.*text message/,
    );
  });
  it('la fecha de la política es la del cambio', () => {
    expect(PRIVACIDAD.es.actualizado).toContain('23 de noviembre de 2026');
    expect(PRIVACIDAD.en.actualizado).toContain('November 23, 2026');
  });
  it('C-TELEFONO-AL-REGISTRARSE: dice que el código al crear la cuenta es obligatorio y quién lo lleva', () => {
    expect(texto(PRIVACIDAD.en)).toContain(
      'When you sign up, we send a 6-digit code to confirm your phone number. It is required to create a new account where it is available.',
    );
    expect(texto(PRIVACIDAD.es)).toContain(
      'Al registrarte, te enviamos un código de 6 números para confirmar tu número de celular. Es obligatorio para crear una cuenta nueva donde está disponible.',
    );
    for (const doc of [PRIVACIDAD.es, PRIVACIDAD.en])
      for (const proveedor of ['WhatsApp Business Platform', 'SMS Masivo Venezuela', 'LabsMobile'])
        expect(texto(doc)).toContain(proveedor);
  });
  it('C-RASTRO: dice que se guardan la app, la versión, la red aproximada y el avance del registro', () => {
    expect(texto(PRIVACIDAD.es)).toMatch(
      /la app que usas y su versión.*Android, iPhone o un navegador.*país y la ciudad aproximados.*Avance de tu registro.*sin identificar a nadie/,
    );
    expect(texto(PRIVACIDAD.en)).toMatch(
      /the app you use and its version.*Android, iPhone or a browser.*approximate country and city.*Sign-up progress.*without identifying anyone/,
    );
  });
});

describe('C-PROMO-CONDICIONES: las condiciones de la promoción del primer viaje', () => {
  it('existen en los dos idiomas, con el tope de viajes, lo que cubre y hasta cuándo', async () => {
    const { CONDICIONES_PROMO } = await import('./legales');
    for (const idioma of ['es', 'en'] as const) {
      const d = CONDICIONES_PROMO[idioma];
      const texto = JSON.stringify(d);
      expect(d.secciones.length).toBeGreaterThanOrEqual(6);
      expect(texto).toContain('125');
      expect(texto).toMatch(/2 dólares|2 US dollars/);
      expect(texto).toMatch(/31 de diciembre de 2026|December 31, 2026/);
      expect(d.idiomaQueRige).toBeTruthy();
    }
  });

  it('no nombra ciudades: la app dice dónde está vigente (C-SIN-LISTA-DE-CIUDADES)', async () => {
    const { CONDICIONES_PROMO } = await import('./legales');
    expect(JSON.stringify(CONDICIONES_PROMO)).not.toMatch(/Vigía|Tucaní|Mérida|Miami|Novi/);
  });
});

describe('C-POLITICA-VERDAD-IA: la política dice lo que la app hace con las fotos de verificación', () => {
  it('dice que las fotos van a la IA de Google con permiso, y quién ve la foto de perfil del conductor', async () => {
    const { PRIVACIDAD } = await import('./legales');
    const es = JSON.stringify(PRIVACIDAD.es);
    const en = JSON.stringify(PRIVACIDAD.en);
    expect(es).toContain('analiza las fotos de tu verificación');
    expect(es).toContain(
      'Con tu permiso, que te pedimos una sola vez en Divoox Driver, en una pantalla propia antes de la primera foto',
    );
    expect(es).toContain('los pasajeros de tus viajes, junto con tu nombre de pila');
    expect(en).toContain('it analyzes your verification photos');
    expect(en).toContain(
      'With your permission, which we ask for once in Divoox Driver, on its own screen before the first photo',
    );
    expect(en).toContain('the riders on your trips see it, together with your first name');
    // B1 del sexto dictamen: la captura adjunta al chat de soporte también la lee Gemini.
    expect(es).toContain('y la captura de pantalla que adjuntes');
    expect(es).toContain('la lee la asistente virtual (Google Gemini) para entender el problema');
    expect(en).toContain('and any screenshot you attach');
    expect(en).toContain(
      'the virtual assistant (Google Gemini) reads it to understand the problem',
    );
    // C-PERMISO-IA-CHAT (Apple 5.1.2(i)): el chat pide permiso explícito antes del primer mensaje;
    // sin permiso nada va a la IA, y se puede retirar.
    // C-CHAT-WEB-SIN-MURO (23 nov 2026): la web informa con una línea; las apps piden permiso.
    expect(es).toContain(
      'En el chat de nuestra web, una línea debajo de la casilla te lo dice antes de enviar',
    );
    expect(es).toContain('En las apps te pedimos tu permiso explícito antes');
    expect(es).toContain('Prefiero que me atienda una persona');
    expect(es).toContain('nada de lo que escribas en ese chat se envía a ese servicio');
    expect(es).toContain('Puedes dar o retirar ese permiso cuando quieras');
    expect(es).toContain('salvo que hayas elegido que te atienda una persona');
    expect(en).toContain(
      'In the chat on our website, a line below the chat box tells you this before you send',
    );
    expect(en).toContain('In the apps, we ask for your explicit permission first');
    expect(en).toContain('I’d rather talk to a person');
    expect(en).toContain('nothing you write in that chat is sent to that service');
    expect(en).toContain('You can give or withdraw that permission at any time');
    expect(en).toContain('unless you chose to be helped by a person');
    expect(es).not.toMatch(/solo la ve nuestro equipo/);
    expect(en).not.toMatch(/only our team sees it/);
    // «Papeles del conductor» remite a la IA (séptima vuelta del auditor).
    expect(es).toContain(
      'estas fotos también se analizan con un servicio de inteligencia artificial',
    );
    expect(en).toContain('these photos are also analyzed with an artificial intelligence service');
    // Las frases viejas contradecían a la app.
    expect(es).not.toMatch(/no tus datos de pago ni tus documentos/);
    expect(en).not.toMatch(/not your payment details or documents/);
    expect(en).not.toMatch(
      /stored privately, only the Divoox team can see them, and they’re deleted/,
    );
  });
});

// C-PRIVACIDAD-EVENTOS-DRIVER (24 nov 2026): Driver manda eventos de uso (cámara abierta, foto
// tomada, subida fallida) ligados a la cuenta; Play exige declararlos y la política tiene que decirlo.
describe('eventos de uso de Driver para soporte y diagnóstico', () => {
  it('la política lo dice en español y en inglés', () => {
    const es = PRIVACIDAD.es.secciones.flatMap((s) => s.parrafos).join(' ');
    const en = PRIVACIDAD.en.secciones.flatMap((s) => s.parrafos).join(' ');
    expect(es).toMatch(/Uso de Divoox Driver para soporte y diagnóstico/);
    expect(es).toMatch(
      /abriste el asistente o la cámara.*tomaste una foto.*no se pudo tomar o subir/,
    );
    expect(es).toMatch(/ligados a tu cuenta/);
    expect(en).toMatch(/Use of Divoox Driver for support and diagnostics/);
    expect(en).toMatch(
      /opened the assistant or the camera.*took a photo.*could not be taken or uploaded/,
    );
    expect(en).toMatch(/linked to your account/);
  });
});
