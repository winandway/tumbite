import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { olvidarErrorWhatsapp, olvidarNumeroComprobado } from '../whatsapp';

/**
 * C-GUIONES-SIN-CODIGO-REAL (23 nov 2026, Gerencia). Desde que el código de verificación sale por
 * WhatsApp, el recorrido automático del sitio de pruebas le mandaba códigos REALES a los celulares
 * ficticios de sus cuentas: Meta los devolvía «no entregado», la salud quedaba en rojo media hora y
 * frenaba la publicación de todos; además el conductor del guion quedaba parado en la puerta del
 * código. Regla: SOLO en el sitio de pruebas, a una cuenta de guion (correo de un dominio reservado
 * que no puede existir: «.test» o «.invalid») no se le pide ni se le manda el código por ningún canal
 * real. Una persona que prueba con su correo de verdad sigue recibiéndolo, y producción no cambia
 * nada: ahí el canario sigue igual de estricto.
 */
const META = {
  WHATSAPP_ENCENDIDO: 'si',
  META_WHATSAPP_TOKEN: 'token-meta-de-prueba',
  META_WHATSAPP_PHONE_ID: '1000000000000001',
};
const TWILIO = {
  TWILIO_ACCOUNT_SID: 'ACprueba0000000000000000000000000',
  TWILIO_AUTH_TOKEN: 'token-de-prueba-largo-123',
  TWILIO_FROM: '+13055550000',
};
const PRUEBAS = 'staging.tumbite.com';
const PRODUCCION = 'divoox.com';

/** Los proveedores, simulados: cuenta lo que saldría de verdad. Meta contesta «aceptado». */
function simular() {
  const salieron: string[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('graph.facebook.com') && (init?.method ?? 'GET') === 'GET')
      return new Response(
        JSON.stringify({ verified_name: 'Divoox', code_verification_status: 'VERIFIED' }),
        { status: 200 },
      );
    if (u.includes('graph.facebook.com')) {
      salieron.push('whatsapp');
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.guion' }] }), { status: 200 });
    }
    if (u.includes('api.twilio.com')) {
      salieron.push('sms');
      return new Response(JSON.stringify({ sid: 'SM1' }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  });
  return salieron;
}

type Mundo = ReturnType<typeof mundo>;
async function registrar(m: Mundo, correo: string, rol: 'cliente' | 'repartidor' = 'repartidor') {
  const r = await m.llamar('POST', '/datos/cuentas/registro', {
    nombre: 'Persona De Guion',
    correo,
    clave: 'clave-segura-1',
    rol,
    idioma: 'en',
    telefono: '+13055550142',
    verificaTelefono: true,
  });
  expect(r.estado, JSON.stringify(r.datos)).toBe(201);
  return { token: r.datos.token as string, id: r.datos.usuario.id as string };
}
const filasDeCodigo = async (m: Mundo, id: string) =>
  Number(
    (
      await m.DB.prepare('SELECT COUNT(*) AS n FROM sms_enviados WHERE usuario_id = ?')
        .bind(id)
        .first<{ n: number }>()
    )?.n ?? 0,
  );

describe('C-GUIONES-SIN-CODIGO-REAL · el recorrido del sitio de pruebas no manda códigos de verdad', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    olvidarErrorWhatsapp();
    olvidarNumeroComprobado();
  });

  for (const dominio of ['recorrido.test', 'internacional.test', 'prueba.invalid'])
    it(`en el sitio de pruebas, la cuenta de guion (@${dominio}) no tiene puerta y no sale nada`, async () => {
      const salieron = simular();
      const m = mundo({ ...TWILIO, ...META }, { host: PRUEBAS });
      const rep = await registrar(m, `repartidor.123@${dominio}`);
      const puerta = await m.llamar('GET', '/datos/cuentas/telefono', undefined, rep.token);
      expect(puerta.estado).toBe(200);
      expect(puerta.datos.puerta).toBeNull();
      // Aunque el guion lo pida a mano, no sale por ningún canal.
      const pedir = await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, rep.token);
      expect(pedir.estado).toBe(409);
      expect(salieron).toEqual([]);
      expect(await filasDeCodigo(m, rep.id)).toBe(0);
      // Y la salud no se pone en rojo por culpa del guion.
      const salud = await m.llamar('GET', '/datos/salud');
      expect(salud.datos.piezas.whatsapp).toBe('ok');
    });

  it('en el sitio de pruebas, una persona con su correo de verdad sí recibe el código por WhatsApp', async () => {
    const salieron = simular();
    const m = mundo({ ...TWILIO, ...META }, { host: PRUEBAS });
    const cli = await registrar(m, 'persona.real@ejemplo.com', 'cliente');
    const puerta = await m.llamar('GET', '/datos/cuentas/telefono', undefined, cli.token);
    expect(puerta.datos.puerta).toMatchObject({ motivo: 'registro', obligatorio: true });
    const pedir = await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, cli.token);
    expect(pedir.estado).toBe(200);
    expect(salieron).toEqual(['whatsapp']);
  });

  it('en producción no hay excepción: el mismo correo de guion pasa por la puerta y el código sale', async () => {
    const salieron = simular();
    // Ni siquiera una variable sembrada a mano abre la excepción fuera del sitio de pruebas.
    const m = mundo({ ...TWILIO, ...META, SITIO_DE_PRUEBAS: 'si' }, { host: PRODUCCION });
    const rep = await registrar(m, 'repartidor.123@recorrido.test');
    const puerta = await m.llamar('GET', '/datos/cuentas/telefono', undefined, rep.token);
    expect(puerta.datos.puerta).toMatchObject({ motivo: 'registro', obligatorio: true });
    const pedir = await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, rep.token);
    expect(pedir.estado).toBe(200);
    expect(salieron).toEqual(['whatsapp']);
    expect(await filasDeCodigo(m, rep.id)).toBe(1);
  });

  it('en la computadora del programador tampoco: el recorrido local cruza la puerta de verdad', async () => {
    simular();
    const m = mundo({ ...TWILIO, ...META });
    const rep = await registrar(m, 'repartidor.123@recorrido.test');
    const puerta = await m.llamar('GET', '/datos/cuentas/telefono', undefined, rep.token);
    expect(puerta.datos.puerta).toMatchObject({ motivo: 'registro' });
  });
});
