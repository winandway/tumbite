import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { usarTransporteCorreo } from '../correo';
import { olvidarErrorWhatsapp, olvidarNumeroComprobado } from '../whatsapp';

/**
 * C-RECUPERAR-WHATSAPP (27 nov 2026, orden de Richard por Gerencia) — todos los países. Recuperar la
 * cuenta con un código por WhatsApp (o correo, o SMS de respaldo). Candados: el código vence, no sirve
 * dos veces, se respetan los topes, nunca se revela si la cuenta existe y se cierran las sesiones
 * viejas. Ninguna prueba le habla a Meta, a Twilio ni a un buzón de verdad: todo está simulado.
 */
const TWILIO = {
  TWILIO_ACCOUNT_SID: 'ACprueba0000000000000000000000000',
  TWILIO_AUTH_TOKEN: 'token-de-prueba-largo-123',
  TWILIO_FROM: '+13055550000',
};
const META = {
  WHATSAPP_ENCENDIDO: 'si',
  META_WHATSAPP_TOKEN: 'token-meta-de-prueba',
  META_WHATSAPP_PHONE_ID: '1000000000000001',
};
const ENV = { ...TWILIO, ...META, YAD_TOKEN: 'token-de-prueba-'.padEnd(40, 'x') };

type Salida = { canal: 'whatsapp' | 'sms' | 'correo'; para: string; texto: string };

function simular(opciones: { metaFalla?: boolean } = {}) {
  const salidas: Salida[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('graph.facebook.com') && (init?.method ?? 'GET') === 'GET')
      return new Response(JSON.stringify({ verified_name: 'Divoox' }), { status: 200 });
    if (u.includes('graph.facebook.com')) {
      const b = JSON.parse(String(init?.body)) as {
        to: string;
        template: { name: string; components: { parameters: { text: string }[] }[] };
      };
      if (opciones.metaFalla)
        return new Response(JSON.stringify({ error: { code: 131026 } }), { status: 400 });
      salidas.push({
        canal: 'whatsapp',
        para: b.to,
        texto: b.template.components[0]!.parameters[0]!.text,
      });
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.rec' }] }), { status: 200 });
    }
    if (u.includes('api.twilio.com')) {
      const b = new URLSearchParams(String(init?.body));
      salidas.push({ canal: 'sms', para: b.get('To') ?? '', texto: b.get('Body') ?? '' });
      return new Response(JSON.stringify({ sid: `SM${salidas.length}` }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  });
  usarTransporteCorreo(async (_url, init) => {
    const c = JSON.parse(String(init.body)) as {
      to: { address: string }[];
      subject: string;
      text: string;
    };
    salidas.push({ canal: 'correo', para: c.to[0]!.address, texto: `${c.subject}\n${c.text}` });
    return new Response(JSON.stringify({ success: true, message_id: 'm1', rebotados: [] }), {
      status: 200,
    });
  });
  return salidas;
}

type Mundo = ReturnType<typeof mundo>;
let n = 0;
/** Una cuenta con el celular confirmado (y el correo confirmado, salvo que se diga). */
async function cuentaConCelular(m: Mundo, opciones: { correoOk?: boolean } = {}) {
  n++;
  const telefono = `+1305555${String(3000 + n).padStart(4, '0')}`;
  const correo = `rec-${n}-${Math.random().toString(36).slice(2)}@ejemplo.com`;
  const r = await m.llamar('POST', '/datos/cuentas/registro', {
    nombre: 'Rosa Prueba',
    correo,
    clave: 'clave-segura-1',
    rol: 'cliente',
    idioma: 'es',
    telefono,
    verificaTelefono: true,
  });
  expect(r.estado).toBe(201);
  const id = r.datos.usuario.id as string;
  await m.DB.prepare(
    `UPDATE usuarios SET telefono_verificado_en = datetime('now'),
       correo_confirmado_en = ${opciones.correoOk === false ? 'NULL' : "datetime('now')"} WHERE id = ?`,
  )
    .bind(id)
    .run();
  return { id, token: r.datos.token as string, telefono, correo };
}
const codigoDe = (s: Salida | undefined) => /(\d{6})/.exec(s?.texto ?? '')?.[1] ?? '';

async function pedir(m: Mundo, identificador: string, canal = 'whatsapp') {
  return m.llamar('POST', '/datos/cuentas/recuperar/codigo', { identificador, canal });
}
async function verificar(m: Mundo, identificador: string, codigo: string) {
  return m.llamar('POST', '/datos/cuentas/recuperar/verificar', { identificador, codigo });
}

describe('C-RECUPERAR-WHATSAPP · recuperar la cuenta con un código', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    usarTransporteCorreo(null);
    olvidarErrorWhatsapp();
    olvidarNumeroComprobado();
  });

  it('por WhatsApp: el código llega al celular confirmado, abre la cuenta, cambia la clave, cierra las sesiones y avisa por correo', async () => {
    const salidas = simular();
    const m = mundo(ENV);
    const k = await cuentaConCelular(m);
    const antes = salidas.length;
    const r = await pedir(m, k.telefono);
    expect(r.estado).toBe(200);
    expect(r.datos).toMatchObject({ ok: true, venceEnMinutos: 5 });
    const wa = salidas.slice(antes).filter((s) => s.canal === 'whatsapp');
    expect(wa).toHaveLength(1);
    expect(wa[0]!.para).toBe(k.telefono.slice(1));
    const v = await verificar(m, k.telefono, codigoDe(wa[0]));
    expect(v.estado).toBe(200);
    expect(v.datos.cuentas).toHaveLength(1);
    const pase = v.datos.cuentas[0].pase as string;
    const ok = await m.llamar('POST', '/datos/cuentas/restablecer', {
      token: pase,
      clave: 'clave-nueva-77',
    });
    expect(ok.estado).toBe(200);
    // La sesión vieja quedó cerrada.
    expect((await m.llamar('GET', '/datos/cuentas/yo', undefined, k.token)).estado).toBe(401);
    // La clave nueva entra.
    const entra = await m.llamar('POST', '/datos/cuentas/entrar', {
      correo: k.correo,
      clave: 'clave-nueva-77',
    });
    expect(entra.estado).toBe(200);
    // Aviso por el OTRO canal (recuperó por WhatsApp → correo).
    const aviso = salidas.find(
      (s) => s.canal === 'correo' && s.texto.startsWith('Se cambió la contraseña de tu cuenta'),
    );
    expect(aviso?.para).toBe(k.correo);
    // Todo quedó en la auditoría.
    const { results } = await m.DB.prepare(
      'SELECT evento, canal FROM auditoria_recuperacion WHERE usuario_id = ? ORDER BY creado_en, rowid',
    )
      .bind(k.id)
      .all<{ evento: string; canal: string }>();
    expect(results.map((x) => x.evento)).toEqual([
      'codigo_enviado',
      'codigo_bueno',
      'clave_cambiada',
    ]);
    expect(results[2]!.canal).toBe('whatsapp');
  });

  it('el código vence a los 5 minutos', async () => {
    const salidas = simular();
    const m = mundo(ENV);
    const k = await cuentaConCelular(m);
    await pedir(m, k.telefono);
    const codigo = codigoDe(salidas.filter((s) => s.canal === 'whatsapp').at(-1));
    await m.DB.prepare(
      "UPDATE codigos_recuperacion SET creado_en = datetime('now', '-301 seconds')",
    ).run();
    const v = await verificar(m, k.telefono, codigo);
    expect(v.estado).toBe(409);
    expect(v.datos.cuentas).toBeUndefined();
  });

  it('el código no sirve dos veces', async () => {
    const salidas = simular();
    const m = mundo(ENV);
    const k = await cuentaConCelular(m);
    await pedir(m, k.telefono);
    const codigo = codigoDe(salidas.filter((s) => s.canal === 'whatsapp').at(-1));
    expect((await verificar(m, k.telefono, codigo)).estado).toBe(200);
    expect((await verificar(m, k.telefono, codigo)).estado).toBe(409);
  });

  it('el pase de la contraseña nueva tampoco sirve dos veces', async () => {
    const salidas = simular();
    const m = mundo(ENV);
    const k = await cuentaConCelular(m);
    await pedir(m, k.telefono);
    const v = await verificar(
      m,
      k.telefono,
      codigoDe(salidas.filter((s) => s.canal === 'whatsapp').at(-1)),
    );
    const pase = v.datos.cuentas[0].pase as string;
    expect(
      (await m.llamar('POST', '/datos/cuentas/restablecer', { token: pase, clave: 'clave-uno-11' }))
        .estado,
    ).toBe(200);
    expect(
      (await m.llamar('POST', '/datos/cuentas/restablecer', { token: pase, clave: 'clave-dos-22' }))
        .estado,
    ).toBe(410);
  });

  it('5 intentos como máximo: al sexto, ni el código bueno entra', async () => {
    const salidas = simular();
    const m = mundo(ENV);
    const k = await cuentaConCelular(m);
    await pedir(m, k.telefono);
    const codigo = codigoDe(salidas.filter((s) => s.canal === 'whatsapp').at(-1));
    const malo = codigo === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) expect((await verificar(m, k.telefono, malo)).estado).toBe(409);
    expect((await verificar(m, k.telefono, codigo)).estado).toBe(409);
  });

  it('3 envíos por hora por número: el cuarto se frena en el servidor', async () => {
    const salidas = simular();
    const m = mundo(ENV);
    const k = await cuentaConCelular(m);
    const antes = salidas.length;
    for (let i = 0; i < 3; i++) expect((await pedir(m, k.telefono)).estado).toBe(200);
    const cuarto = await pedir(m, k.telefono);
    expect(cuarto.estado).toBe(429);
    expect(salidas.slice(antes).filter((s) => s.canal === 'whatsapp')).toHaveLength(3);
    // Con otro dato de la misma cuenta (su correo), el mismo celular tampoco recibe un cuarto.
    expect((await pedir(m, k.correo, 'whatsapp')).estado).toBe(200);
    expect(salidas.slice(antes).filter((s) => s.canal === 'whatsapp')).toHaveLength(3);
    // Solo vale el último código enviado.
    const ultimos = salidas.filter((s) => s.canal === 'whatsapp');
    expect((await verificar(m, k.telefono, codigoDe(ultimos[0]))).estado).toBe(409);
    expect((await verificar(m, k.telefono, codigoDe(ultimos.at(-1)))).estado).toBe(200);
  });

  it('nunca revela si la cuenta existe: misma respuesta, mismo tope y nada sale', async () => {
    const salidas = simular();
    const m = mundo(ENV);
    const k = await cuentaConCelular(m);
    const existe = await pedir(m, k.telefono);
    const antes = salidas.length;
    const noExiste = await pedir(m, '+13055559999');
    const correoNo = await pedir(m, 'nadie-aqui@ejemplo.com', 'correo');
    expect(noExiste.estado).toBe(existe.estado);
    expect(noExiste.datos).toEqual(existe.datos);
    expect(correoNo.estado).toBe(200);
    expect(correoNo.datos).toEqual(existe.datos);
    expect(salidas.length).toBe(antes);
    // El tope también llega igual a una cuenta que no existe.
    await pedir(m, '+13055559999');
    await pedir(m, '+13055559999');
    expect((await pedir(m, '+13055559999')).estado).toBe(429);
    // Y el código «adivinado» de una cuenta que no existe responde igual que uno malo.
    const v = await verificar(m, '+13055559999', '123456');
    expect(v.estado).toBe(409);
    // El enlace de siempre por correo tampoco lo dice.
    const viejo = await m.llamar('POST', '/datos/cuentas/recuperar', {
      correo: 'nadie-aqui@ejemplo.com',
    });
    expect(viejo.estado).toBe(200);
    expect(viejo.datos).toEqual({ ok: true });
  });

  it('un celular sin confirmar no recibe código', async () => {
    const salidas = simular();
    const m = mundo(ENV);
    const k = await cuentaConCelular(m);
    await m.DB.prepare('UPDATE usuarios SET telefono_verificado_en = NULL WHERE id = ?')
      .bind(k.id)
      .run();
    const antes = salidas.length;
    expect((await pedir(m, k.telefono)).estado).toBe(200);
    expect(salidas.length).toBe(antes);
  });

  it('si WhatsApp falla, el código sale por SMS de respaldo', async () => {
    const salidas = simular({ metaFalla: true });
    const m = mundo(ENV);
    const k = await cuentaConCelular(m);
    const antes = salidas.length;
    expect((await pedir(m, k.telefono)).estado).toBe(200);
    const sms = salidas.slice(antes).filter((s) => s.canal === 'sms');
    expect(sms).toHaveLength(1);
    expect(sms[0]!.texto).toContain('recuperar tu cuenta');
    expect((await verificar(m, k.telefono, codigoDe(sms[0]))).estado).toBe(200);
  });

  it('por correo: el código llega al correo confirmado; y el correo sin confirmar no recibe nada', async () => {
    const salidas = simular();
    const m = mundo(ENV);
    const k = await cuentaConCelular(m);
    const antes = salidas.length;
    expect((await pedir(m, k.correo, 'correo')).estado).toBe(200);
    const correo = salidas.slice(antes).find((s) => s.canal === 'correo');
    expect(correo?.para).toBe(k.correo);
    expect(correo?.texto).toContain('Vence en 5 minutos');
    expect((await verificar(m, k.correo, codigoDe(correo))).estado).toBe(200);
    // C-RECUPERAR-POR-CELULAR: con el celular confirmado y el correo sin confirmar, el correo no recibe.
    const otra = await cuentaConCelular(m, { correoOk: false });
    const antes2 = salidas.length;
    expect((await pedir(m, otra.correo, 'correo')).estado).toBe(200);
    expect(salidas.slice(antes2).filter((s) => s.canal === 'correo')).toHaveLength(0);
  });
});
