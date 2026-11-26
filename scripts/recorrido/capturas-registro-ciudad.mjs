// C-REGISTRO-TODO-EL-PAIS · capturas REALES de la guía «Cómo registrarte desde cualquier ciudad»
// (Driver web contra el servidor local del recorrido). Español con una ciudad hispana, inglés con
// Estados Unidos (una ciudad SIN zona abierta, para que se vea la espera). Datos neutros.
// Antes: node scripts/recorrido/preparar.mjs, el servidor «recorrido-servidor» y un Twilio simulado
// que anote los mensajes en TWILIO_LOG (en EE. UU. se confirma el celular con el código por SMS).
// Uso: node scripts/recorrido/capturas-registro-ciudad.mjs <carpeta-salida> [es,en]
// Después: copiar a docs/capturas/ y pasar a WebP 540 px calidad 82 en apps/panel/public/docs/.
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local: lee el registro del Twilio simulado y elige textos por idioma */
/* global document, HTMLElement -- corren dentro de la página */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const U = process.env.RECORRIDO_URL ?? 'http://localhost:8790';
const S = process.argv[2];
const T = {
  es: {
    crear: '¿Eres nuevo? Crea tu cuenta',
    nombre: 'Nombre y apellido',
    correo: 'Correo',
    tel: 'Celular',
    clave: 'Contraseña',
    pais: 'VE',
    estado: 'V',
    q: 'mara',
    lugar: 'gn:3633009',
    cel: '41255501',
    persona: 'Conductor Ejemplo',
  },
  en: {
    crear: 'New here? Create your account',
    nombre: 'Full name',
    correo: 'Email',
    tel: 'Mobile phone',
    clave: 'Password',
    pais: 'US',
    estado: 'CA',
    q: 'sal',
    lugar: 'gn:5391295',
    cel: '40855501',
    persona: 'Sample Driver',
  },
};
const b = await chromium.launch();
try {
  for (const idioma of (process.argv[3] ?? 'es,en').split(',')) {
    const L = T[idioma];
    const ctx = await b.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      locale: idioma === 'es' ? 'es-US' : 'en-US',
      permissions: ['geolocation', 'notifications'],
      geolocation: { latitude: 0, longitude: 0 },
    });
    await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    const p = await ctx.newPage();
    const foto = async (paso, opciones = {}) => {
      await p.evaluate(
        () => document.activeElement instanceof HTMLElement && document.activeElement.blur(),
      );
      await p.waitForTimeout(500);
      await p.screenshot({ path: `${S}/registro-ciudad-${paso}-${idioma}.png`, ...opciones });
    };
    await p.goto(U + '/driver');
    await p.getByText(L.crear).click();
    await p.getByLabel(L.nombre).fill(L.persona);
    await p.getByTestId('pasos-siguiente').click();
    await p.getByTestId('registro-lugar').click();
    await p.getByTestId(`selector-lugar-pais-${L.pais}`).waitFor();
    await foto('pais', { clip: { x: 0, y: 0, width: 390, height: 420 } });
    await p.getByTestId(`selector-lugar-pais-${L.pais}`).click();
    await p.getByTestId(`selector-lugar-estado-${L.estado}`).waitFor();
    await foto('estado');
    await p.getByTestId(`selector-lugar-estado-${L.estado}`).click();
    await p.getByTestId('selector-lugar-buscar').fill(L.q);
    await p.getByTestId(`selector-lugar-ciudad-${L.lugar}`).waitFor();
    await foto('ciudad');
    await p.getByTestId(`selector-lugar-ciudad-${L.lugar}`).click();
    await p.getByTestId('pasos-siguiente').click();
    await p.getByLabel(L.correo).fill(`conductor.${Date.now()}@ejemplo.com`);
    await p.getByTestId('pasos-siguiente').click();
    await p.getByTestId('pais-telefono').click();
    await p.getByTestId(`pais-telefono-${L.pais}`).click();
    await p.getByLabel(L.tel).fill(L.cel + String(Math.floor(Math.random() * 90) + 10));
    await p.getByTestId('pasos-siguiente').click();
    await p.getByLabel(L.clave, { exact: true }).fill('Clave-de-ejemplo-123');
    await p.getByTestId('pasos-siguiente').click();
    await p.getByTestId('registro-acepto').click();
    await p.getByTestId('registro-continuar').click();
    await p.getByTestId('crear-mi-cuenta').click();
    // En EE. UU. se confirma el celular con el código por SMS (Twilio simulado anota el mensaje).
    const codigo = p.getByTestId('codigo-celular');
    if (
      await codigo.waitFor({ timeout: 8000 }).then(
        () => true,
        () => false,
      )
    ) {
      await p.waitForTimeout(1500);
      const sms =
        readFileSync(process.env.TWILIO_LOG ?? '.recorrido/twilio.log', 'utf8').match(
          /\b\d{6}\b/g,
        ) ?? [];
      await codigo.fill(sms.at(-1) ?? '');
      await p.waitForTimeout(800);
      const conf = p.getByText(idioma === 'es' ? 'Confirmar' : 'Confirm', { exact: true });
      if (await conf.count())
        await conf
          .first()
          .click({ timeout: 3000 })
          .catch(() => undefined);
      await p.getByTestId('celular-continuar').waitFor({ state: 'attached', timeout: 15000 });
      await p.getByTestId('celular-continuar').evaluate((e) => e.click());
    }
    await p
      .getByTestId('aviso-ia-casilla')
      .last()
      .waitFor({ state: 'attached', timeout: 30000 })
      .catch(async (e) => {
        console.log(
          'PANTALLA',
          (await p.locator('body').innerText()).replace(/\n+/g, ' | ').slice(0, 900),
        );
        throw e;
      });
    await p
      .getByTestId('aviso-ia-casilla')
      .last()
      .evaluate((e) => e.click());
    await p
      .getByTestId('aviso-ia-aceptar')
      .last()
      .evaluate((e) => e.click());
    const listo = p.getByText(idioma === 'es' ? 'Estoy listo' : /^I.m ready$/);
    await listo
      .first()
      .waitFor({ timeout: 30000 })
      .then(() => listo.first().click())
      .catch(() => console.log('sin hoja de permisos'));
    const aviso = p.getByTestId('aviso-lugar-en-espera');
    await aviso.waitFor({ timeout: 30000 }).catch(async (e) => {
      await p.screenshot({ path: `${S}/fallo-${idioma}.png` });
      console.log(
        'PANTALLA2',
        (await p.locator('body').innerText()).replace(/\n+/g, ' | ').slice(0, 900),
      );
      throw e;
    });
    await p.waitForTimeout(1500);
    await p.getByTestId('barra-activacion').scrollIntoViewIfNeeded();
    await foto('en-espera');
    // Lo que puede ir subiendo mientras espera: la lista «Te faltan N pasos para empezar».
    await p.getByTestId('que-te-falta').evaluate((e) => e.scrollIntoView({ block: 'start' }));
    await foto('papeles');
    await ctx.close();
  }
} finally {
  await b.close();
}
