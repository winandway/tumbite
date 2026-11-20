import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';

/**
 * C-BUSCADOR-INSTANTANEO, ampliado con C-BUSCADOR-SECCIONES (19 nov 2026). Todos los países.
 *
 * Richard buscó a un conductor que acababa de registrarse en la app Driver (por el comienzo de su
 * correo de Gmail) y el buscador de arriba del superadmin no lo encontraba: el comienzo del correo
 * solo se buscaba con «@», y las búsquedas por nombre, teléfono y correo pedían una cuenta activa.
 * Aquí cada tipo de cuenta (cliente, conductor, dueño de comercio, empresa de Flex) se encuentra en
 * cada estado, desde la primera o la segunda letra, con su estado en palabras y el acceso directo a
 * sus papeles cuando corresponde.
 */

type Resultado = Record<string, unknown> & {
  id: string;
  estado: string | null;
  enlace: string;
  atajo?: { clave: string; enlace: string };
};

async function escenario() {
  const m = mundo();
  const admin = await m.cuenta('admin');
  const registrar = async (datos: Record<string, unknown>) => {
    const r = await m.llamar('POST', '/datos/cuentas/registro', {
      clave: 'clave-segura-1',
      ...datos,
    });
    expect(r.estado, JSON.stringify(r.datos)).toBe(201);
    return String((r.datos as { usuario: { id: string } }).usuario.id);
  };
  const buscar = async (q: string) =>
    (
      (
        await m.llamar(
          'GET',
          `/datos/admin/buscar?q=${encodeURIComponent(q)}`,
          undefined,
          admin.token,
        )
      ).datos as { grupos: { tipo: string; resultados: Resultado[] }[] }
    ).grupos;
  const encontrar = async (q: string, tipo: string, id: string) =>
    (await buscar(q)).find((g) => g.tipo === tipo)?.resultados.find((r) => r.id === id);
  const sql = async (consulta: string, ...v: unknown[]) => {
    await m.DB.prepare(consulta)
      .bind(...v)
      .run();
  };
  return { m, registrar, buscar, encontrar, sql };
}

describe('C-BUSCADOR-INSTANTANEO · una cuenta se encuentra en cada estado', () => {
  it('un conductor recién registrado y sin aprobar sale por su correo, su nombre o su teléfono desde la segunda letra, con su estado y «Ver sus papeles»', async () => {
    const { registrar, encontrar } = await escenario();
    const id = await registrar({
      nombre: 'Kelly Prado',
      correo: 'kprado07@gmail.com',
      rol: 'repartidor',
      telefono: '+1 248 555 0142',
    });
    for (const q of [
      'kp',
      'kpr',
      'kprado07',
      'kprado07@',
      'kprado07@gmail.com',
      'ke',
      'Kelly',
      'kelly p',
      '0142',
      '248 555',
    ])
      expect(await encontrar(q, 'repartidores', id), q).toMatchObject({
        estado: 'sin_verificar',
        enlace: `/drivers/${id}`,
        atajo: { clave: 'papeles', enlace: `/verifications/${id}` },
      });
  });

  it('el conductor sale en cada estado: papeles pendientes, aprobado, no aprobado, suspendido; la cuenta borrada no', async () => {
    const { registrar, encontrar, sql } = await escenario();
    const id = await registrar({
      nombre: 'Kelly Prado',
      correo: 'kprado07@gmail.com',
      rol: 'repartidor',
    });
    const estadoCon = async () => (await encontrar('kprado', 'repartidores', id))?.estado;
    // Subió un papel (licencia) que espera revisión.
    await sql(
      "INSERT INTO conductor_documentos (id, conductor_id, tipo, clave) VALUES ('doc-1', ?, 'licencia_moto', 'k')",
      id,
    );
    expect(await estadoCon()).toBe('papeles_pendientes');
    await sql("UPDATE conductor_documentos SET estado = 'aprobado' WHERE id = 'doc-1'");
    await sql("INSERT INTO kyc (usuario_id, estado) VALUES (?, 'pendiente')", id);
    expect(await estadoCon()).toBe('papeles_pendientes');
    await sql("UPDATE kyc SET estado = 'aprobado' WHERE usuario_id = ?", id);
    expect(await estadoCon()).toBe('aprobado');
    await sql("UPDATE kyc SET estado = 'rechazado' WHERE usuario_id = ?", id);
    expect(await estadoCon()).toBe('rechazado');
    await sql('UPDATE usuarios SET activo = 0 WHERE id = ?', id);
    expect(await estadoCon()).toBe('suspendido');
    // Suspendido también sale por su nombre (antes la búsqueda pedía una cuenta activa).
    expect((await encontrar('kelly', 'repartidores', id))?.estado).toBe('suspendido');
    // Borrada por su dueño: ya no tiene datos y no aparece por nombre.
    await sql(
      "UPDATE usuarios SET nombre = 'Cuenta borrada', correo = ?, telefono = NULL WHERE id = ?",
      `borrada-${id}@tumbite.invalid`,
      id,
    );
    expect(await encontrar('cuenta', 'repartidores', id)).toBeUndefined();
  });

  it('un cliente sale sin confirmar, confirmado y suspendido', async () => {
    const { m, registrar, encontrar, sql } = await escenario();
    const id = await registrar({
      nombre: 'Lucía Marín',
      correo: 'lmarin.compras@ejemplo.com',
      rol: 'cliente',
      telefono: '+1 313 555 0177',
    });
    for (const q of ['lm', 'lmarin.c', 'luc', 'LUCIA', '0177'])
      expect((await encontrar(q, 'clientes', id))?.estado, q).toBe('sin_confirmar');
    await m.confirmarCorreo(id);
    expect((await encontrar('lmarin', 'clientes', id))?.estado).toBeNull();
    await sql('UPDATE usuarios SET activo = 0 WHERE id = ?', id);
    expect((await encontrar('lmarin', 'clientes', id))?.estado).toBe('suspendido');
    // Un cliente no lleva «Ver sus papeles».
    expect((await encontrar('lmarin', 'clientes', id))?.atajo).toBeUndefined();
  });

  it('el dueño de un comercio: recién registrado sin comercio («Registro sin terminar»), con su comercio en revisión y aprobado', async () => {
    const { registrar, encontrar, buscar, sql } = await escenario();
    const id = await registrar({
      nombre: 'Tomás Rivas',
      correo: 'trivas.cocina@ejemplo.com',
      rol: 'restaurante',
      telefono: '+1 248 555 0190',
    });
    for (const q of ['tr', 'trivas', 'tomas', '0190'])
      expect(await encontrar(q, 'restaurantes', id), q).toMatchObject({
        estado: 'registro_sin_terminar',
        enlace: `/verifications/${id}`,
      });
    await sql(
      "INSERT INTO restaurantes (id, dueno_id, nombre, lat, lng, estado, zona_id) VALUES ('r-nuevo', ?, 'Cocina Norte', 42.48, -83.47, 'pendiente', 'US-FL-MIAMI')",
      id,
    );
    // Por la cuenta del dueño y por el nombre del comercio: el comercio, en revisión, con sus papeles.
    for (const q of ['trivas', 'tomas', 'cocina n'])
      expect(await encontrar(q, 'restaurantes', 'r-nuevo'), q).toMatchObject({
        estado: 'pendiente',
        enlace: '/restaurants/r-nuevo',
        atajo: { clave: 'papeles', enlace: `/verifications/${id}` },
      });
    // Ya no sale dos veces (el dueño sin comercio desaparece cuando tiene su comercio).
    const g = (await buscar('trivas')).find((x) => x.tipo === 'restaurantes')?.resultados ?? [];
    expect(g.map((r) => r.id)).toEqual(['r-nuevo']);
    await sql("UPDATE restaurantes SET estado = 'aprobado' WHERE id = 'r-nuevo'");
    expect((await encontrar('cocina', 'restaurantes', 'r-nuevo'))?.estado).toBe('aprobado');
  });

  it('una empresa de Flex sale por su nombre y por el correo de su dueño, activa y pausada', async () => {
    const { registrar, encontrar, sql } = await escenario();
    const dueno = await registrar({
      nombre: 'Andrea Solís',
      correo: 'asolis.envios@ejemplo.com',
      rol: 'cliente',
    });
    await sql(
      "INSERT INTO empresas (id, nombre, pais, moneda, dueno_id) VALUES ('e-1', 'Envíos Rápidos Norte', 'US', 'USD', ?)",
      dueno,
    );
    for (const q of ['envi', 'ENVIOS rap', 'asolis', 'asolis.envios@ejemplo.com'])
      expect(await encontrar(q, 'empresas', 'e-1'), q).toMatchObject({
        estado: 'activa',
        enlace: '/flexfinance/e-1',
      });
    await sql("UPDATE empresas SET estado = 'pausada' WHERE id = 'e-1'");
    expect((await encontrar('envios', 'empresas', 'e-1'))?.estado).toBe('pausada');
  });
});
