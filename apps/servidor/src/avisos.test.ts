import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';
import { REMITENTES, usarTransporteCorreo } from './correo';

type Enviado = {
  from: { address: string };
  to: { address: string }[];
  subject: string;
  text: string;
};

function buzon() {
  const enviados: Enviado[] = [];
  usarTransporteCorreo(async (_url, init) => {
    enviados.push(JSON.parse(String(init.body)) as Enviado);
    return new Response(JSON.stringify({ success: true, message_id: 'm', rebotados: [] }), {
      status: 200,
    });
  });
  return enviados;
}
const ENV = {
  YAD_TOKEN: 'token-de-prueba-'.padEnd(40, 'x'),
  ADMIN_CORREOS: 'soporte@ejemplo.com, otro@ejemplo.com',
  STRIPE_SECRET_KEY: 'sk_test_x',
  STRIPE_WEBHOOK_SECRET: 'whsec_prueba',
};
const SECRETO = 'whsec_prueba';
async function firmar(cuerpo: string) {
  const t = Math.floor(Date.now() / 1000);
  const llave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRETO),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const firma = await crypto.subtle.sign('HMAC', llave, new TextEncoder().encode(`${t}.${cuerpo}`));
  const hex = [...new Uint8Array(firma)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `t=${t},v1=${hex}`;
}
const de = (lista: Enviado[], para: string) => lista.filter((e) => e.to[0]?.address === para);

describe('correos que el sitio manda solo', () => {
  afterEach(() => {
    usarTransporteCorreo(null);
    vi.unstubAllGlobals();
  });

  it('al registrarse llega el enlace de confirmación; sirve una vez y vence', async () => {
    const enviados = buzon();
    const m = mundo(ENV);
    const u = await m.cuenta('cliente', 'Rosa');
    const correo = (await m.llamar('GET', '/datos/cuentas/yo', undefined, u.token)).datos.usuario
      .correo as string;
    const c = de(enviados, correo)[0];
    expect(c?.from.address).toBe(REMITENTES.avisos.address);
    expect(c?.subject).toContain('Confirm your Tumbite email');
    const token = c?.text.match(/confirm-email\?token=(\S+)/)?.[1] ?? '';
    expect((await m.llamar('POST', '/datos/cuentas/confirmar', { token })).estado).toBe(200);
    const f = await m.DB.prepare('SELECT correo_confirmado_en FROM usuarios WHERE id = ?')
      .bind(u.id)
      .first<{ correo_confirmado_en: string | null }>();
    expect(f?.correo_confirmado_en).toBeTruthy();
    expect((await m.llamar('POST', '/datos/cuentas/confirmar', { token })).estado).toBe(410);
    const re = await m.llamar('POST', '/datos/cuentas/confirmar/reenviar', {}, u.token);
    expect(re.datos.yaConfirmado).toBe(true);
  });

  it('restaurante nuevo: aviso a cada administrador, con el dueño para responder', async () => {
    const enviados = buzon();
    const m = mundo(ENV);
    const dueno = await m.cuenta('restaurante', 'Luis');
    await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const admins = enviados.filter((e) => e.subject.startsWith('Restaurante nuevo'));
    expect(admins.map((e) => e.to[0]?.address).sort()).toEqual([
      'otro@ejemplo.com',
      'soporte@ejemplo.com',
    ]);
    expect(admins[0]?.text).toContain(RESTAURANTE_BASE.nombre);
    // Editar el restaurante no vuelve a avisar.
    await m.llamar(
      'PUT',
      '/datos/mi-restaurante',
      { ...RESTAURANTE_BASE, categoria: 'Pizza' },
      dueno.token,
    );
    expect(enviados.filter((e) => e.subject.startsWith('Restaurante nuevo'))).toHaveLength(2);
  });

  it('lista de espera: bienvenida en el idioma de la persona', async () => {
    const enviados = buzon();
    const m = mundo(ENV);
    await m.llamar('POST', '/datos/lista-espera', {
      tipo: 'repartidor',
      nombre: 'Sam',
      correo: 'sam@ejemplo.com',
      ciudad: 'Orlando',
      telefono: '4075550100',
      vehiculo: 'moto',
      idioma: 'en',
    });
    const c = de(enviados, 'sam@ejemplo.com')[0];
    expect(c?.from.address).toBe(REMITENTES.hola.address);
    expect(c?.subject).toBe("You're on the list, Sam");
    expect(c?.text).toContain('start delivering');
    // Abre un ticket: la persona recibe su enlace privado y el equipo recibe el aviso.
    expect(c?.text).toMatch(/https:\/\/tumbite\.com\/t\/[A-Za-z0-9_-]{40,}/);
    expect(de(enviados, 'soporte@ejemplo.com')[0]?.subject).toContain('Nuevo ticket');
  });

  it('pedido pagado: recibo al cliente y aviso al restaurante, una sola vez', async () => {
    const enviados = buzon();
    vi.stubGlobal('fetch', async (url: string) =>
      /\/(payment_intents|customers|customer_sessions)/.test(url)
        ? new Response(JSON.stringify({ id: 'cs_1', client_secret: 'cs_1_secret_x' }), {
            status: 200,
          })
        : new Response('{}', { status: 404 }),
    );
    const m = mundo(ENV);
    const dueno = await m.cuenta('restaurante', 'Luis');
    const admin = await m.cuenta('admin');
    const cliente = await m.cuenta('cliente', 'Rosa');
    const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    await m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${r.datos.restaurante.id}`,
      { estado: 'aprobado' },
      admin.token,
    );
    const p = await m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { nombreEs: 'Cubano', precioCentavos: 1500 },
      dueno.token,
    );
    await m.abrir(dueno.token);
    const pedido = await m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: r.datos.restaurante.id,
        lineas: [{ platoId: p.datos.plato.id, cantidad: 2 }],
        propinaCentavos: 400,
        direccion: '200 Calle Prueba, Miami',
        notas: 'Sin cebolla',
      },
      cliente.token,
    );
    const antes = enviados.length;
    const { app } = await import('./app');
    const evento = JSON.stringify({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_1',
          payment_status: 'paid',
          payment_intent: 'pi_1',
          amount_total: pedido.datos.desglose.totalCliente,
          metadata: { pedido_id: pedido.datos.pedidoId },
        },
      },
    });
    const enviar = async () =>
      app.request(
        '/datos/stripe/aviso',
        { method: 'POST', body: evento, headers: { 'stripe-signature': await firmar(evento) } },
        { DB: m.DB, ...ENV },
      );
    expect((await enviar()).status).toBe(200);
    expect((await enviar()).status).toBe(200); // repetido: no manda otra vez
    const nuevos = enviados.slice(antes);
    expect(nuevos).toHaveLength(2);
    const correoCliente = (await m.llamar('GET', '/datos/cuentas/yo', undefined, cliente.token))
      .datos.usuario.correo as string;
    const recibo = de(nuevos, correoCliente)[0];
    expect(recibo?.from.address).toBe(REMITENTES.pedidos.address);
    expect(recibo?.text).toContain('2 × Cubano');
    expect(recibo?.text).toContain('Total:');
    const aviso = nuevos.find((e) => e !== recibo);
    expect(aviso?.subject).toContain('New paid order');
    expect(aviso?.text).toContain('Sin cebolla');
  });
});
