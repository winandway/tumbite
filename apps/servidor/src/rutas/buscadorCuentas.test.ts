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

/**
 * C-BUSCADOR-APELLIDO (22 nov 2026). Todos los países. Gerencia escribió el apellido de un conductor
 * real recién creado y el buscador contestó que no existía: el nombre solo se buscaba por el COMIENZO
 * del nombre completo, así que un apellido (o un segundo nombre) no encontraba a nadie, en ningún
 * estado. Ahora cada palabra del nombre (hasta la cuarta) se encuentra por su comienzo, con índice.
 */
describe('C-BUSCADOR-APELLIDO · toda cuenta se encuentra por cualquier palabra de su nombre', () => {
  it('un conductor recién creado, sin confirmar el correo y sin papeles, sale por nombre, apellido, correo, teléfono e ID nuevo y viejo', async () => {
    const { m, registrar, encontrar, sql } = await escenario();
    const id = await registrar({
      nombre: 'Andrés José Peñalver Ejemplo',
      correo: 'conductor.nuevo@ejemplo.com',
      rol: 'repartidor',
      telefono: '+1 248 555 0177',
    });
    const fila = await m.DB.prepare(
      'SELECT correo_confirmado_en AS confirmado FROM usuarios WHERE id = ?',
    )
      .bind(id)
      .first<{ confirmado: string | null }>();
    expect(fila?.confirmado ?? null).toBeNull();
    // Su ID del país (se lo da la app al fijar su ciudad).
    const codigo = 'ZZ-NUE-000004';
    await sql(
      "INSERT INTO repartidores (usuario_id, codigo, zona_id) VALUES (?, ?, 'US-FL-MIAMI') ON CONFLICT(usuario_id) DO UPDATE SET codigo = excluded.codigo",
      id,
      codigo,
    );
    // Su ID de antes de una reasignación también lo encuentra.
    await sql(
      "INSERT INTO codigos_repartidor_anteriores (codigo, usuario_id, motivo) VALUES (?, ?, 'reasignado')",
      'ZZ-VIE-000099',
      id,
    );
    for (const q of [
      'Andrés',
      'andres jose',
      'José',
      'jos',
      'Peñalver',
      'penalver',
      'peñ',
      'peñalver ejemplo',
      'Ejemplo',
      'conductor.nuevo',
      'conductor.nuevo@ejemplo.com',
      '0177',
      '248 555 0177',
      codigo,
      'ZZ-VIE-000099',
      id,
    ])
      expect(await encontrar(q, 'repartidores', id), q).toMatchObject({
        estado: 'sin_verificar',
        enlace: `/drivers/${id}`,
      });
  });

  it('un cliente y un comercio también salen por una palabra de en medio; quien tiene una sola palabra no se rompe', async () => {
    const { m, registrar, encontrar, sql } = await escenario();
    const cliente = await registrar({
      nombre: 'María  Fernanda Ruiz',
      correo: 'cliente.nuevo@ejemplo.com',
      rol: 'cliente',
    });
    const solo = await registrar({
      nombre: 'Unapalabra',
      correo: 'una.palabra@ejemplo.com',
      rol: 'cliente',
    });
    for (const q of ['fernanda', 'ruiz', 'Fer'])
      expect(await encontrar(q, 'clientes', cliente), q).toBeTruthy();
    expect(await encontrar('unapal', 'clientes', solo)).toBeTruthy();
    const dueno = await m.cuenta('restaurante');
    await sql(
      "INSERT INTO restaurantes (id, dueno_id, nombre, lat, lng, estado, zona_id) VALUES ('r-palabras', ?, 'Casa del Sabor Andino', 42.48, -83.47, 'pendiente', 'US-FL-MIAMI')",
      dueno.id,
    );
    const comercio = { id: 'r-palabras' };
    for (const q of ['sabor', 'andino', 'del sabor'])
      expect(await encontrar(q, 'restaurantes', String(comercio?.id)), q).toBeTruthy();
  });

  it('las búsquedas por palabra usan su índice: no recorren la tabla de cuentas', async () => {
    const { m } = await escenario();
    const { NOMBRE_DESDE_PALABRA } = await import('../buscadorSql');
    for (const expresion of NOMBRE_DESDE_PALABRA) {
      const plan = await m.DB.prepare(
        `EXPLAIN QUERY PLAN SELECT id FROM usuarios WHERE rol = ? AND ${expresion} >= ? AND ${expresion} < ? LIMIT ?`,
      )
        .bind('repartidor', 'a', 'b', 5)
        .all<{ detail: string }>();
      const detalle = plan.results.map((p) => p.detail).join(' | ');
      expect(detalle).toMatch(/USING INDEX usuarios_rol_nombre_palabra/);
      const planR = await m.DB.prepare(
        `EXPLAIN QUERY PLAN SELECT id FROM restaurantes WHERE ${expresion} >= ? AND ${expresion} < ? LIMIT ?`,
      )
        .bind('a', 'b', 5)
        .all<{ detail: string }>();
      expect(planR.results.map((p) => p.detail).join(' | ')).toMatch(
        /USING INDEX restaurantes_nombre_palabra/,
      );
    }
  });
});
