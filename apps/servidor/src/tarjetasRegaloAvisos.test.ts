import { afterEach, describe, expect, it } from 'vitest';
import { usarTransporteCorreo } from './correo';
import { mundo } from './pruebas/ayuda';
import { apartarSaldo, avisoTarjetaRegalo } from './tarjetasRegalo';

/**
 * C-TARJETAS-REGALO (COB-5, 2 nov 2026): los caminos del aviso de pago que el recorrido completo no
 * toca. Todos los países.
 */
describe('aviso de pago de una tarjeta de regalo', () => {
  afterEach(() => usarTransporteCorreo(null));

  async function tarjeta(m: ReturnType<typeof mundo>, compradorId: string, extra = {}) {
    const fila = {
      id: crypto.randomUUID(),
      codigo: `DVX-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      centavos: 2500,
      para_nombre: '',
      mensaje: '',
      ...extra,
    };
    await m.DB.prepare(
      `INSERT INTO tarjetas_regalo (id, codigo, centavos, comprador_id, para_correo, para_nombre, mensaje, stripe_pago)
       VALUES (?, ?, ?, ?, 'amiga@divoox.com', ?, ?, 'pi_x')`,
    )
      .bind(fila.id, fila.codigo, fila.centavos, compradorId, fila.para_nombre, fila.mensaje)
      .run();
    return fila;
  }
  const pago = (id: string, monto = 2500) => ({
    id: 'pi_x',
    amount_received: monto,
    metadata: { tarjeta_regalo_id: id },
  });

  it('un aviso repetido no vuelve a mandar el correo; sin nombre ni mensaje el correo sale igual', async () => {
    const m = mundo();
    const correos: string[] = [];
    usarTransporteCorreo((_e, init) => {
      correos.push(String(init.body));
      return Promise.resolve(new Response(JSON.stringify({ success: true, message_id: 'm' })));
    });
    const comprador = await m.cuenta('cliente', 'Ana Regala');
    // Comprador sin nombre: el correo dice «Someone».
    await m.DB.prepare("UPDATE usuarios SET nombre = '' WHERE id = ?").bind(comprador.id).run();
    const t = await tarjeta(m, comprador.id);
    const env = { YAD_TOKEN: 'x'.repeat(40) } as never;
    expect(await avisoTarjetaRegalo(env, m.DB, 'payment_intent.succeeded', pago(t.id))).toBe(true);
    expect(await avisoTarjetaRegalo(env, m.DB, 'payment_intent.succeeded', pago(t.id))).toBe(true);
    expect(correos).toHaveLength(1);
    const cuerpo = JSON.parse(correos[0]!) as { subject: string; text: string };
    expect(cuerpo.subject).toBe('Someone sent you a $25.00 Divoox gift card');
    expect(cuerpo.text.startsWith('Hi! Someone')).toBe(true);
    expect(cuerpo.text).not.toContain('“');
  });

  it('con nombre y mensaje, el correo saluda por el nombre y cita el mensaje', async () => {
    const m = mundo();
    const correos: string[] = [];
    usarTransporteCorreo((_e, init) => {
      correos.push(String(init.body));
      return Promise.resolve(new Response(JSON.stringify({ success: true, message_id: 'm' })));
    });
    const comprador = await m.cuenta('cliente', 'Ana Regala');
    const t = await tarjeta(m, comprador.id, { para_nombre: 'Bea', mensaje: 'Disfrútala' });
    await avisoTarjetaRegalo(
      { YAD_TOKEN: 'x'.repeat(40) } as never,
      m.DB,
      'payment_intent.succeeded',
      pago(t.id),
    );
    const cuerpo = JSON.parse(correos[0]!) as { subject: string; text: string };
    expect(cuerpo.subject).toBe('Ana sent you a $25.00 Divoox gift card');
    expect(cuerpo.text).toContain('Hi Bea! Ana');
    expect(cuerpo.text).toContain('“Disfrútala”');
  });

  it('otros avisos de Stripe no son suyos, y sin saldo no se aparta nada', async () => {
    const m = mundo();
    const env = {} as never;
    expect(await avisoTarjetaRegalo(env, m.DB, 'payment_intent.succeeded', { id: 'pi_y' })).toBe(
      false,
    );
    expect(
      await avisoTarjetaRegalo(env, m.DB, 'charge.refunded', {
        metadata: { tarjeta_regalo_id: 'x' },
      }),
    ).toBe(false);
    const c = await m.cuenta('cliente');
    expect(await apartarSaldo(m.DB, 'p1', c.id, 0)).toBe(false);
  });
});
