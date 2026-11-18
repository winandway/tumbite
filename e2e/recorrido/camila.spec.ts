import { mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { devices, expect, test } from './fixtures';
import { sqlLocal } from './sqlLocal';

/**
 * C-CAMILA-CHAT y C-CAMILA-BUZON (17 nov 2026) en el navegador, de punta a punta y solo en esta
 * computadora: un conductor habla con soporte desde Ayuda en Divoox Driver; una
 * visita escribe en la burbuja de la web y pide una persona; el equipo responde desde el buzón del
 * superadmin y la visita ve la respuesta con «Una persona del equipo te va a responder aquí».
 * En español con El Vigía y en inglés con Novi (C-CAPTURAS-POR-IDIOMA).
 * Con CAPTURAS=1 guarda las capturas de Docs (docs/capturas/camila/) y las del superadmin en la
 * carpeta privada de la ayuda interna (nunca en el repositorio).
 */
const RAIZ = join(__dirname, '..', '..');
const STAGING = Boolean(process.env.RECORRIDO_URL);
const DATOS = STAGING
  ? null
  : (JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8')) as {
      url: string;
      clave: string;
    });
test.skip(STAGING, 'solo en esta computadora');
const CAPTURAS = process.env.CAPTURAS === '1';
const CARPETA = join(RAIZ, 'docs', 'capturas', 'camila');
const PRIVADA = join(homedir(), 'Divoox-privado', 'ayuda-interna', 'originales', 'camila');
if (CAPTURAS) {
  mkdirSync(CARPETA, { recursive: true });
  mkdirSync(PRIVADA, { recursive: true });
}
const sql = sqlLocal;

const CIUDADES = {
  es: {
    zona: {
      id: 'VE-MER-ELVIGIA',
      nombre: 'El Vigía',
      pais: 'VE',
      lat: 8.6219,
      lng: -71.6506,
      tz: 'America/Caracas',
    },
    conductor: 'José Rangel',
    visita: 'Carmen Duque',
    textos: {
      menu: 'Menú',
      ayuda: 'Ayuda',
      enviar: 'Enviar',
      burbuja: 'Habla con nuestro equipo de soporte',
      escribe: 'Escribe tu mensaje…',
      responder: 'Responder en el mismo hilo',
      enviarRespuesta: 'Enviar respuesta',
      aprendizaje: 'Aprendizaje',
      ajustes: 'Ajustes',
      fallos: 'Fallos reportados',
      marcar: 'Marcar arreglado y avisar',
      siMarcar: 'Sí, marcar arreglado y avisar',
      conversacion: 'Conversación',
    },
    preguntaDriver: '¿Cómo recargo mi saldo para recibir carreras?',
    fallo: {
      inicial: 'La app no me deja recargar el saldo',
      respuestas: [
        'Abrí la app, toqué Ganancias y toqué Recargar',
        'Que se abriera la pantalla para poner el código',
        'Sale un mensaje que dice «Intenta otra vez» y no pasa nada',
        'Me pasa siempre desde ayer',
      ],
      aviso: 'Antes de mandarla, tapa cualquier contraseña o número de tarjeta.',
      tipo: 'Pagos y cobros',
      aUno: /Camila le va a escribir a \d+ persona/,
      avisada: /Camila avisó a \d+ persona/,
    },
    preguntaWeb: '¿Qué necesito para manejar con Divoox en El Vigía?',
    rara: '¿Puedo llevar un pasajero con una mascota pequeña?',
    persona: 'Quiero hablar con una persona, por favor.',
    respuestaEquipo:
      'Hola, Carmen. Para manejar necesitas tu cédula, tu licencia y los papeles de tu moto. Te ayudo a cargarlos.',
    nombreEquipo: 'Soporte Divoox',
  },
  en: {
    zona: {
      id: 'US-MI-NOVI',
      nombre: 'Novi',
      pais: 'US',
      lat: 42.4806,
      lng: -83.4755,
      tz: 'America/Detroit',
    },
    conductor: 'Michael Brooks',
    visita: 'Emily Rider',
    textos: {
      menu: 'Menu',
      ayuda: 'Help',
      enviar: 'Send',
      burbuja: 'Talk to our support team',
      escribe: 'Write your message…',
      responder: 'Reply in the same thread',
      enviarRespuesta: 'Send reply',
      aprendizaje: 'Learning',
      ajustes: 'Settings',
      fallos: 'Reported issues',
      marcar: 'Mark fixed and notify',
      siMarcar: 'Yes, mark fixed and notify',
      conversacion: 'Conversation',
    },
    preguntaDriver: 'How do I top up my balance to get trips?',
    fallo: {
      inicial: 'The app won’t let me top up my balance',
      respuestas: [
        'I opened the app, tapped Earnings and tapped Top up',
        'That the screen to enter the code would open',
        'A message says “Try again” and nothing happens',
        'It happens every time since yesterday',
      ],
      aviso: 'Before sending it, cover any password or card number.',
      tipo: 'Payments',
      aUno: /Camila will write to \d+ (person|people)/,
      avisada: /Camila notified \d+ (person|people)/,
    },
    preguntaWeb: 'What do I need to drive with Divoox in Novi?',
    rara: 'Can I take a rider with a small pet?',
    persona: 'I want to talk to a person, please.',
    respuestaEquipo:
      'Hi, Emily. To drive you need your ID, your license and your vehicle documents. I’ll help you upload them.',
    nombreEquipo: 'Divoox Support',
  },
} as const;

for (const idioma of ['es', 'en'] as const) {
  test(`Camila: Driver, chat de la web y buzón (${idioma})`, async ({ browser, request }) => {
    test.setTimeout(300_000);
    const C = CIUDADES[idioma];
    const pre = idioma === 'es' ? '/es' : '';
    const id = `${Date.now().toString(36)}${idioma}`;
    let ip = 0;
    const cuenta = async (
      rol: string,
      nombre: string,
      correo = `camila.${rol}.${id}@recorrido.test`,
    ) => {
      const r = await request.post('/datos/cuentas/registro', {
        headers: { 'cf-connecting-ip': `10.98.${Math.floor(Math.random() * 250)}.${++ip}` },
        data: {
          nombre,
          correo,
          clave: DATOS!.clave,
          rol: rol === 'admin' ? 'cliente' : rol,
          idioma,
        },
      });
      expect(r.ok(), await r.text()).toBe(true);
      return { ...((await r.json()) as { token: string; usuario: { id: string } }), correo };
    };
    const h = (t: string) => ({ authorization: `Bearer ${t}`, 'x-idioma': idioma });

    // La ciudad y el equipo.
    const z = C.zona;
    sql(`INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa, idioma)
         VALUES ('${z.id}', '${z.nombre}', '${z.pais}', 'USD', '${z.tz}', ${z.lat}, ${z.lng}, 15, 1, '${idioma}')`);
    const admin = await cuenta('admin', C.nombreEquipo);
    sql(`UPDATE usuarios SET rol = 'admin' WHERE id = '${admin.usuario.id}'`);

    // Un conductor de la ciudad.
    const conductor = await cuenta('repartidor', C.conductor);
    sql(`INSERT INTO repartidores (usuario_id, conectado, zona_id) VALUES ('${conductor.usuario.id}', 0, '${z.id}')
         ON CONFLICT(usuario_id) DO UPDATE SET zona_id = excluded.zona_id`);

    // Divoox Driver: Ayuda y «Habla con soporte».
    const ctxRep = await browser.newContext({ ...devices['Pixel 7'], baseURL: DATOS!.url });
    await ctxRep.addInitScript(
      ([pase, idi, cuentaId]) => {
        localStorage.setItem('tumbite.idioma', idi);
        localStorage.setItem('tumbite.sesion', pase);
        localStorage.setItem(`divoox.permisos.${cuentaId}`, '1');
      },
      [conductor.token, idioma, conductor.usuario.id] as const,
    );
    const pr = await ctxRep.newPage();
    await pr.goto('/driver');
    await pr.getByLabel(C.textos.menu, { exact: true }).first().click({ timeout: 60_000 });
    await pr.getByText(C.textos.ayuda, { exact: true }).click();
    await expect(pr.getByTestId('ayuda-driver')).toBeVisible({ timeout: 30_000 });
    if (CAPTURAS) await pr.screenshot({ path: join(CARPETA, `camila-driver-ayuda-${idioma}.png`) });
    await pr.getByTestId('ayuda-hablar').click();
    await expect(pr.getByTestId('chat-soporte-app')).toBeVisible({ timeout: 30_000 });
    // Camila ya le escribió (la bienvenida de líder y el aviso del registro): se cuenta desde aquí.
    await pr.waitForTimeout(1500);
    const antes = await pr.getByTestId('chat-mensaje-camila').count();
    await pr.getByTestId('chat-soporte-casilla').fill(C.preguntaDriver);
    await pr.getByText(C.textos.enviar, { exact: true }).click();
    await expect(pr.getByTestId('chat-mensaje-persona')).toHaveCount(1, { timeout: 30_000 });
    await expect(pr.getByTestId('chat-mensaje-camila')).toHaveCount(antes + 1, {
      timeout: 30_000,
    });
    if (CAPTURAS) await pr.screenshot({ path: join(CARPETA, `camila-driver-chat-${idioma}.png`) });
    // C-CAMILA-REPORTAR: la respuesta de Camila se reporta sin salir de la app y queda marcada.
    await pr.getByTestId('chat-reportar').last().click();
    await expect(pr.getByTestId('chat-reportada')).toHaveCount(1, { timeout: 15_000 });
    // Es la misma conversación por la app: el canal queda «app».
    expect(
      String(
        sql(
          `SELECT m.canal FROM camila_mensajes m JOIN camila_personas p ON p.id = m.persona_id WHERE p.usuario_id = '${conductor.usuario.id}' AND m.autor = 'persona'`,
        )[0]?.canal,
      ),
    ).toBe('app');

    // C-CAMILA-FALLOS: el conductor cuenta un fallo; Camila hace las cuatro preguntas de técnico,
    // pide la captura (el bloque con sus dos botones) y, sin captura, le da el número F-….
    const responder = async (texto: string) => {
      const camilas = await pr.getByTestId('chat-mensaje-camila').count();
      await pr.getByTestId('chat-soporte-casilla').fill(texto);
      await pr.getByText(C.textos.enviar, { exact: true }).click();
      await expect(pr.getByTestId('chat-mensaje-camila')).toHaveCount(camilas + 1, {
        timeout: 30_000,
      });
    };
    await responder(C.fallo.inicial);
    for (const r of C.fallo.respuestas) await responder(r);
    const bloque = pr.getByTestId('chat-captura');
    await expect(bloque).toBeVisible({ timeout: 30_000 });
    await expect(bloque.getByTestId('captura-archivos')).toBeVisible();
    await expect(bloque.getByTestId('captura-camara')).toBeVisible();
    await expect(bloque).toContainText(C.fallo.aviso);
    if (CAPTURAS) {
      await bloque.scrollIntoViewIfNeeded();
      await pr.screenshot({ path: join(CARPETA, `camila-driver-captura-${idioma}.png`) });
    }
    const camilasAntes = await pr.getByTestId('chat-mensaje-camila').count();
    await bloque.getByTestId('captura-no-tengo').click();
    await expect(pr.getByTestId('chat-mensaje-camila')).toHaveCount(camilasAntes + 1, {
      timeout: 30_000,
    });
    await expect(pr.getByTestId('chat-mensaje-camila').last()).toContainText(/F-[A-Z0-9]{3,}/);
    await expect(pr.getByTestId('chat-captura')).toHaveCount(0);
    const codigoFallo = String(
      /F-[A-Z0-9]{3,}/.exec(
        (await pr.getByTestId('chat-mensaje-camila').last().textContent()) ?? '',
      )?.[0],
    );

    // La web: una visita sin cuenta escribe en la burbuja y pide una persona.
    const ctxWeb = await browser.newContext({
      viewport: { width: 1280, height: 860 },
      baseURL: DATOS!.url,
    });
    await ctxWeb.addInitScript((idi) => localStorage.setItem('tumbite.idioma', idi), idioma);
    const pw = await ctxWeb.newPage();
    await pw.goto(`${pre}/how-it-works`);
    await pw.getByRole('button', { name: C.textos.burbuja }).click();
    const chat = pw.getByTestId('chat-soporte');
    await expect(chat).toBeVisible();
    const escribir = async (texto: string, camilas: number) => {
      await chat.getByLabel(C.textos.escribe).fill(texto);
      await chat.getByRole('button', { name: C.textos.enviar, exact: true }).click();
      await expect(chat.getByTestId('chat-mensaje-camila')).toHaveCount(camilas, {
        timeout: 30_000,
      });
    };
    await escribir(C.preguntaWeb, 1);
    await escribir(C.rara, 2);
    await escribir(C.persona, 3);
    const visita = String(
      sql(
        `SELECT persona_id FROM camila_casos WHERE estado = 'abierto' ORDER BY creado_en DESC LIMIT 1`,
      )[0]?.persona_id ?? '',
    );
    expect(visita).not.toBe('');
    sql(`UPDATE camila_personas SET nombre = '${C.visita}' WHERE id = '${visita}'`);

    // El superadmin: bandeja, conversación (responde en el mismo hilo), aprendizaje, líderes y ajustes.
    const { ruta } = (await (
      await request.get('/datos/admin/ruta', { headers: h(admin.token) })
    ).json()) as { ruta: string | null };
    const panel = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await panel.addCookies([
      { name: 'tumbite_sesion', value: admin.token, domain: 'localhost', path: '/' },
    ]);
    await panel.addInitScript((idi) => localStorage.setItem('tumbite.idioma', idi), idioma);
    const sp = await panel.newPage();
    // La dirección corta /panel/camila lleva al buzón bajo la dirección del superadmin.
    await sp.goto(`${DATOS!.url}/panel/camila`);
    await expect
      .poll(() => new URL(sp.url()).pathname, { timeout: 30_000 })
      .toBe(`/panel/${ruta ? `${ruta}/` : ''}camila`);
    const bandeja = sp.getByTestId('camila-bandeja');
    await expect(bandeja).toContainText(C.visita, { timeout: 30_000 });
    const sobra = await sp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra).toBeLessThanOrEqual(0);
    if (CAPTURAS)
      await sp
        .getByTestId('super-camila')
        .screenshot({ path: join(PRIVADA, `bandeja-${idioma}.png`) });
    await bandeja.getByText(C.visita).first().click();
    const hilo = sp.getByTestId('camila-hilo');
    await expect(hilo).toContainText(C.persona, { timeout: 30_000 });
    await hilo.getByLabel(C.textos.responder).fill(C.respuestaEquipo);
    await hilo.getByRole('button', { name: C.textos.enviarRespuesta }).click();
    await expect(hilo).toContainText(C.respuestaEquipo, { timeout: 30_000 });
    if (CAPTURAS)
      await sp
        .getByTestId('super-camila')
        .screenshot({ path: join(PRIVADA, `conversacion-${idioma}.png`) });

    // La visita ve la respuesta del equipo en su chat, con el aviso.
    await pw.reload();
    await pw.getByRole('button', { name: C.textos.burbuja }).click();
    await expect(pw.getByTestId('chat-equipo-atiende')).toBeVisible({ timeout: 30_000 });
    await expect(pw.getByTestId('chat-mensaje-equipo')).toContainText(C.respuestaEquipo);
    if (CAPTURAS) await pw.screenshot({ path: join(CARPETA, `camila-web-chat-${idioma}.png`) });
    // En el celular, el chat ocupa la pantalla y nada se sale de los costados.
    const ctxWebMovil = await browser.newContext({ ...devices['Pixel 7'], baseURL: DATOS!.url });
    await ctxWebMovil.addInitScript(
      ([idi, ficha]) => {
        localStorage.setItem('tumbite.idioma', idi);
        localStorage.setItem('divoox.camila.visita', ficha);
        localStorage.setItem('divoox.camila.converso', '1');
      },
      [
        idioma,
        await pw.evaluate(() => localStorage.getItem('divoox.camila.visita') ?? ''),
      ] as const,
    );
    const pm = await ctxWebMovil.newPage();
    await pm.goto(`${pre}/`);
    await pm.getByRole('button', { name: C.textos.burbuja }).click();
    await expect(pm.getByTestId('chat-mensaje-equipo')).toBeVisible({ timeout: 30_000 });
    const sobraMovil = await pm.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(sobraMovil).toBeLessThanOrEqual(0);
    if (CAPTURAS)
      await pm.screenshot({ path: join(CARPETA, `camila-web-chat-movil-${idioma}.png`) });

    // Aprendizaje: lo que Camila no supo responder entra a la lista con «Armar la lista ahora».
    await sp.getByRole('tab', { name: C.textos.aprendizaje }).click();
    await sp.getByTestId('camila-aprendizaje').getByRole('button').first().click();
    const propuesta = sp.locator('[data-testid^="camila-propuesta-"]').first();
    await expect(propuesta).toBeVisible({ timeout: 30_000 });
    if (CAPTURAS) await propuesta.screenshot({ path: join(PRIVADA, `aprendizaje-${idioma}.png`) });
    await sp.getByRole('tab', { name: C.textos.ajustes }).click();
    await expect(sp.getByTestId('camila-ajustes')).toBeVisible({ timeout: 30_000 });
    if (CAPTURAS)
      await sp
        .getByTestId('camila-ajustes')
        .screenshot({ path: join(PRIVADA, `ajustes-${idioma}.png`) });

    // C-CAMILA-FALLOS: el fallo aparece con su contador (los reportes parecidos de otras corridas
    // se suman al mismo fallo); se marca arreglado y Camila avisa.
    await sp.getByRole('tab', { name: C.textos.fallos }).click();
    const listaFallos = sp.getByTestId('camila-lista-fallos');
    await expect(listaFallos).toContainText(codigoFallo, { timeout: 30_000 });
    await expect(listaFallos).toContainText(C.fallo.tipo);
    if (CAPTURAS)
      await sp
        .getByTestId('super-camila')
        .screenshot({ path: join(PRIVADA, `fallos-${idioma}.png`) });
    await listaFallos.getByText(codigoFallo).click();
    const ficha = sp.getByTestId('camila-ficha-fallo');
    await expect(ficha).toContainText(C.fallo.respuestas[0]!, { timeout: 30_000 });
    await ficha.getByRole('button', { name: C.textos.marcar }).click();
    await expect(sp.getByTestId('camila-confirmar-arreglo')).toContainText(C.fallo.aUno);
    if (CAPTURAS) {
      // La ficha arriba (el fallo, la confirmación y el primer reporte), a lo ancho de la pantalla.
      await sp.evaluate(() => window.scrollTo(0, 0));
      await sp.screenshot({ path: join(PRIVADA, `fallo-${idioma}.png`) });
    }
    await sp
      .getByTestId('camila-confirmar-arreglo')
      .getByRole('button', { name: C.textos.siMarcar })
      .click();
    await expect(ficha.getByRole('status')).toContainText(C.fallo.avisada, { timeout: 30_000 });
    expect(
      Number(
        sql(
          `SELECT COUNT(*) AS n FROM camila_mensajes m JOIN camila_personas p ON p.id = m.persona_id WHERE p.usuario_id = '${conductor.usuario.id}' AND m.autor = 'camila' AND m.texto LIKE '%${codigoFallo}%'`,
        )[0]?.n,
      ),
    ).toBe(2);

    // Se deja como estaba: la conversación vuelve a Camila y el caso se cierra.
    await request.post(`/datos/admin/camila/hilos/${visita}/devolver`, { headers: h(admin.token) });
    sql(`UPDATE camila_casos SET estado = 'cerrado' WHERE persona_id = '${visita}'`);
    await ctxRep.close();
    await ctxWeb.close();
    await ctxWebMovil.close();
    await panel.close();
  });
}
