import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from './pruebas/ayuda';

/**
 * C-KYC-AUTO (29 oct 2026): con el motor propio encendido, la verificación del repartidor se decide al
 * instante; sin motor, sin consentimiento o sin las tomas girando la cabeza, la revisa el equipo como
 * siempre. El motor se simula aquí (nunca se llama a uno real en las pruebas).
 */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const CLAVE = 'c'.repeat(40);
const MOTOR = { VERIFICADOR_URL: 'https://motor.prueba', VERIFICADOR_CLAVE: CLAVE };
const huella = (x: number) => Array.from({ length: 128 }, () => x);

type Pedido = { cuerpo: Record<string, unknown>; firmaOk: boolean };
function motorFalso(responder: (p: Pedido) => unknown, estado = 200) {
  const pedidos: Pedido[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (!String(url).startsWith('https://motor.prueba')) throw new Error(`fetch inesperado ${url}`);
    const texto = String(init?.body ?? '');
    const h = new Headers(init?.headers);
    const esperada = createHmac('sha256', CLAVE)
      .update(`${h.get('x-hora')}.${texto}`)
      .digest('hex');
    const p = {
      cuerpo: JSON.parse(texto) as Record<string, unknown>,
      firmaOk: esperada === h.get('x-firma'),
    };
    pedidos.push(p);
    return new Response(JSON.stringify(responder(p)), { status: estado });
  });
  return pedidos;
}
afterEach(() => vi.unstubAllGlobals());

async function repartidorConFotos(
  m: ReturnType<typeof mundo>,
  opciones = { giros: true, consiente: true },
) {
  const rep = await m.cuenta('repartidor', 'Rafa Repartidor');
  const subir = (pieza: string) =>
    m.crudo(`/datos/kyc/foto/${pieza}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${rep.token}`, 'content-type': 'image/png' },
      body: PNG as BodyInit,
    });
  for (const p of [
    'doc_frente',
    'doc_reverso',
    'selfie',
    ...(opciones.giros ? ['giro_1', 'giro_2'] : []),
  ])
    expect((await subir(p)).status).toBe(201);
  if (opciones.consiente)
    expect(
      (await m.llamar('POST', '/datos/kyc/consentimiento', { acepto: true }, rep.token)).estado,
    ).toBe(200);
  return rep;
}

const estadoKyc = async (m: ReturnType<typeof mundo>, token: string) =>
  (await m.llamar('GET', '/datos/kyc', undefined, token)).datos;

describe('verificación al instante con el motor propio (C-KYC-AUTO)', () => {
  it('todo cuadra: verificado en el momento, con la huella guardada y la firma correcta', async () => {
    const m = mundo(MOTOR);
    const pedidos = motorFalso(() => ({
      decision: 'verificado',
      motivos: [],
      huella: huella(0.1),
      similitud: 0.81,
      parecidas: [],
    }));
    const rep = await repartidorConFotos(m);
    expect((await estadoKyc(m, rep.token)).motor).toBe(true);
    const r = await m.llamar('POST', '/datos/kyc/enviar', { docTipo: 'licencia' }, rep.token);
    expect(r.datos.decision).toBe('verificado');
    expect((await estadoKyc(m, rep.token)).kyc.estado).toBe('aprobado');
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]?.firmaOk).toBe(true);
    expect(pedidos[0]?.cuerpo).toMatchObject({ docTipo: 'licencia' });
    expect((pedidos[0]?.cuerpo.giros as string[]).length).toBe(2);
    expect(
      await m.DB.prepare('SELECT mala_conducta FROM huellas_caras WHERE usuario_id = ?')
        .bind(rep.id)
        .first(),
    ).toEqual({ mala_conducta: 0 });
  });

  it('hay que repetir: rechazada con el motivo en palabras de la persona', async () => {
    const m = mundo(MOTOR);
    motorFalso(() => ({
      decision: 'repetir',
      motivos: ['cara_distinta'],
      huella: null,
      similitud: 0.2,
      parecidas: [],
    }));
    const rep = await repartidorConFotos(m);
    await m.llamar('POST', '/datos/kyc/enviar', { docTipo: 'licencia' }, rep.token);
    const k = (await estadoKyc(m, rep.token)).kyc;
    expect(k.estado).toBe('rechazado');
    expect(k.motivo).toContain('selfie');
    expect(k.motivo).not.toContain('cara_distinta');
  });

  it('en duda: queda para el equipo, que ve el porqué y la cuenta cerrada parecida', async () => {
    const m = mundo(MOTOR);
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    motorFalso(() => ({
      decision: 'revision',
      motivos: ['cara_parecida_a_cuenta_cerrada'],
      huella: huella(0.2),
      similitud: 0.7,
      parecidas: [{ id: 'cuenta-cerrada', similitud: 0.66 }],
    }));
    const rep = await repartidorConFotos(m);
    await m.llamar('POST', '/datos/kyc/enviar', { docTipo: 'licencia' }, rep.token);
    expect((await estadoKyc(m, rep.token)).kyc.estado).toBe('pendiente');
    const detalle = (await m.llamar('GET', `/datos/admin/kyc/${rep.id}`, undefined, admin.token))
      .datos;
    expect(detalle.motor[0]).toMatchObject({
      decision: 'revision',
      motivos: ['cara_parecida_a_cuenta_cerrada'],
      parecidas: [{ id: 'cuenta-cerrada', similitud: 0.66 }],
    });
  });

  it('las caras de cuentas cerradas por mala conducta viajan al motor para compararlas', async () => {
    const m = mundo(MOTOR);
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    motorFalso(() => ({
      decision: 'verificado',
      motivos: [],
      huella: huella(0.3),
      similitud: 0.9,
      parecidas: [],
    }));
    const malo = await repartidorConFotos(m);
    await m.llamar('POST', '/datos/kyc/enviar', { docTipo: 'licencia' }, malo.token);
    expect(
      (
        await m.llamar(
          'PATCH',
          `/datos/admin/usuarios/${malo.id}`,
          { activo: false, malaConducta: true, motivo: 'Robó un pedido' },
          admin.token,
        )
      ).estado,
    ).toBe(200);
    const pedidos = motorFalso(() => ({
      decision: 'revision',
      motivos: ['cara_parecida_a_cuenta_cerrada'],
      huella: huella(0.3),
      similitud: 0.9,
      parecidas: [{ id: malo.id, similitud: 0.95 }],
    }));
    const nuevo = await repartidorConFotos(m);
    await m.llamar('POST', '/datos/kyc/enviar', { docTipo: 'licencia' }, nuevo.token);
    expect(pedidos[0]?.cuerpo.malaConducta).toEqual([{ id: malo.id, huella: huella(0.3) }]);
  });

  it('sin motor, sin consentimiento, sin las tomas o si el motor falla: lo revisa el equipo, como siempre', async () => {
    // Sin motor configurado.
    const sinMotor = mundo();
    const a = await repartidorConFotos(sinMotor);
    expect((await estadoKyc(sinMotor, a.token)).motor).toBe(false);
    await sinMotor.llamar('POST', '/datos/kyc/enviar', { docTipo: 'licencia' }, a.token);
    expect((await estadoKyc(sinMotor, a.token)).kyc.estado).toBe('pendiente');
    // Sin consentimiento o sin las tomas: el motor ni se llama.
    const m = mundo(MOTOR);
    const pedidos = motorFalso(() => ({
      decision: 'verificado',
      motivos: [],
      huella: null,
      similitud: 1,
      parecidas: [],
    }));
    for (const op of [
      { giros: true, consiente: false },
      { giros: false, consiente: true },
    ]) {
      const r = await repartidorConFotos(m, op);
      await m.llamar('POST', '/datos/kyc/enviar', { docTipo: 'licencia' }, r.token);
      expect((await estadoKyc(m, r.token)).kyc.estado).toBe('pendiente');
    }
    expect(pedidos).toHaveLength(0);
    // El motor responde con error: queda pendiente y anotado, nunca aprobado.
    motorFalso(() => ({ error: 'motor' }), 500);
    const c = await repartidorConFotos(m);
    await m.llamar('POST', '/datos/kyc/enviar', { docTipo: 'licencia' }, c.token);
    expect((await estadoKyc(m, c.token)).kyc.estado).toBe('pendiente');
    expect(
      await m.DB.prepare('SELECT decision FROM verificaciones_auto WHERE usuario_id = ?')
        .bind(c.id)
        .first(),
    ).toEqual({ decision: 'sin_respuesta' });
  });

  it('las tomas girando la cabeza son solo del repartidor, y al borrar la cuenta se borra su huella', async () => {
    const m = mundo(MOTOR);
    const dueno = await m.cuenta('restaurante');
    const r = await m.crudo('/datos/kyc/foto/giro_1', {
      method: 'POST',
      headers: { authorization: `Bearer ${dueno.token}`, 'content-type': 'image/png' },
      body: PNG as BodyInit,
    });
    expect(r.status).toBe(400);
    motorFalso(() => ({
      decision: 'verificado',
      motivos: [],
      huella: huella(0.4),
      similitud: 0.9,
      parecidas: [],
    }));
    const rep = await repartidorConFotos(m);
    await m.llamar('POST', '/datos/kyc/enviar', { docTipo: 'licencia' }, rep.token);
    await m.llamar('DELETE', '/datos/cuentas/yo', undefined, rep.token);
    expect(
      await m.DB.prepare('SELECT 1 FROM huellas_caras WHERE usuario_id = ?').bind(rep.id).first(),
    ).toBeNull();
  });
});
