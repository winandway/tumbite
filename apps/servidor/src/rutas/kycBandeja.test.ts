import { afterEach, describe, expect, it } from 'vitest';
import { contarFilas } from '../presupuestoFilas';
import { mundo } from '../pruebas/ayuda';
import { medidorDeLecturas, sembrarVolumen } from '../pruebas/lecturas';
import { olvidarSegundoFactor } from '../segundoFactor';
import { olvidarAnotadosRecientes } from '../accesoInterno';
import { condicionBusqueda, resumenCara, resumenComprobacion } from './kycBandeja';

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
    expect(r.datos.totales).toEqual({ pendiente: 2, aprobado: 1, rechazado: 1 });
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
    expect(r.datos.totales).toEqual({ aprobado: 1 });
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
    expect(r.datos.totales).toEqual({ pendiente: 1 });
    expect(nombres(await bandeja(m, sur, 'q=jose'))).toEqual([]);
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
    const filas = medida.lecturas.reduce((n, l) => n + l.filas, 0);
    const detalle = medida.lecturas
      .filter((l) => l.filas > 20)
      .map((l) => `${l.filas} (${l.escaneos.join(', ')}): ${l.sql.slice(0, 160)}`)
      .join('\n');
    // Cinco aperturas de la bandeja: unas pocas filas por consulta, nunca una tabla grande entera.
    expect(filas, detalle).toBeLessThan(600);
  });
});
