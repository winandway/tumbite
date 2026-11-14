import { describe, expect, it } from 'vitest';
import { CIUDAD_PRUEBAS_VENEZUELA as CCS } from '@tumbite/compartido';
import { mundo } from '../pruebas/ayuda';
import { MOTO_VE } from './diagnosticoMotoVe';

/**
 * C-MOTO-VE-PUNTA-A-PUNTA (13 nov 2026) — Venezuela. La herramienta del sitio de pruebas que usa el
 * guion scripts/staging/probar-moto-venezuela.mjs: cuentas fijas que se reutilizan, el alta del
 * conductor que vuelve a empezar en cada vuelta SIN tocar su saldo ni su libro, el conductor sin
 * saldo en Caracas y la limpieza.
 */
const SEC = `reloj-${crypto.randomUUID()}`;

function escenario() {
  const m = mundo({ RELOJ_SECRETO: SEC }, { host: 'staging.tumbite.com' });
  const interno = async (ruta: string, conSecreto = true, cuerpo: unknown = {}) => {
    const r = await m.crudo(`/datos/interno/diagnostico/moto-ve/${ruta}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(conSecreto ? { 'x-reloj-secreto': SEC } : {}),
      },
      body: JSON.stringify(cuerpo),
    });
    return { estado: r.status, datos: (await r.json()) as any };
  };
  return { m, interno };
}

describe('C-MOTO-VE-PUNTA-A-PUNTA: la herramienta del guion de Moto en Venezuela', () => {
  it('sin el secreto no existe; en producción tampoco', async () => {
    const { interno } = escenario();
    expect((await interno('armar', false)).estado).toBe(404);
    const prod = mundo({ RELOJ_SECRETO: SEC }, { host: 'divoox.com' });
    const r = await prod.crudo('/datos/interno/diagnostico/moto-ve/armar', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-reloj-secreto': SEC },
      body: '{}',
    });
    expect(r.status).toBe(404);
  });

  it('cada vuelta reinicia el alta del conductor y deja intactos su saldo y su libro', async () => {
    const { m, interno } = escenario();
    const a = await interno('armar');
    expect(a.estado).toBe(200);
    const yo = await m.llamar(
      'GET',
      '/datos/conductor/papeles',
      undefined,
      a.datos.tokens.conductor,
    );
    expect(yo.estado).toBe(200);
    // Lo que dejó una vuelta anterior: un requisito, una moto y dinero en su saldo.
    await m.DB.batch([
      m.DB.prepare(
        "INSERT INTO cumplimientos (conductor_id, vehiculo_id, requisito, estado, fuente) VALUES (?, '', 'licencia_moto', 'aprobado', 'sistema')",
      ).bind(MOTO_VE.conductor),
      m.DB.prepare(
        "INSERT INTO vehiculos (id, conductor_id, tipo, placa, placa_estado, estado) VALUES ('zz-v-vieja', ?, 'moto', 'ZZ1', 'VE', 'en_revision')",
      ).bind(MOTO_VE.conductor),
      m.DB.prepare(
        "INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto) VALUES ('zz-l-1', ?, 'prepago', 'VE', 'USD', 300, 'recarga')",
      ).bind(MOTO_VE.conductor),
    ]);
    const b = await interno('armar');
    expect(b.estado).toBe(200);
    expect((await interno('reiniciar')).estado).toBe(200);
    // El pase anterior ya no sirve; el nuevo sí.
    expect(
      (await m.llamar('GET', '/datos/conductor/papeles', undefined, a.datos.tokens.conductor))
        .estado,
    ).toBe(401);
    expect(
      (await m.llamar('GET', '/datos/conductor/papeles', undefined, b.datos.tokens.conductor))
        .estado,
    ).toBe(200);
    const cumple = await m.DB.prepare(
      'SELECT COUNT(*) AS n FROM cumplimientos WHERE conductor_id = ?',
    )
      .bind(MOTO_VE.conductor)
      .first<{ n: number }>();
    expect(cumple?.n).toBe(0);
    const moto = await m.DB.prepare("SELECT estado FROM vehiculos WHERE id = 'zz-v-vieja'").first<{
      estado: string;
    }>();
    expect(moto?.estado).toBe('retirado');
    const libro = await m.DB.prepare("SELECT monto FROM libro WHERE id = 'zz-l-1'").first<{
      monto: number;
    }>();
    expect(libro?.monto).toBe(300);
    // La contraseña de la vuelta sirve para entrar (la pide cargar el pago móvil).
    const entrar = await m.llamar('POST', '/datos/cuentas/entrar', {
      correo: `${MOTO_VE.conductor}@prueba.invalid`,
      clave: b.datos.clave,
    });
    expect(entrar.estado).toBe(200);
  });

  it('desde el 13 nov las pruebas son en El Vigía: el conductor sin saldo queda en la ciudad que manda el guion (solo de Venezuela)', async () => {
    const { m, interno } = escenario();
    await interno('armar');
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    const abrir = await m.llamar(
      'POST',
      '/datos/admin/viajes/ciudades',
      {
        servicio: 'moto',
        zona: {
          id: 'VE-MER-ELVIGIA',
          nombre: 'El Vigía',
          lat: 8.6219,
          lng: -71.6506,
          zonaHoraria: 'America/Caracas',
        },
        motivo: 'Ciudad de pruebas',
      },
      admin.token,
    );
    expect(abrir.estado).toBe(201);
    expect((await interno('sin-saldo', true, { zonaId: 'VE-MER-ELVIGIA' })).estado).toBe(200);
    const fila = await m.DB.prepare('SELECT zona_id FROM repartidores WHERE usuario_id = ?')
      .bind(MOTO_VE.sinSaldo)
      .first<{ zona_id: string }>();
    expect(fila?.zona_id).toBe('VE-MER-ELVIGIA');
    // Una zona de otro país no se acepta: vuelve a Caracas de pruebas, que aquí no está abierta.
    expect((await interno('sin-saldo', true, { zonaId: 'US-FL-MIAMI' })).estado).toBe(409);
  });

  it('el conductor sin saldo pide la ciudad abierta, queda solo en Caracas y la limpieza no deja a nadie', async () => {
    const { m, interno } = escenario();
    await interno('armar');
    expect((await interno('sin-saldo')).estado).toBe(409);
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    const abrir = await m.llamar(
      'POST',
      '/datos/admin/viajes/ciudades',
      {
        servicio: 'moto',
        zona: {
          id: CCS.id,
          nombre: CCS.nombre,
          lat: CCS.lat,
          lng: CCS.lng,
          zonaHoraria: CCS.zonaHoraria,
        },
        motivo: 'Ciudad de pruebas',
      },
      admin.token,
    );
    expect(abrir.estado).toBe(201);
    const otro = await m.cuenta('repartidor', 'Otro conductor');
    await m.DB.prepare('INSERT INTO repartidores (usuario_id, conectado, zona_id) VALUES (?, 1, ?)')
      .bind(otro.id, CCS.id)
      .run();
    const s = await interno('sin-saldo');
    expect(s.estado).toBe(200);
    expect((await interno('sin-saldo')).estado).toBe(200); // se repite sin chocar
    const fila = await m.DB.prepare(
      'SELECT conectado, zona_id, vehiculo_activo_id FROM repartidores WHERE usuario_id = ?',
    )
      .bind(MOTO_VE.sinSaldo)
      .first<{ conectado: number; zona_id: string; vehiculo_activo_id: string }>();
    expect(fila).toEqual({
      conectado: 1,
      zona_id: CCS.id,
      vehiculo_activo_id: MOTO_VE.vehiculoSinSaldo,
    });
    const elOtro = await m.DB.prepare('SELECT conectado FROM repartidores WHERE usuario_id = ?')
      .bind(otro.id)
      .first<{ conectado: number }>();
    expect(elOtro?.conectado).toBe(0);
    const l = await interno('limpiar');
    expect(l.datos.ok).toBe(true);
  });
});
