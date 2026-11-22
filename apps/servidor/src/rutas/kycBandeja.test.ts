import { afterEach, describe, expect, it } from 'vitest';
import { contarFilas } from '../presupuestoFilas';
import { mundo } from '../pruebas/ayuda';
import { medidorDeLecturas, sembrarVolumen } from '../pruebas/lecturas';
import { olvidarSegundoFactor } from '../segundoFactor';
import { olvidarAnotadosRecientes } from '../accesoInterno';
import {
  condicionBusqueda,
  consultaTotalSinEnviar,
  consultasSinEnviar,
  resumenCara,
  resumenComprobacion,
} from './kycBandeja';

/**
 * C-VERIFICACIONES-BANDEJA (22 nov 2026, Gerencia) — todos los países. La bandeja de Verificaciones:
 * pestañas, filtros de zona y de cuentas, búsqueda por cada tipo de dato, el resumen de la
 * comprobación automática de cada foto, solo el equipo, el alcance por zona y «mirar no escribe».
 * Cada prueba se vio en rojo rompiendo su pieza (anotado en CANDADOS.md).
 */
type Mundo = ReturnType<typeof mundo>;

afterEach(() => {
  olvidarSegundoFactor();
  olvidarAnotadosRecientes();
});

const ZONA_NORTE = 'US-ZZ-NORTE';
const ZONA_SUR = 'US-ZZ-SUR';

async function zonas(m: Mundo) {
  for (const [id, nombre] of [
    [ZONA_NORTE, 'Ciudad Norte'],
    [ZONA_SUR, 'Ciudad Sur'],
  ])
    await m.DB.prepare(
      `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
       VALUES (?, ?, 'US', 'USD', 'America/New_York', 40, -80, 20, 1)`,
    )
      .bind(id, nombre)
      .run();
}

type Persona = {
  nombre: string;
  estado?: 'pendiente' | 'aprobado' | 'rechazado';
  zona?: string;
  codigo?: string;
  telefono?: string;
  prueba?: boolean;
  horas?: number;
};

/** Un conductor con su verificación enviada (sin pasar por las fotos: directo en la base). */
async function conductor(m: Mundo, p: Persona) {
  const c = await m.cuenta('repartidor', p.nombre);
  const zona = p.zona ?? ZONA_NORTE;
  await m.DB.batch([
    m.DB.prepare('UPDATE usuarios SET zona_id = ?, telefono = ?, es_prueba = ? WHERE id = ?').bind(
      zona,
      p.telefono ?? null,
      p.prueba ? 1 : 0,
      c.id,
    ),
    m.DB.prepare(
      `INSERT INTO repartidores (usuario_id, zona_id, ubicacion_en, codigo) VALUES (?, ?, datetime('now'), ?)
       ON CONFLICT(usuario_id) DO UPDATE SET zona_id = excluded.zona_id, ubicacion_en = excluded.ubicacion_en, codigo = excluded.codigo`,
    ).bind(c.id, zona, p.codigo ?? null),
    m.DB.prepare(
      `INSERT OR REPLACE INTO kyc (usuario_id, estado, doc_tipo, doc_frente, doc_reverso, selfie, enviado_en, revisado_en)
       VALUES (?, ?, 'identificacion', ?, ?, ?, datetime('now', ?), CASE WHEN ? != 'pendiente' THEN datetime('now') END)`,
    ).bind(
      c.id,
      p.estado ?? 'pendiente',
      `verificacion/${c.id}/doc_frente-1`,
      `verificacion/${c.id}/doc_reverso-1`,
      `verificacion/${c.id}/cara-1`,
      `-${p.horas ?? 1} hours`,
      p.estado ?? 'pendiente',
    ),
  ]);
  return c;
}

const bandeja = (m: Mundo, token: string, q = '') =>
  m.llamar('GET', `/datos/admin/kyc${q ? `?${q}` : ''}`, undefined, token);
const nombres = (r: { datos: { solicitudes: { nombre: string }[] } }) =>
  r.datos.solicitudes.map((s) => s.nombre).sort();

describe('C-VERIFICACIONES-BANDEJA · el resumen de la comprobación automática (puro)', () => {
  it('verde cuadra, la duda va en ámbar con su motivo y sin comprobación va en gris', () => {
    const lectura = (x: object) => JSON.stringify({ clase: 'identidad_frente', ...x });
    const ia = (color: string, l = '', estado = 'vigente', clase = '') => ({
      estado,
      color,
      clase,
      lectura: l,
    });
    expect(resumenComprobacion('doc_frente', ia('verde', lectura({ legible: true })))).toEqual({
      pieza: 'doc_frente',
      tono: 'hecho',
      motivo: 'cuadra',
    });
    expect(
      resumenComprobacion('doc_frente', ia('amarillo', lectura({ legible: false }))).motivo,
    ).toBe('ilegible');
    expect(
      resumenComprobacion('doc_frente', ia('rojo', lectura({ legible: true, vencido: 'si' }))),
    ).toMatchObject({ tono: 'pendiente', motivo: 'vencido' });
    // Rojo de la comprobación también es duda: nunca decide sola.
    expect(
      resumenComprobacion('selfie', ia('rojo', JSON.stringify({ clase: 'identidad_frente' }))),
    ).toMatchObject({ tono: 'pendiente', motivo: 'otra_clase', clase: 'identidad_frente' });
    expect(
      resumenComprobacion(
        'doc_frente',
        ia('amarillo', lectura({ legible: true, fotoDeOtraFoto: true })),
      ).motivo,
    ).toBe('foto_de_foto');
    expect(
      resumenComprobacion('doc_frente', ia('amarillo', lectura({ legible: true }))).motivo,
    ).toBe('confianza_baja');
    expect(resumenComprobacion('doc_frente', ia('verde', '', 'repetir')).motivo).toBe('repetir');
    expect(resumenComprobacion('doc_frente', null)).toMatchObject({
      tono: 'apagado',
      motivo: 'a_mano',
    });
    expect(resumenComprobacion('doc_frente', ia('sin_ia'))).toMatchObject({ tono: 'apagado' });
    expect(resumenComprobacion('local', null, { distanciaM: 900, lejos: true }).motivo).toBe(
      'lejos',
    );
    expect(resumenComprobacion('local', null, { distanciaM: 40, lejos: false }).tono).toBe('hecho');
    expect(resumenCara('misma')?.tono).toBe('hecho');
    expect(resumenCara('distinta')?.tono).toBe('pendiente');
    expect(resumenCara(null)).toBeNull();
  });

  it('la búsqueda no deja pasar comodines y busca los dígitos del teléfono solo si son números', () => {
    const b = condicionBusqueda('50%_');
    expect(b?.valores[0]).toBe('%50\\%\\_%');
    expect(condicionBusqueda('  ')).toBeNull();
    expect(condicionBusqueda('(313) 555')?.sql).toContain('telefono');
    expect(condicionBusqueda('Ana')?.sql).not.toContain('telefono');
  });
});

describe('C-VERIFICACIONES-BANDEJA · la bandeja del superadmin', () => {
  async function preparar() {
    const m = mundo();
    await zonas(m);
    const admin = await m.cuenta('admin', 'Soporte Bandeja');
    const jose = await conductor(m, {
      nombre: 'José Pérez',
      codigo: 'US-ZZN-000012',
      telefono: '+1 (313) 555-0142',
      horas: 30,
    });
    const ana = await conductor(m, { nombre: 'Ana Ruiz', zona: ZONA_SUR, codigo: 'US-ZZS-000007' });
    await conductor(m, { nombre: 'Luis Prueba', prueba: true });
    await conductor(m, { nombre: 'Marta Lista', estado: 'aprobado' });
    await conductor(m, { nombre: 'Pablo Otro', estado: 'rechazado' });
    return { m, admin, jose, ana };
  }

  it('cada pestaña trae lo suyo, la espera más larga primero, y los totales por pestaña', async () => {
    const { m, admin } = await preparar();
    const r = await bandeja(m, admin.token);
    expect(r.estado).toBe(200);
    expect(r.datos.solicitudes.map((s: { nombre: string }) => s.nombre)).toEqual([
      'José Pérez',
      'Ana Ruiz',
    ]);
    expect(r.datos.totales).toEqual({ pendiente: 2, aprobado: 1, rechazado: 1, sin_enviar: 0 });
    expect(nombres(await bandeja(m, admin.token, 'estado=aprobado'))).toEqual(['Marta Lista']);
    expect(nombres(await bandeja(m, admin.token, 'estado=rechazado'))).toEqual(['Pablo Otro']);
  });

  it('cada fila trae ID, zona, espera, prueba, miniatura y la comprobación de cada foto', async () => {
    const { m, admin, jose } = await preparar();
    await m.DB.prepare(
      `INSERT INTO verificacion_fotos (id, conductor_id, paso, clave, ia_color, ia_clase, ia_confianza, ia_json)
       VALUES ('f1', ?1, 'doc_frente', 'verificacion/' || ?1 || '/doc_frente-1', 'verde', 'identidad_frente', 95, '{"clase":"identidad_frente","legible":true}'),
              ('f2', ?1, 'doc_reverso', 'verificacion/' || ?1 || '/doc_reverso-1', 'amarillo', 'identidad_reverso', 70, '{"clase":"identidad_reverso","legible":false}'),
              ('f3', ?1, 'cara', 'otra-clave-vieja', 'verde', 'cara', 99, '{"clase":"cara","legible":true}')`,
    )
      .bind(jose.id)
      .run();
    const fila = (await bandeja(m, admin.token)).datos.solicitudes.find(
      (s: { id: string }) => s.id === jose.id,
    );
    expect(fila).toMatchObject({
      codigo: 'US-ZZN-000012',
      zonaId: ZONA_NORTE,
      zona: 'Ciudad Norte',
      esPrueba: false,
      miniatura: 'selfie',
      rol: 'repartidor',
    });
    expect(fila.enviado).toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(fila.comprobaciones).toEqual([
      { pieza: 'doc_frente', tono: 'hecho', motivo: 'cuadra' },
      { pieza: 'doc_reverso', tono: 'pendiente', motivo: 'ilegible' },
      // La foto de la cara que miró la comprobación no es la que está en la verificación: a mano.
      { pieza: 'selfie', tono: 'apagado', motivo: 'a_mano' },
    ]);
  });

  it('busca por nombre sin acentos, ID con o sin «#», correo, teléfono, zona y número del ID', async () => {
    const { m, admin, jose } = await preparar();
    const correo = (
      await m.DB.prepare('SELECT correo FROM usuarios WHERE id = ?')
        .bind(jose.id)
        .first<{ correo: string }>()
    )?.correo as string;
    for (const q of [
      'jose',
      'JOSÉ PÉ',
      'perez',
      'us-zzn',
      '#US-ZZN-000012',
      '000012',
      correo.slice(0, 12).toUpperCase(),
      '555-0142',
      '3135550142',
      'ciudad nor',
      ZONA_NORTE,
      jose.id,
    ])
      expect(nombres(await bandeja(m, admin.token, `q=${encodeURIComponent(q)}`)), q).toEqual([
        'José Pérez',
      ]);
    expect(nombres(await bandeja(m, admin.token, 'q=zzz-nadie'))).toEqual([]);
  });

  it('la búsqueda también cuenta lo cerrado: los totales dicen en qué pestaña está', async () => {
    const { m, admin } = await preparar();
    const r = await bandeja(m, admin.token, 'q=marta');
    expect(r.datos.solicitudes).toEqual([]);
    expect(r.datos.totales).toEqual({ aprobado: 1, sin_enviar: 0 });
  });

  it('filtra por zona y por cuentas reales (por defecto), de prueba o todas', async () => {
    const { m, admin } = await preparar();
    expect(nombres(await bandeja(m, admin.token, `zona=${ZONA_SUR}`))).toEqual(['Ana Ruiz']);
    expect(nombres(await bandeja(m, admin.token, 'cuentas=prueba'))).toEqual(['Luis Prueba']);
    expect(nombres(await bandeja(m, admin.token, 'cuentas=todas'))).toEqual([
      'Ana Ruiz',
      'José Pérez',
      'Luis Prueba',
    ]);
  });

  it('pagina sin repetir ni perder filas', async () => {
    const { m, admin } = await preparar();
    for (let i = 0; i < 51; i++)
      await m.DB.prepare(
        `INSERT INTO usuarios (id, correo, nombre, rol, clave_hash, zona_id) VALUES (?, ?, ?, 'repartidor', 'x', ?)`,
      )
        .bind(`pag-${i}`, `pag${i}@ejemplo.com`, `Persona ${i}`, ZONA_NORTE)
        .run();
    await m.DB.prepare(
      `INSERT INTO kyc (usuario_id, estado, enviado_en) SELECT id, 'pendiente', datetime('now', '-2 hours') FROM usuarios WHERE id LIKE 'pag-%'`,
    ).run();
    const uno = await bandeja(m, admin.token);
    expect(uno.datos.solicitudes).toHaveLength(50);
    expect(uno.datos.siguiente).toBeTruthy();
    const dos = await bandeja(m, admin.token, `despues=${encodeURIComponent(uno.datos.siguiente)}`);
    expect(dos.datos.siguiente).toBeNull();
    expect(dos.datos.totales).toBeNull();
    const ids = [...uno.datos.solicitudes, ...dos.datos.solicitudes].map(
      (s: { id: string }) => s.id,
    );
    expect(new Set(ids).size).toBe(53);
  });

  it('la ficha trae el ID, la zona, lo que leyó la comprobación y lo que declaró la persona', async () => {
    const { m, admin, jose } = await preparar();
    await m.DB.batch([
      m.DB.prepare(
        `INSERT INTO verificacion_fotos (id, conductor_id, paso, clave, ia_color, ia_clase, ia_confianza, ia_json)
         VALUES ('l1', ?1, 'doc_frente', 'verificacion/' || ?1 || '/doc_frente-1', 'verde', 'identidad_frente', 92,
                 '{"clase":"identidad_frente","legible":true,"nombre":"JOSE PEREZ","numero":"V-00000000"}'),
                ('l2', ?1, 'licencia_frente', 'verificacion/' || ?1 || '/licencia-1', 'amarillo', 'licencia_frente', 70,
                 '{"clase":"licencia_frente","legible":true,"numero":"L-111","vence":"2030-01-01"}')`,
      ).bind(jose.id),
      m.DB.prepare(
        "INSERT INTO repartidor_datos (usuario_id, licencia_numero, licencia_vence) VALUES (?, 'L-222', '2030-01-01')",
      ).bind(jose.id),
    ]);
    const r = await m.llamar('GET', `/datos/admin/kyc/${jose.id}`, undefined, admin.token);
    expect(r.estado).toBe(200);
    expect(r.datos.persona).toMatchObject({
      codigo: 'US-ZZN-000012',
      zona_id: ZONA_NORTE,
      zona: 'Ciudad Norte',
      es_prueba: 0,
    });
    expect(r.datos.lecturas.map((l: { paso: string }) => l.paso)).toEqual([
      'doc_frente',
      'licencia_frente',
    ]);
    expect(r.datos.lecturas[0].lectura).toMatchObject({ nombre: 'JOSE PEREZ' });
    expect(r.datos.declarado).toMatchObject({ licenciaNumero: 'L-222' });
    expect(r.datos.comprobaciones[0]).toEqual({
      pieza: 'doc_frente',
      tono: 'hecho',
      motivo: 'cuadra',
    });
  });

  it('solo el equipo la ve', async () => {
    const { m } = await preparar();
    const rep = await m.cuenta('repartidor', 'Curioso');
    const cli = await m.cuenta('cliente', 'Curiosa');
    expect((await bandeja(m, rep.token)).estado).toBe(403);
    expect((await bandeja(m, cli.token)).estado).toBe(403);
  });

  it('quien trabaja en una zona solo ve las verificaciones de esa zona (también en los totales)', async () => {
    const { m, admin } = await preparar();
    const correo = `emp-${Math.random().toString(36).slice(2)}@ejemplo.com`;
    const inv = await m.llamar(
      'POST',
      '/datos/admin/equipo/invitaciones',
      {
        correo,
        nombre: 'Persona Equipo',
        plantillas: ['total'],
        motivo: 'Alta de prueba',
        alcance: { zonas: [ZONA_SUR] },
      },
      admin.token,
    );
    expect(inv.estado, JSON.stringify(inv.datos)).toBe(201);
    const a = await m.llamar('POST', '/datos/equipo-interno/invitacion/aceptar', {
      codigo: new URL(inv.datos.enlace).searchParams.get('code'),
      nombre: 'Persona Equipo',
      clave: 'clave-segura-1',
    });
    const sur = a.datos.token as string;
    const r = await bandeja(m, sur);
    expect(nombres(r)).toEqual(['Ana Ruiz']);
    expect(r.datos.totales).toEqual({ pendiente: 1, sin_enviar: 0 });
    expect(nombres(await bandeja(m, sur, 'q=jose'))).toEqual([]);
  });
});

/**
 * C-VERIFICACIONES-SIN-ENVIAR (22 nov 2026, Richard buscó en Verificaciones a un conductor que solo
 * había creado su cuenta y no entendió por qué no salía) — todos los países. La pestaña «Sin enviar»
 * trae a los conductores y dueños de comercio que se registraron y todavía no mandaron sus fotos,
 * con su contador, los más nuevos primero, con los mismos filtros, búsqueda y alcance.
 */
describe('C-VERIFICACIONES-SIN-ENVIAR · quien se registró y no mandó sus fotos', () => {
  async function preparar() {
    const m = mundo();
    await zonas(m);
    const admin = await m.cuenta('admin', 'Soporte Bandeja');
    await conductor(m, { nombre: 'Marta Lista', estado: 'aprobado' });
    await conductor(m, { nombre: 'José Pérez' });
    const nuevo = async (
      nombre: string,
      rol: 'repartidor' | 'restaurante' | 'cliente',
      zona: string,
      horas: number,
      extra: { prueba?: boolean; telefono?: string; codigo?: string } = {},
    ) => {
      const c = await m.cuenta(rol, nombre);
      await m.DB.prepare(
        "UPDATE usuarios SET zona_id = ?, creado_en = datetime('now', ?), es_prueba = ?, telefono = ? WHERE id = ?",
      )
        .bind(zona, `-${horas} hours`, extra.prueba ? 1 : 0, extra.telefono ?? null, c.id)
        .run();
      if (rol === 'repartidor')
        await m.DB.prepare(
          `INSERT INTO repartidores (usuario_id, zona_id, codigo) VALUES (?, ?, ?)
           ON CONFLICT(usuario_id) DO UPDATE SET zona_id = excluded.zona_id, codigo = excluded.codigo`,
        )
          .bind(c.id, zona, extra.codigo ?? null)
          .run();
      return c;
    };
    const andres = await nuevo('Andrés Peñalver Ejemplo', 'repartidor', ZONA_NORTE, 30, {
      telefono: '+1 (313) 555-0188',
      codigo: 'US-ZZN-000044',
    });
    const rosa = await nuevo('Rosa Campos', 'repartidor', ZONA_SUR, 2);
    const duena = await nuevo('Dueña Cocina', 'restaurante', ZONA_SUR, 5);
    await nuevo('Luis Prueba', 'repartidor', ZONA_NORTE, 1, { prueba: true });
    // Un cliente no pasa por verificación: nunca sale aquí.
    await nuevo('Clienta Normal', 'cliente', ZONA_NORTE, 1);
    // Quien empezó la verificación anterior y el equipo le pidió repetir la cara vuelve a «sin enviar».
    const repite = await nuevo('Pedro Repite', 'repartidor', ZONA_NORTE, 50);
    await m.DB.prepare(
      "INSERT INTO kyc (usuario_id, estado, doc_tipo) VALUES (?, 'sin_enviar', 'identificacion')",
    )
      .bind(repite.id)
      .run();
    return { m, admin, andres, rosa, duena, repite };
  }

  it('la pestaña trae solo a quien no ha enviado, lo más nuevo primero, con su contador en todas las pestañas', async () => {
    const { m, admin, andres } = await preparar();
    const r = await bandeja(m, admin.token, 'estado=sin_enviar');
    expect(r.estado).toBe(200);
    expect(r.datos.solicitudes.map((s: { nombre: string }) => s.nombre)).toEqual([
      'Rosa Campos',
      'Dueña Cocina',
      'Andrés Peñalver Ejemplo',
      'Pedro Repite',
    ]);
    expect(r.datos.totales).toMatchObject({ sin_enviar: 4 });
    const fila = r.datos.solicitudes.find((s: { id: string }) => s.id === andres.id);
    expect(fila).toMatchObject({
      estado: 'sin_enviar',
      rol: 'repartidor',
      codigo: 'US-ZZN-000044',
      zonaId: ZONA_NORTE,
      zona: 'Ciudad Norte',
      correoConfirmado: false,
      fotosSubidas: 0,
      miniatura: null,
      comprobaciones: [],
    });
    expect(String(fila.creado)).toMatch(/^\d{4}-\d{2}-\d{2}/);
    // El contador sale también al abrir Pendientes (lo primero que se ve).
    expect((await bandeja(m, admin.token)).datos.totales).toEqual({
      pendiente: 1,
      aprobado: 1,
      sin_enviar: 4,
    });
  });

  it('busca por nombre, apellido, correo, teléfono e ID; filtra por zona y por cuentas de prueba', async () => {
    const { m, admin } = await preparar();
    const con = async (q: string) =>
      nombres(await bandeja(m, admin.token, `estado=sin_enviar&${q}`));
    for (const q of ['andres', 'peñalver', 'penalver ej', '555-0188', 'US-ZZN-000044', '%23000044'])
      expect(await con(`q=${q}`), q).toEqual(['Andrés Peñalver Ejemplo']);
    expect(await con(`zona=${ZONA_SUR}`)).toEqual(['Dueña Cocina', 'Rosa Campos']);
    expect(await con('cuentas=prueba')).toEqual(['Luis Prueba']);
    expect((await bandeja(m, admin.token, 'q=penalver')).datos.totales).toEqual({ sin_enviar: 1 });
  });

  it('quien ya envió deja de salir; la cuenta borrada tampoco sale', async () => {
    const { m, admin, rosa, duena } = await preparar();
    await m.DB.prepare(
      "INSERT INTO kyc (usuario_id, estado, doc_tipo, enviado_en) VALUES (?, 'pendiente', 'identificacion', datetime('now'))",
    )
      .bind(rosa.id)
      .run();
    await m.DB.prepare("UPDATE usuarios SET activo = 0, nombre = 'Cuenta borrada' WHERE id = ?")
      .bind(duena.id)
      .run();
    const r = await bandeja(m, admin.token, 'estado=sin_enviar');
    expect(nombres(r)).toEqual(['Andrés Peñalver Ejemplo', 'Pedro Repite']);
    expect(r.datos.totales.sin_enviar).toBe(2);
  });

  it('pagina sin repetir ni perder a nadie y el contador se detiene en 100', async () => {
    const { m, admin } = await preparar();
    await m.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 120)
       INSERT INTO usuarios (id, correo, nombre, rol, clave_hash, creado_en)
       SELECT 'se-' || i, 'se' || i || '@ejemplo.com', 'Nueva ' || i, 'repartidor', 'x', datetime('now', '-' || (i % 7) || ' days') FROM n`,
    ).run();
    const vistos = new Set<string>();
    let despues = '';
    for (let vuelta = 0; vuelta < 6; vuelta++) {
      const r = await bandeja(
        m,
        admin.token,
        `estado=sin_enviar${despues ? `&despues=${encodeURIComponent(despues)}` : ''}`,
      );
      if (vuelta === 0) expect(r.datos.totales.sin_enviar).toBe(100);
      for (const s of r.datos.solicitudes as { id: string }[]) {
        expect(vistos.has(s.id), s.id).toBe(false);
        vistos.add(s.id);
      }
      despues = r.datos.siguiente ?? '';
      if (!despues) break;
    }
    expect(vistos.size).toBe(124);
  });

  it('la página baja por el índice de cuentas por rol y fecha: no recorre ni ordena la tabla de cuentas', async () => {
    const { m } = await preparar();
    const filtros = { zona: '', cuentas: undefined, q: '', alcance: { sql: '', valores: [] } };
    for (const q of consultasSinEnviar(filtros, '')) {
      const plan = await m.DB.prepare(`EXPLAIN QUERY PLAN ${q.sql}`)
        .bind(...q.valores)
        .all<{ detail: string }>();
      const detalle = plan.results.map((x) => x.detail).join(' | ');
      expect(detalle).toMatch(/SEARCH u USING INDEX usuarios_rol_creado \(rol=\?\)/);
      expect(detalle).not.toMatch(/SCAN u\b/);
      // Solo ordena los empates de fecha (lo último del ORDER BY), nunca toda la lista.
      expect(detalle).not.toMatch(/USE TEMP B-TREE FOR ORDER BY/);
    }
  });

  it('quien trabaja en una zona solo ve a los de su zona, también en el contador', async () => {
    const { m, admin } = await preparar();
    const correo = `emp-${Math.random().toString(36).slice(2)}@ejemplo.com`;
    const inv = await m.llamar(
      'POST',
      '/datos/admin/equipo/invitaciones',
      {
        correo,
        nombre: 'Persona Equipo',
        plantillas: ['total'],
        motivo: 'Alta de prueba',
        alcance: { zonas: [ZONA_SUR] },
      },
      admin.token,
    );
    expect(inv.estado, JSON.stringify(inv.datos)).toBe(201);
    const a = await m.llamar('POST', '/datos/equipo-interno/invitacion/aceptar', {
      codigo: new URL(inv.datos.enlace).searchParams.get('code'),
      nombre: 'Persona Equipo',
      clave: 'clave-segura-1',
    });
    const r = await bandeja(m, a.datos.token as string, 'estado=sin_enviar');
    // La dueña todavía no tiene comercio, así que no tiene zona: la ve quien tiene alcance total.
    expect(nombres(r)).toEqual(['Rosa Campos']);
    expect(r.datos.totales).toEqual({ sin_enviar: 1 });
  });
});

describe('C-VERIFICACIONES-BANDEJA · mirar no escribe y lee poco (con el volumen de un sitio con uso)', () => {
  it('abrir la bandeja, buscar y cambiar de pestaña escriben 0 filas y leen pocas', async () => {
    let medidor!: ReturnType<typeof medidorDeLecturas>;
    let conteo!: ReturnType<typeof contarFilas>;
    const escrituras: string[] = [];
    const m = mundo(
      {},
      {
        envolver: (db) => {
          medidor = medidorDeLecturas(db);
          conteo = contarFilas(medidor.db);
          return new Proxy(conteo.db, {
            get(t, prop) {
              if (prop === 'prepare')
                return (sql: string) => {
                  if (/^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(sql)) escrituras.push(sql);
                  return t.prepare(sql);
                };
              const v = Reflect.get(t, prop, t) as unknown;
              return typeof v === 'function' ? (v as (...x: unknown[]) => unknown).bind(t) : v;
            },
          });
        },
      },
    );
    await sembrarVolumen(m.DB);
    await m.llamar('GET', '/datos/version');
    await zonas(m);
    const admin = await m.cuenta('admin', 'Soporte Lecturas');
    for (let i = 0; i < 4; i++) await conductor(m, { nombre: `Persona Bandeja ${i}` });
    await m.sesionLista(admin.token);
    escrituras.length = 0;
    const antes = { ...conteo.cuenta };
    const medida = await medidor.medir(async () => {
      for (const q of ['', 'estado=aprobado', 'q=persona', `zona=${ZONA_NORTE}`, 'cuentas=todas'])
        expect((await bandeja(m, admin.token, q)).estado).toBe(200);
    });
    expect(escrituras, escrituras.join('\n')).toEqual([]);
    expect(conteo.cuenta.escritas - antes.escritas).toBe(0);
    // C-VERIFICACIONES-SIN-ENVIAR: el contador de «Sin enviar» corta al juntar 100 cuentas (LIMIT).
    // El medidor estima con el plan y no ve ese corte (cuenta el rol entero), así que ese contador se
    // mide aparte, con lo que de verdad devuelve y con su tope escrito en la consulta.
    const esContador = (sql: string) =>
      /SELECT COUNT\(\*\) AS n FROM \(SELECT 1 FROM usuarios u/.test(sql);
    const contadores = medida.lecturas.filter((l) => esContador(l.sql));
    expect(contadores.length).toBe(5);
    for (const l of contadores) {
      expect(
        consultaTotalSinEnviar({
          zona: '',
          cuentas: undefined,
          q: '',
          alcance: { sql: '', valores: [] },
        }).sql,
      ).toMatch(/LIMIT 100\)$/);
      expect(l.escaneos.join(' '), l.sql).not.toMatch(/^usuarios \(|, usuarios \(/);
    }
    const filas = medida.lecturas
      .filter((l) => !esContador(l.sql))
      .reduce((n, l) => n + l.filas, 0);
    const detalle = medida.lecturas
      .filter((l) => !esContador(l.sql))
      .filter((l) => l.filas > 20)
      .map((l) => `${l.filas} (${l.escaneos.join(', ')}): ${l.sql.slice(0, 160)}`)
      .join('\n');
    // Cinco aperturas de la bandeja: unas pocas filas por consulta, nunca una tabla grande entera.
    expect(filas, detalle).toBeLessThan(600);
  });
});
