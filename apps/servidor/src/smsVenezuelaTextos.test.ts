import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from './env';
import { mundo } from './pruebas/ayuda';
import { enviarSms } from './sms';
import { olvidarErrorSmsMasivo, saludSmsMasivo } from './smsMasivo';
import {
  LARGO_UN_SMS,
  cortoEmergenciaLinea,
  cortoEnvioDestinatario,
  cortoInvitarConductor,
  cortoPanico,
  cortoPaqueteEmpresa,
  cortoRegalo,
  cortoViajeCompartido,
  hablaDeDinero,
  sinAcentos,
  textoParaSmsVenezuela,
} from './smsVenezuelaTextos';
import { nuevoToken } from './cripto';

/**
 * C-SMS-VENEZUELA-TEXTOS (22 nov 2026, Venezuela): lo que sale por el proveedor de Venezuela va sin
 * montos ni datos de pago, sin acentos y en UN solo SMS. Proveedor simulado: ningún mensaje real.
 */
afterEach(() => {
  vi.unstubAllGlobals();
  olvidarErrorSmsMasivo();
});

const BASICO = /^[\x20-\x7e]+$/;
// El sitio con el nombre más largo que tenemos (el de pruebas) y un código de enlace real (43 letras).
const SITIO = 'https://staging.tumbite.com';
const codigo = () => nuevoToken();
const LARGUISIMO = 'María Fernanda de los Ángeles Rodríguez-Peñalver y Compañía Anónima';

describe('C-SMS-VENEZUELA-TEXTOS · la compuerta', () => {
  it('quita acentos, eñes y comillas: todo queda en el alfabeto básico de los SMS', () => {
    const t = sinAcentos(
      'Divoox: tu código es 123456. ¿Vence en 10 minutos? «No lo compartas» — año…',
    );
    expect(t).toBe('Divoox: tu codigo es 123456. Vence en 10 minutos? "No lo compartas" - ano...');
    expect(t).toMatch(BASICO);
  });

  it('el código de verificación sale entero, sin acentos y en un SMS, en los dos idiomas', () => {
    for (const original of [
      'Divoox: tu código es 123456. Vence en 10 minutos. No lo compartas.',
      "Divoox: your code is 123456. It expires in 10 minutes. Don't share it.",
    ]) {
      const r = textoParaSmsVenezuela(original);
      expect(r.bloqueado).toBeUndefined();
      expect(r.texto).toContain('123456');
      expect(r.texto).toMatch(BASICO);
      expect(r.texto!.length).toBeLessThanOrEqual(LARGO_UN_SMS);
    }
  });

  it('montos, saldos y datos de pago NO salen por este proveedor', () => {
    for (const t of [
      'Divoox: tu viaje costó $4,50',
      'Divoox: recibiste 12 USD',
      'Divoox: pagaste Bs. 350 en efectivo',
      'Divoox: tu saldo está por acabarse',
      'Divoox: tu tarjeta fue rechazada',
      'Divoox: paga por Pago Móvil al 0412',
      'Retiro pedido: 40 dólares',
      'Tu cuenta bancaria fue verificada',
    ]) {
      expect(hablaDeDinero(t), t).toBe(true);
      expect(textoParaSmsVenezuela(t), t).toEqual({ bloqueado: 'dinero' });
    }
    for (const t of [
      'Divoox: tu código es 123456. Vence en 10 minutos. No lo compartas.',
      'Divoox: Tu pedido llegó. Tu repartidor está en la puerta.',
      'Divoox PANICO Centro: el conductor Ana tel +584165550100 pide ayuda.',
    ])
      expect(hablaDeDinero(t), t).toBe(false);
  });

  it('un texto largo se acorta a un SMS sin partir el enlace', () => {
    const enlace = `${SITIO}/es/ride/${codigo()}`;
    const r = textoParaSmsVenezuela(
      `Divoox: ${LARGUISIMO} empezó un viaje larguísimo y lo compartió contigo para que lo sigas. Síguelo en vivo: ${enlace} y no lo pierdas de vista.`,
    );
    expect(r.texto!.length).toBeLessThanOrEqual(LARGO_UN_SMS);
    expect(r.texto!.endsWith(enlace)).toBe(true);
    const sinEnlace = textoParaSmsVenezuela('aviso '.repeat(60));
    expect(sinEnlace.texto!.length).toBeLessThanOrEqual(LARGO_UN_SMS);
    expect(sinEnlace.texto!.endsWith('aviso')).toBe(true);
  });
});

describe('C-SMS-VENEZUELA-TEXTOS · las versiones cortas caben enteras con los datos más largos', () => {
  const casos: [string, string, string[]][] = [];
  for (const i of ['es', 'en'] as const) {
    const ride = `${SITIO}${i === 'es' ? '/es' : ''}/ride/${codigo()}`;
    const regalo = `${SITIO}/order-status/${codigo()}`;
    const track = `${SITIO}${i === 'es' ? '/es' : ''}/track/DVX-1234-5678-9012`;
    const join = `${SITIO}/driver/join/${codigo()}`;
    casos.push(
      [
        `paquete de una persona (${i})`,
        cortoEnvioDestinatario(i, LARGUISIMO, ride, '123456'),
        [ride, '123456'],
      ],
      [`viaje compartido (${i})`, cortoViajeCompartido(i, LARGUISIMO, ride), [ride]],
      [`regalo (${i})`, cortoRegalo(i, LARGUISIMO, LARGUISIMO, regalo), [regalo]],
      [`paquete de una empresa (${i})`, cortoPaqueteEmpresa(i, LARGUISIMO, track), [track]],
      [`invitación a un conductor (${i})`, cortoInvitarConductor(i, LARGUISIMO, join), [join]],
    );
  }
  const persona = {
    nombre: LARGUISIMO,
    telefono: '+584165550100',
    lat: 8.612345678912,
    lng: -71.654321987654,
  };
  const mapa = 'https://maps.google.com/?q=8.61235,-71.65432';
  casos.push(
    [
      'pánico',
      cortoPanico(persona, 'el repartidor', 'Zona Centro Norte de Ejemplo'),
      [mapa, '+584165550100', 'Llamalo ya.'],
    ],
    [
      'emergencia de línea',
      cortoEmergenciaLinea(persona, 'Línea Ejemplo del Sur Larguísima'),
      [mapa, '+584165550100', 'Llamalo ya.'],
    ],
    [
      'pánico sin GPS ni teléfono',
      cortoPanico({ nombre: '', telefono: null }, 'el pasajero', 'Centro'),
      ['sin GPS', 'sin nombre'],
    ],
  );

  it.each(casos)('%s', (_nombre, corto, debeLlevar) => {
    // La compuerta lo deja IGUAL: ya venía sin acentos, sin dinero y dentro de un SMS (nada se recorta).
    expect(textoParaSmsVenezuela(corto)).toEqual({ texto: corto });
    expect(corto.length).toBeLessThanOrEqual(LARGO_UN_SMS);
    expect(corto).toMatch(BASICO);
    for (const pieza of debeLlevar) expect(corto).toContain(pieza);
  });
});

describe('C-SMS-VENEZUELA-TEXTOS · enviarSms usa la compuerta', () => {
  const VE = '+584165550100';
  const LLAVE = 'llave-de-prueba-0123456789';
  const env = {
    SMSMASIVO_API_KEY: LLAVE,
    SMSMASIVO_ENCENDIDO: 'si',
  } as unknown as Env;
  function simulado() {
    const mensajes: string[] = [];
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      mensajes.push(JSON.parse(String(init?.body)).message);
      return Response.json({ requestId: 'req-1', status: 'ACCEPTED' }, { status: 202 });
    });
    return mensajes;
  }
  async function persona() {
    const m = mundo();
    const u = await m.cuenta('cliente');
    await m.llamar('PUT', '/datos/cuentas/sms', { acepta: true, canal: 'app' }, u.token);
    const filas = () =>
      m.DB.prepare('SELECT tipo, estado, proveedor FROM sms_enviados ORDER BY creado_en, rowid')
        .all<{ tipo: string; estado: string; proveedor: string | null }>()
        .then((r) => r.results);
    return { m, u, filas };
  }

  it('manda la versión corta y sin acentos; el texto largo de siempre no sale por aquí', async () => {
    const { m, u, filas } = await persona();
    const mensajes = simulado();
    const enlace = `${SITIO}/es/ride/${codigo()}`;
    const ok = await enviarSms(env, m.DB, {
      usuarioId: u.id,
      pedidoId: null,
      tipo: 'envio_destinatario',
      telefono: VE,
      texto: `Divoox: Paula te envió un paquete. Síguelo en vivo: ${enlace} — Tu PIN de entrega: 1234. Dáselo solo a tu conductor al recibirlo.`,
      textoCorto: cortoEnvioDestinatario('es', 'Paula', enlace, '1234'),
    });
    expect(ok).toBe(true);
    expect(mensajes).toEqual([
      `Divoox: Paula te envio un paquete. Siguelo: ${enlace} PIN de entrega: 1234`,
    ]);
    expect(await filas()).toEqual([
      { tipo: 'envio_destinatario', estado: 'enviado', proveedor: 'smsmasivo' },
    ]);
  });

  it('un texto con un monto no se manda, no gasta, no cuenta en el tope y queda «bloqueado»', async () => {
    const { m, u, filas } = await persona();
    const mensajes = simulado();
    const ok = await enviarSms(env, m.DB, {
      usuarioId: u.id,
      pedidoId: null,
      tipo: 'equipo_retiro',
      telefono: VE,
      texto: 'Divoox: retiro pedido por $40,00',
    });
    expect(ok).toBe(false);
    expect(mensajes).toHaveLength(0);
    expect(await filas()).toEqual([
      { tipo: 'equipo_retiro', estado: 'bloqueado', proveedor: null },
    ]);
    // No es una avería del proveedor: el canario sigue en verde.
    expect(await saludSmsMasivo(env, m.DB)).toBe('ok');
  });
});
