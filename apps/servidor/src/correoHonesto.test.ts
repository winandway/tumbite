import { afterEach, describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { usarTransporteCorreo } from './correo';
import { DISCULPA_CONFIRMACION, correoDeConfirmacion } from './avisos';
import { CORREO_FRENADO, CORREO_NO_SALIO } from './rutas/cuentas';

/**
 * C-CORREO-HONESTO (19 nov 2026, todos los países). Pasó en producción: una cuenta nueva con un
 * Gmail que no existe. Gmail respondió «550 5.1.1 does not exist», Cloudflare bloqueó la dirección y
 * el segundo envío volvió con `recipient_suppressed`; aun así la app decía «Te lo mandamos otra vez»
 * y el canario seguía en «ok» (el error vivía en la memoria de otra instancia).
 */
const ENV = { YAD_TOKEN: 'token-de-prueba-'.padEnd(40, 'x') };
const ES = { 'x-idioma': 'es' };
const BLOQUEADO =
  'El proveedor de correo rechazó el envío: email.sending.error.email.recipient_suppressed';

type Respuesta = { estado: number; cuerpo: Record<string, unknown> };
function transporte(responder: (para: string) => Respuesta) {
  const llamadas: string[] = [];
  usarTransporteCorreo(async (_url, init) => {
    const para = (JSON.parse(String(init.body)) as { to: { address: string }[] }).to[0]?.address;
    llamadas.push(para ?? '');
    const r = responder(para ?? '');
    return new Response(JSON.stringify(r.cuerpo), { status: r.estado });
  });
  return llamadas;
}
const bien = (): Respuesta => ({
  estado: 200,
  cuerpo: {
    success: true,
    message_id: 'm',
    rebotados: [],
    enviados_hoy: 10,
    incluidos_por_dia: 1000,
  },
});
const correoDe = async (m: ReturnType<typeof mundo>, token: string) =>
  (await m.llamar('GET', '/datos/cuentas/perfil', undefined, token)).datos.perfil as {
    correo: string;
    correoRebotado: boolean;
  };

describe('C-CORREO-HONESTO: el enlace de confirmación que no sale se dice como es', () => {
  afterEach(() => usarTransporteCorreo(null));

  it('dirección bloqueada por rebote: la app recibe la verdad y no se vuelve a escribir', async () => {
    let bloquear = false;
    const llamadas = transporte(() =>
      bloquear ? { estado: 502, cuerpo: { success: false, error: BLOQUEADO } } : bien(),
    );
    const m = mundo(ENV);
    const u = await m.cuenta('cliente', 'Vale Prueba');
    const { correo } = await correoDe(m, u.token);
    expect((await correoDe(m, u.token)).correoRebotado).toBe(false);

    // El primer correo «salió» pero Gmail lo rebotó: el proveedor bloquea la dirección.
    bloquear = true;
    const re = await m.llamar('POST', '/datos/cuentas/confirmar/reenviar', {}, u.token, ES);
    expect(re.estado).toBe(422);
    // C-REBOTE-TEMPORAL: «recipient_suppressed» es un freno del proveedor, no un buzón muerto: se dice
    // «por ahora» y la app no le pide cambiar el correo (un 5.1.1 sí; ver reboteTemporal.test.ts).
    expect(re.datos.error).toBe(CORREO_FRENADO);
    expect((await correoDe(m, u.token)).correoRebotado).toBe(false);

    // No se insiste con una dirección muerta: ni se llama al proveedor ni se dice «enviado».
    const antes = llamadas.filter((p) => p === correo).length;
    const otra = await m.llamar('POST', '/datos/cuentas/confirmar/reenviar', {}, u.token);
    expect(otra.estado).toBe(422);
    expect(llamadas.filter((p) => p === correo).length).toBe(antes);

    // Una dirección mal escrita no es una caída del sistema: el canario no se pone rojo, pero la cuenta.
    const salud = await m.llamar('GET', '/datos/salud');
    expect(salud.datos.piezas.correo).toBe('ok');
    expect(salud.datos.correo.rebotes24h).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(salud.datos)).not.toContain(correo);

    // Cambiar el correo a otra dirección que tampoco existe: se dice al momento, no «enviado».
    const otraCuenta = await m.cuenta('cliente', 'Otra Prueba');
    const muerta = `muerta-${Math.random().toString(36).slice(2)}@ejemplo.com`;
    const cambio = await m.llamar(
      'POST',
      '/datos/cuentas/correo',
      { correo: muerta, clave: 'clave-segura-1' },
      otraCuenta.token,
      ES,
    );
    expect(cambio.estado).toBe(422);
    expect(cambio.datos.error).toBe(CORREO_FRENADO);
    expect((await correoDe(m, otraCuenta.token)).correoRebotado).toBe(false);
  });

  it('en inglés el mensaje sale en inglés', async () => {
    transporte(() => ({ estado: 502, cuerpo: { success: false, error: BLOQUEADO } }));
    const m = mundo(ENV);
    const u = await m.cuenta('cliente', 'Sam Prueba');
    const re = await m.llamar('POST', '/datos/cuentas/confirmar/reenviar', {}, u.token, {
      'x-idioma': 'en',
    });
    expect(re.estado).toBe(422);
    expect(String(re.datos.error)).toContain('didn’t accept the message for now');
  });

  it('caída del servicio: la app dice que no salió y el canario lo ve desde cualquier instancia', async () => {
    let caido = false;
    transporte(() =>
      caido
        ? {
            estado: 429,
            cuerpo: { success: false, error: 'limite_alcanzado', codigo: 'limite_alcanzado' },
          }
        : bien(),
    );
    const m = mundo(ENV);
    const u = await m.cuenta('cliente', 'Rosa Prueba');
    caido = true;
    const re = await m.llamar('POST', '/datos/cuentas/confirmar/reenviar', {}, u.token, ES);
    expect(re.estado).toBe(503);
    expect(re.datos.error).toBe(CORREO_NO_SALIO);
    expect((await correoDe(m, u.token)).correoRebotado).toBe(false);

    // Otra instancia (memoria limpia) igual lo ve, porque quedó escrito en la base.
    usarTransporteCorreo(async () => new Response(JSON.stringify(bien().cuerpo)));
    const salud = await m.llamar('GET', '/datos/salud');
    expect(salud.datos.piezas.correo).toBe('error');
    expect(salud.datos.correo.fallos24h).toBe(1);
  });

  it('el registro dice si el enlace salió de verdad', async () => {
    transporte(() => ({ estado: 502, cuerpo: { success: false, error: BLOQUEADO } }));
    const m = mundo(ENV);
    const r = await m.llamar('POST', '/datos/cuentas/registro', {
      nombre: 'Lía Prueba',
      correo: `lia-${Math.random().toString(36).slice(2)}@ejemplo.com`,
      clave: 'clave-segura-1',
      rol: 'cliente',
    });
    expect(r.estado).toBe(201);
    expect(r.datos.correoEnviado).toBe(false);
  });

  it('alarma del cupo: al pasar del 80 % del día el canario avisa antes de quedarse sin correos', async () => {
    transporte(() => ({
      estado: 200,
      cuerpo: {
        success: true,
        message_id: 'm',
        rebotados: [],
        enviados_hoy: 820,
        incluidos_por_dia: 1000,
      },
    }));
    const m = mundo(ENV);
    await m.cuenta('cliente', 'Ana Prueba');
    const salud = await m.llamar('GET', '/datos/salud');
    expect(salud.datos.piezas.correo).toBe('error');
    expect(salud.datos.correo.cupoAlto).toBe(true);
  });

  it('la disculpa va solo en el reenvío por un problema nuestro, en los dos idiomas', async () => {
    const textos: string[] = [];
    usarTransporteCorreo(async (_u, init) => {
      textos.push((JSON.parse(String(init.body)) as { text: string }).text);
      return new Response(JSON.stringify(bien().cuerpo));
    });
    const base = { correo: 'ana@ejemplo.com', nombre: 'Ana', token: 't' };
    await correoDeConfirmacion(ENV as never, { ...base, idioma: 'es' });
    await correoDeConfirmacion(ENV as never, { ...base, idioma: 'en' });
    await correoDeConfirmacion(ENV as never, { ...base, idioma: 'es', disculpa: true });
    await correoDeConfirmacion(ENV as never, { ...base, idioma: 'en', disculpa: true });
    expect(textos[0]).not.toContain(DISCULPA_CONFIRMACION.es);
    expect(textos[1]).not.toContain(DISCULPA_CONFIRMACION.en);
    expect(textos[2]?.startsWith(DISCULPA_CONFIRMACION.es)).toBe(true);
    expect(textos[3]?.startsWith(DISCULPA_CONFIRMACION.en)).toBe(true);
    expect(textos[2]).toContain('confirm-email?token=t');
    expect(textos[3]).toContain('confirm-email?token=t');
  });
});
