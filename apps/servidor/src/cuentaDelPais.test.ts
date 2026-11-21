import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { repararCuentasDePais } from './reparacionPais';

/**
 * C-LINEA-SE-UNE-SOLA, C-ID-DEL-PAIS, C-TELEFONO-E164, C-PAIS-DE-LA-CUENTA y C-EN-LINEA-DE-VERDAD
 * (21 nov 2026). El caso real del primer líder de una línea de mototaxis de El Vigía: el equipo lo
 * invitó por correo, él se registró en Driver con ese mismo correo y su celular «0424…», y salió todo
 * mal a la vez: la línea no se unió, su ID fue «US-MIA-…», su celular quedó sin código de país, la
 * ficha decía «En línea» sin nada aprobado y no se le abrió su plazo de 30 días.
 */
const VIGIA = 'VE-MER-ELVIGIA';
const EN_VIGIA = { lat: 8.6159, lng: -71.6442 };
afterEach(() => vi.unstubAllGlobals());

async function escenario() {
  vi.stubGlobal('fetch', async () => new Response('{}', { status: 200 }));
  const m = mundo({ ADMIN_CORREOS: 'dueno@ejemplo.com' }, { host: 'staging.tumbite.com' });
  await m.DB.prepare(
    `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
     VALUES (?, 'El Vigía', 'VE', 'USD', 'America/Caracas', 8.6219, -71.6506, 15, 1)`,
  )
    .bind(VIGIA)
    .run();
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const invitar = (lider: string) =>
    m.llamar(
      'POST',
      '/datos/admin/lineas',
      {
        nombre: 'Línea Ejemplo',
        zonaId: VIGIA,
        tipo: 'mototaxi',
        lider,
        contacto2Nombre: 'Contacto Dos',
        contacto2Telefono: '+584120000002',
        invitar: true,
      },
      admin.token,
    );
  const registrar = (correo: string, telefono: string, ipPais?: string) =>
    m.llamar(
      'POST',
      '/datos/cuentas/registro',
      {
        nombre: 'Líder Ejemplo',
        correo,
        clave: 'clave-segura-1',
        rol: 'repartidor',
        telefono,
        idioma: 'es',
      },
      undefined,
      ipPais ? { 'cf-ipcountry': ipPais } : {},
    );
  return { m, admin, invitar, registrar };
}

describe('el líder invitado que se registra con el mismo correo', () => {
  it('su línea se une SOLA al crear la cuenta, sin abrir «Mi línea»', async () => {
    const { m, invitar, registrar } = await escenario();
    expect((await invitar('lider.ejemplo@ejemplo.com')).estado).toBe(201);
    const r = await registrar('lider.ejemplo@ejemplo.com', '0424-0000001');
    expect(r.estado, JSON.stringify(r.datos)).toBe(201);
    const linea = await m.DB.prepare(
      'SELECT e.nombre, e.zona_id FROM equipos e JOIN lineas l ON l.equipo_id = e.id WHERE e.lider_id = ?',
    )
      .bind(r.datos.usuario.id)
      .first<{ nombre: string; zona_id: string }>();
    expect(linea).toEqual({ nombre: 'Línea Ejemplo', zona_id: VIGIA });
    const inv = await m.DB.prepare('SELECT estado FROM invitaciones_lider').first<{
      estado: string;
    }>();
    expect(inv?.estado).toBe('usada');
  });

  it('su cuenta nace en la ciudad de la invitación, con su ID de Venezuela y su plazo de 30 días', async () => {
    const { m, invitar, registrar } = await escenario();
    await invitar('lider.ejemplo@ejemplo.com');
    const r = await registrar('lider.ejemplo@ejemplo.com', '0424-0000001');
    const ficha = await m.llamar('GET', '/datos/repartidor/estado', undefined, r.datos.token);
    expect(ficha.estado).toBeLessThan(500);
    const fila = await m.DB.prepare(
      'SELECT r.codigo, r.zona_id, u.zona_id AS cuenta FROM repartidores r JOIN usuarios u ON u.id = r.usuario_id WHERE u.id = ?',
    )
      .bind(r.datos.usuario.id)
      .first<{ codigo: string; zona_id: string; cuenta: string }>();
    expect(fila?.cuenta).toBe(VIGIA);
    expect(fila?.zona_id).toBe(VIGIA);
    expect(fila?.codigo).toMatch(/^VE-ELV-\d{6}$/);
    // Se conecta desde El Vigía: su plazo de papeles se abre (Venezuela tiene plazo).
    await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, ...EN_VIGIA },
      r.datos.token,
    );
    const plazo = await m.DB.prepare(
      'SELECT pais, estado FROM plazo_papeles WHERE conductor_id = ?',
    )
      .bind(r.datos.usuario.id)
      .first<{ pais: string; estado: string }>();
    expect(plazo).toEqual({ pais: 'VE', estado: 'en_plazo' });
  });

  it('su celular «0424…» se guarda con el código de su país (+58), nunca «+0…»', async () => {
    const { m, invitar, registrar } = await escenario();
    await invitar('lider.ejemplo@ejemplo.com');
    const r = await registrar('lider.ejemplo@ejemplo.com', '04240000001');
    const u = await m.DB.prepare('SELECT telefono, telefono_canonico FROM usuarios WHERE id = ?')
      .bind(r.datos.usuario.id)
      .first<{ telefono: string; telefono_canonico: string }>();
    expect(u).toEqual({ telefono: '+584240000001', telefono_canonico: '584240000001' });
  });

  it('un celular que no existe en su país se rechaza en su casilla', async () => {
    const { registrar } = await escenario();
    const r = await registrar('otra.persona@ejemplo.com', '0424-00001', 'VE');
    expect(r.estado).toBe(422);
    expect(r.datos.campo).toBe('telefono');
  });
});

describe('el conductor que se registra sin invitación ni ubicación', () => {
  it('no recibe un ID de Miami: el suyo llega con su ciudad real, y el plazo con ella', async () => {
    const { m, registrar } = await escenario();
    const r = await registrar('nuevo.conductor@ejemplo.com', '0412-0000003', 'VE');
    // Celular con el país desde donde se registró.
    const u = await m.DB.prepare('SELECT telefono FROM usuarios WHERE id = ?')
      .bind(r.datos.usuario.id)
      .first<{ telefono: string }>();
    expect(u?.telefono).toBe('+584120000003');
    await m.llamar('GET', '/datos/repartidor/estado', undefined, r.datos.token);
    const antes = await m.DB.prepare('SELECT codigo FROM repartidores WHERE usuario_id = ?')
      .bind(r.datos.usuario.id)
      .first<{ codigo: string | null }>();
    expect(antes?.codigo ?? null).toBeNull();
    await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, ...EN_VIGIA },
      r.datos.token,
    );
    const despues = await m.DB.prepare(
      'SELECT r.codigo, p.pais FROM repartidores r LEFT JOIN plazo_papeles p ON p.conductor_id = r.usuario_id WHERE r.usuario_id = ?',
    )
      .bind(r.datos.usuario.id)
      .first<{ codigo: string; pais: string | null }>();
    expect(despues?.codigo).toMatch(/^VE-ELV-/);
    expect(despues?.pais).toBe('VE');
  });
});

describe('la ficha del equipo', () => {
  it('conectado sin nada aprobado no dice «En línea»: recibeViajes es falso', async () => {
    const { m, admin, invitar, registrar } = await escenario();
    await invitar('lider.ejemplo@ejemplo.com');
    const r = await registrar('lider.ejemplo@ejemplo.com', '0424-0000001');
    await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, ...EN_VIGIA },
      r.datos.token,
    );
    const f = await m.llamar(
      'GET',
      `/datos/admin/repartidores/${r.datos.usuario.id}`,
      undefined,
      admin.token,
    );
    expect(f.estado).toBe(200);
    expect(f.datos.repartidor.recibeViajes).toBe(false);
    // C-FICHA-SIN-CONTRADICCION: dice el primer paso que le falta según la regla del reparto (con el
    // plazo abierto, lo que le falta es su vehículo) y que es líder de su línea.
    expect(f.datos.repartidor.falta).toBe('sin_vehiculo');
    expect(f.datos.repartidor.linea).toEqual({ nombre: 'Línea Ejemplo', rol: 'lider' });
    expect(f.datos.repartidor.telefono).toMatch(/^\+58 /);
  });
});

describe('la reparación de las cuentas que ya nacieron mal', () => {
  it('une la línea, corrige el ID (el viejo se sigue encontrando), el celular y abre el plazo', async () => {
    const { m, admin, invitar } = await escenario();
    // La cuenta como quedó en producción: sin ciudad al nacer, ID de Miami, celular sin código.
    const c = await m.cuenta('repartidor', 'Líder Ejemplo');
    await m.DB.prepare(
      "UPDATE usuarios SET correo = 'lider.ejemplo@ejemplo.com', correo_canonico = 'lider.ejemplo@ejemplo.com', telefono = '04240000001', telefono_canonico = '04240000001', zona_id = ? WHERE id = ?",
    )
      .bind(VIGIA, c.id)
      .run();
    await m.DB.prepare(
      "INSERT INTO repartidores (usuario_id, zona_id, codigo, ubicacion_en) VALUES (?, ?, 'US-MIA-000019', datetime('now')) ON CONFLICT(usuario_id) DO UPDATE SET zona_id = excluded.zona_id, codigo = excluded.codigo, ubicacion_en = excluded.ubicacion_en",
    )
      .bind(c.id, VIGIA)
      .run();
    await m.DB.prepare('DELETE FROM plazo_papeles WHERE conductor_id = ?').bind(c.id).run();
    // La invitación se hizo antes de que existiera su cuenta de conductor.
    await m.DB.prepare("UPDATE usuarios SET rol = 'cliente' WHERE id = ?").bind(c.id).run();
    expect((await invitar('lider.ejemplo@ejemplo.com')).estado).toBe(201);
    await m.DB.prepare("UPDATE usuarios SET rol = 'repartidor' WHERE id = ?").bind(c.id).run();
    // La invitación sigue esperando (la cuenta ya existía cuando se invitó y nadie abrió «Mi línea»).
    expect(
      (await m.DB.prepare('SELECT estado FROM invitaciones_lider').first<{ estado: string }>())
        ?.estado,
    ).toBe('pendiente');

    const env = { DB: m.DB } as never;
    const r = await repararCuentasDePais(env, m.DB);
    expect(r).toMatchObject({ lineas: 1, telefonos: 1, codigos: 1, plazos: 1 });

    const fila = await m.DB.prepare(
      'SELECT r.codigo, u.telefono, (SELECT COUNT(*) FROM equipos e JOIN lineas l ON l.equipo_id = e.id WHERE e.lider_id = u.id) AS lineas FROM usuarios u JOIN repartidores r ON r.usuario_id = u.id WHERE u.id = ?',
    )
      .bind(c.id)
      .first<{ codigo: string; telefono: string; lineas: number }>();
    expect(fila?.codigo).toMatch(/^VE-ELV-\d{6}$/);
    expect(fila?.telefono).toBe('+584240000001');
    expect(fila?.lineas).toBe(1);
    // El ID viejo se sigue encontrando en el buscador y en la lista.
    const busca = await m.llamar(
      'GET',
      '/datos/admin/repartidores?q=US-MIA-000019',
      undefined,
      admin.token,
    );
    expect(busca.datos.repartidores.map((x: { id: string }) => x.id)).toContain(c.id);
    // Correr la reparación otra vez no cambia nada.
    expect(await repararCuentasDePais(env, m.DB)).toMatchObject({
      lineas: 0,
      telefonos: 0,
      codigos: 0,
      plazos: 0,
    });
  });
});

describe('C-TERRITORIO-OFICIAL · cada zona con su municipio oficial', () => {
  const ASSETS = {
    fetch: async (url: string) => {
      const ruta = new URL(url).pathname;
      const { readFileSync } = await import('node:fs');
      const { join } = await import('node:path');
      return new Response(readFileSync(join(__dirname, '../../panel/public', ruta), 'utf8'));
    },
  };

  it('al crear la zona de El Vigía queda en Alberto Adriani (VE1401); el equipo lo puede corregir', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 200 }));
    const m = mundo({ ASSETS }, { host: 'staging.tumbite.com' });
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    const r = await m.llamar(
      'PUT',
      '/datos/admin/zonas',
      {
        id: 'VE-MER-PRUEBA',
        nombre: 'Ciudad de ejemplo',
        pais: 'VE',
        lat: 8.6159,
        lng: -71.6442,
        radioKm: 10,
        activa: false,
        region: 'MER',
        idioma: 'es',
      },
      admin.token,
    );
    expect(r.estado, JSON.stringify(r.datos)).toBe(200);
    const lista = await m.llamar('GET', '/datos/admin/zonas', undefined, admin.token);
    const zona = lista.datos.zonas.find((z: { id: string }) => z.id === 'VE-MER-PRUEBA');
    expect(zona.municipio).toEqual({
      pcode: 'VE1401',
      nombre: 'Alberto Adriani',
      entidad: { pcode: 'VE14', nombre: 'Mérida' },
    });
    expect(
      (
        await m.llamar(
          'PATCH',
          '/datos/admin/zonas/VE-MER-PRUEBA',
          { municipioPcode: 'VE9999' },
          admin.token,
        )
      ).estado,
    ).toBe(422);
    expect(
      (
        await m.llamar(
          'PATCH',
          '/datos/admin/zonas/VE-MER-PRUEBA',
          { municipioPcode: 'VE1402' },
          admin.token,
        )
      ).estado,
    ).toBe(200);
    // El responsable de la zona se escribe como en Venezuela y queda con su código.
    await m.llamar(
      'PATCH',
      '/datos/admin/zonas/VE-MER-PRUEBA',
      { responsableNombre: 'Responsable Ejemplo', responsableTelefono: '0412-0000004' },
      admin.token,
    );
    const f = await m.DB.prepare(
      'SELECT municipio_pcode, responsable_telefono FROM zonas WHERE id = ?',
    )
      .bind('VE-MER-PRUEBA')
      .first<{ municipio_pcode: string; responsable_telefono: string }>();
    expect(f).toEqual({ municipio_pcode: 'VE1402', responsable_telefono: '+584120000004' });
  });
});

describe('C-TELEFONO-E164 · el país del celular en el registro', () => {
  it('el servidor sugiere el país desde donde se abre la app, sin tocar la base', async () => {
    const { m } = await escenario();
    const r = await m.llamar('GET', '/datos/cuentas/pais-sugerido', undefined, undefined, {
      'cf-ipcountry': 'VE',
    });
    expect(r.datos).toEqual({ pais: 'VE' });
    const raro = await m.llamar('GET', '/datos/cuentas/pais-sugerido', undefined, undefined, {
      'cf-ipcountry': 'XX',
    });
    expect(raro.datos).toEqual({ pais: null });
  });

  it('el país elegido en la pantalla manda sobre el de la conexión', async () => {
    const { m } = await escenario();
    const r = await m.llamar(
      'POST',
      '/datos/cuentas/registro',
      {
        nombre: 'Persona Ejemplo',
        correo: 'persona.peru@ejemplo.com',
        clave: 'clave-segura-1',
        rol: 'repartidor',
        telefono: '987654321',
        paisTelefono: 'PE',
      },
      undefined,
      { 'cf-ipcountry': 'US' },
    );
    expect(r.estado, JSON.stringify(r.datos)).toBe(201);
    const u = await m.DB.prepare('SELECT telefono FROM usuarios WHERE id = ?')
      .bind(r.datos.usuario.id)
      .first<{ telefono: string }>();
    expect(u?.telefono).toBe('+51987654321');
  });
});

describe('C-SIN-ZONA-VISIBLE · ninguna cuenta cae en una ciudad inventada', () => {
  it('sin invitación ni ubicación: «sin zona» en la ficha y en la lista, nunca Miami, y con su aviso', async () => {
    const { m, admin } = await escenario();
    const r = await m.llamar('POST', '/datos/cuentas/registro', {
      nombre: 'Conductor Ejemplo',
      correo: 'sin.zona@ejemplo.com',
      clave: 'clave-segura-1',
      rol: 'repartidor',
      telefono: '04140000005',
    });
    expect(r.estado).toBe(201);
    await m.llamar('GET', '/datos/repartidor/estado', undefined, r.datos.token);
    // El celular «0414…» solo existe en Venezuela: queda con su código aunque no se sepa la ciudad.
    const u = await m.DB.prepare('SELECT telefono FROM usuarios WHERE id = ?')
      .bind(r.datos.usuario.id)
      .first<{ telefono: string }>();
    expect(u?.telefono).toBe('+584140000005');
    const f = await m.llamar(
      'GET',
      `/datos/admin/repartidores/${r.datos.usuario.id}`,
      undefined,
      admin.token,
    );
    expect(f.datos.repartidor.sinZona).toBe(true);
    expect(f.datos.repartidor.ciudad).toBe('');
    expect(f.datos.repartidor.codigo).toBe('');
    const lista = await m.llamar(
      'GET',
      '/datos/admin/repartidores?zona=sin_zona',
      undefined,
      admin.token,
    );
    expect(lista.datos.repartidores.map((x: { id: string }) => x.id)).toContain(r.datos.usuario.id);
    expect(lista.datos.sinZona).toBeGreaterThanOrEqual(1);
    expect(lista.datos.repartidores[0].sinZona).toBe(true);
  });

  it('la ubicación del registro dentro de una zona le da su ciudad; fuera, nada', async () => {
    const { m } = await escenario();
    const { zonaPorUbicacionDelRegistro } = await import('./cuentaPais');
    expect(
      await zonaPorUbicacionDelRegistro(m.DB, { latitude: '8.6159', longitude: '-71.6442' }),
    ).toBe(VIGIA);
    expect(
      await zonaPorUbicacionDelRegistro(m.DB, { latitude: '13.5', longitude: '-66' }),
    ).toBeNull();
    expect(await zonaPorUbicacionDelRegistro(m.DB, undefined)).toBeNull();
  });

  it('la reparación arregla el celular de una cuenta sin zona y la deja «sin zona» (no le inventa ciudad)', async () => {
    const { m } = await escenario();
    const c = await m.cuenta('repartidor', 'Conductor Ejemplo');
    await m.DB.prepare(
      "UPDATE usuarios SET telefono = '04140000006', telefono_canonico = '04140000006', zona_id = NULL WHERE id = ?",
    )
      .bind(c.id)
      .run();
    await m.DB.prepare(
      "INSERT INTO repartidores (usuario_id, codigo) VALUES (?, 'US-MIA-000099') ON CONFLICT(usuario_id) DO UPDATE SET codigo = excluded.codigo",
    )
      .bind(c.id)
      .run();
    await repararCuentasDePais({ DB: m.DB } as never, m.DB);
    const f = await m.DB.prepare('SELECT u.telefono, u.zona_id FROM usuarios u WHERE u.id = ?')
      .bind(c.id)
      .first<{ telefono: string; zona_id: string | null }>();
    expect(f).toEqual({ telefono: '+584140000006', zona_id: null });
  });
});
