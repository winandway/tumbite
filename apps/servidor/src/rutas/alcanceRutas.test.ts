import { afterEach, describe, expect, it } from 'vitest';
import {
  ALCANCE_RUTAS_ADMIN,
  LIBRE,
  LISTA_RUTAS_ADMIN,
  PERMISOS_RUTAS_ADMIN,
  PERMISOS_SOLO_ALCANCE_TOTAL,
  PLANTILLAS_SISTEMA,
  calcularAcceso,
} from '@tumbite/compartido';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';
import { olvidarSegundoFactor } from '../segundoFactor';
import { anotarAccesoSensibleUnaVez, olvidarAnotadosRecientes } from '../accesoInterno';

/**
 * C-PERMISOS-FINOS, alcance por ciudad y servicio (devuelto por el revisor el 15 nov 2026). Cada
 * prueba se vio en rojo quitando su pieza (anotado en CANDADOS.md).
 */
type Mundo = ReturnType<typeof mundo>;

afterEach(() => {
  olvidarSegundoFactor();
  olvidarAnotadosRecientes();
});

async function invitar(
  m: Mundo,
  token: string,
  plantillas: string[],
  extra: Record<string, unknown> = {},
) {
  const correo = `emp-${Math.random().toString(36).slice(2)}@ejemplo.com`;
  const r = await m.llamar(
    'POST',
    '/datos/admin/equipo/invitaciones',
    { correo, nombre: 'Persona Equipo', plantillas, motivo: 'Alta de prueba', ...extra },
    token,
  );
  return { r, codigo: r.datos.enlace ? new URL(r.datos.enlace).searchParams.get('code') : null };
}

const aceptar = (m: Mundo, codigo: string | null) =>
  m.llamar('POST', '/datos/equipo-interno/invitacion/aceptar', {
    codigo,
    nombre: 'Persona Equipo',
    clave: 'clave-segura-1',
  });

async function empleado(
  m: Mundo,
  token: string,
  plantillas: string[],
  extra: Record<string, unknown> = {},
) {
  const inv = await invitar(m, token, plantillas, extra);
  expect(inv.r.estado, JSON.stringify(inv.r.datos)).toBe(201);
  const a = await aceptar(m, inv.codigo);
  expect(a.estado, JSON.stringify(a.datos)).toBe(201);
  return { token: a.datos.token as string, id: a.datos.usuario.id as string };
}

/**
 * Un mundo con TODO lo de una ciudad (la «A»): comercio, cliente, pedido, repartidor con vehículo,
 * papel, verificación y habilitación, viaje con emergencia, ticket, solicitud de cancelación y
 * lista de espera. Cada nombre lleva «Zeta» para buscarlo en las respuestas.
 */
async function ciudadA(m: Mundo, adminToken: string) {
  const dueno = await m.cuenta('restaurante', 'Zeta Dueno Ajeno');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const rid = r.datos.restaurante.id as string;
  await m.llamar('PATCH', `/datos/admin/restaurantes/${rid}`, { estado: 'aprobado' }, adminToken);
  await m.DB.prepare("UPDATE restaurantes SET nombre = 'Zeta Pizzeria Ajena' WHERE id = ?")
    .bind(rid)
    .run();
  const zona =
    (
      await m.DB.prepare('SELECT zona_id FROM restaurantes WHERE id = ?')
        .bind(rid)
        .first<{ zona_id: string | null }>()
    )?.zona_id ?? 'US-FL-MIAMI';
  await m.DB.prepare('UPDATE restaurantes SET zona_id = ? WHERE id = ?').bind(zona, rid).run();
  const otraZona =
    (
      await m.DB.prepare('SELECT id FROM zonas WHERE id != ? ORDER BY id LIMIT 1')
        .bind(zona)
        .first<{ id: string }>()
    )?.id ?? (zona === 'US-MI-NOVI' ? 'US-FL-MIAMI' : 'US-MI-NOVI');
  const cliente = await m.cuenta('cliente', 'Zeta Cliente Ajena');
  await m.DB.prepare("UPDATE usuarios SET telefono = '+13135550199', zona_id = ? WHERE id = ?")
    .bind(zona, cliente.id)
    .run();
  const pedido = crypto.randomUUID();
  await m.DB.prepare(
    `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio,
       cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia,
       plan, direccion, lat, lng, zona_id, pagado_en)
     VALUES (?, ?, ?, 'pagado', '[]', 2000, 300, 200, 0, 300, 2800, 400, 1600, 600, 0, 200,
       'basico', '200 Calle Zeta', 25.78, -80.2, ?, datetime('now'))`,
  )
    .bind(pedido, cliente.id, rid, zona)
    .run();
  const rep = await m.cuenta('repartidor', 'Zeta Repartidor Ajeno');
  const vehiculo = crypto.randomUUID();
  const papel = crypto.randomUUID();
  const operacion = crypto.randomUUID();
  const emergencia = crypto.randomUUID();
  const ticket = crypto.randomUUID();
  const cancelacion = crypto.randomUUID();
  const rutina = crypto.randomUUID();
  await m.DB.batch([
    m.DB.prepare('UPDATE usuarios SET zona_id = ? WHERE id = ?').bind(zona, rep.id),
    m.DB.prepare(
      `INSERT INTO repartidores (usuario_id, zona_id) VALUES (?, ?)
       ON CONFLICT(usuario_id) DO UPDATE SET zona_id = excluded.zona_id`,
    ).bind(rep.id, zona),
    m.DB.prepare(
      `INSERT OR REPLACE INTO habilitaciones (conductor_id, servicio_id, estado) VALUES (?, 'comida', 'pendiente')`,
    ).bind(rep.id),
    m.DB.prepare(
      "INSERT INTO vehiculos (id, conductor_id, tipo, placa, estado) VALUES (?, ?, 'carro', 'ZETA123', 'en_revision')",
    ).bind(vehiculo, rep.id),
    m.DB.prepare(
      "INSERT INTO conductor_documentos (id, conductor_id, tipo, clave, estado) VALUES (?, ?, 'licencia_moto', 'x', 'pendiente')",
    ).bind(papel, rep.id),
    m.DB.prepare(
      "INSERT OR REPLACE INTO kyc (usuario_id, estado, enviado_en) VALUES (?, 'pendiente', datetime('now'))",
    ).bind(rep.id),
    m.DB.prepare(
      `INSERT INTO operaciones (id, servicio_id, tipo_operacion, cliente_id, zona_id, estado_general)
       VALUES (?, 'carro', 'viaje_pasajero', ?, ?, 'buscando')`,
    ).bind(operacion, cliente.id, zona),
    m.DB.prepare(
      `INSERT INTO viajes (operacion_id, estado, ultimo_actor, ultima_clave, origen_lat, origen_lng,
         origen_direccion, destino_lat, destino_lng, destino_direccion, pin_recogida)
       VALUES (?, 'buscando', 'sistema', 'k', 25.78, -80.2, 'Origen Zeta', 25.79, -80.21, 'Destino Zeta', '4321')`,
    ).bind(operacion),
    m.DB.prepare(
      "INSERT INTO emergencias_viaje (id, operacion_id, actor_id, rol, lat, lng) VALUES (?, ?, ?, 'pasajero', 25.78, -80.2)",
    ).bind(emergencia, operacion, cliente.id),
    m.DB.prepare(
      `INSERT INTO tickets (id, codigo, tipo, nombre, correo, asunto, pedido_id, zona_id, usuario_id)
       VALUES (?, ?, 'queja', 'Zeta Cliente Ajena', 'zeta.ajena@ejemplo.com', 'Zeta reclamo ajeno', ?, ?, ?)`,
    ).bind(ticket, `Z${ticket.slice(0, 7)}`, pedido, zona, cliente.id),
    m.DB.prepare(
      "INSERT INTO solicitudes_cancelacion (id, pedido_id, restaurante_id, motivo) VALUES (?, ?, ?, 'Zeta motivo')",
    ).bind(cancelacion, pedido, rid),
    m.DB.prepare(
      "INSERT INTO lista_espera (id, tipo, zona_id, nombre, correo) VALUES (?, 'comensal', ?, 'Zeta Espera Ajena', 'zeta.espera@ejemplo.com')",
    ).bind(crypto.randomUUID(), zona),
    // C-VIAJES-FIJOS: un viaje fijo de la ciudad A.
    m.DB.prepare(
      `INSERT INTO rutinas_viaje (id, cliente_id, nombre, servicio_id, zona_id, origen_lat, origen_lng, origen_direccion,
         destino_lat, destino_lng, destino_direccion, dias, hora_ida)
       VALUES (?, ?, 'Zeta escuela', 'carro', ?, 25.78, -80.2, 'Origen Zeta', 25.79, -80.21, 'Destino Zeta', '1,2,3,4,5', '07:00')`,
    ).bind(rutina, cliente.id, zona),
    // C-CAMILA: una conversación de soporte del conductor de la ciudad A, con su caso.
    // (Su ficha nace al registrarse, con la bienvenida de Camila.)
    m.DB.prepare('UPDATE camila_personas SET zona_id = ?, mensajes = 1 WHERE usuario_id = ?').bind(
      zona,
      rep.id,
    ),
    m.DB.prepare(
      "INSERT INTO camila_casos (id, persona_id, resumen) SELECT ?, id, 'Zeta caso ajeno' FROM camila_personas WHERE usuario_id = ?",
    ).bind(crypto.randomUUID(), rep.id),
  ]);
  const ids = {
    pedido,
    viaje: operacion,
    ticket,
    cliente: cliente.id,
    repartidor: rep.id,
    restaurante: rid,
    persona: cliente.id,
    vehiculo,
    papel,
    emergencia,
    cancelacion,
    rutina,
  };
  return { ids, zona, otraZona, dueno };
}

/** Lo que nunca debe salir hacia alguien de otra zona: los ids, los nombres «Zeta» y el teléfono. */
function marcas(ids: Record<string, string>) {
  return [...new Set(Object.values(ids)), 'Zeta', 'ZETA', 'zeta', '5550199'];
}
/**
 * Lo marcado que aparece en una respuesta. Lo que la propia persona escribió en la consulta (el
 * buscador lo devuelve tal cual en `q`) se quita antes de mirar: eso no es una fuga.
 */
function fuga(texto: string, lista: string[], ruta = '') {
  let limpio = texto;
  const consulta = ruta.split('?')[1] ?? '';
  for (const v of new URLSearchParams(consulta).values()) if (v) limpio = limpio.split(v).join('');
  return lista.filter((x) => limpio.includes(x));
}

/** Las variantes de consulta con que se llama cada lista (búsquedas, estados, rangos, CSV). */
function variantes(ids: Record<string, string>) {
  const codigo = ids.pedido?.slice(0, 6) ?? '';
  return [
    '',
    '?q=Zeta',
    `?q=${codigo}`,
    `?q=${ids.pedido}`,
    `?q=${ids.viaje?.slice(0, 6)}`,
    '?q=ZETA123',
    '?q=0199',
    '?q=zeta.ajena@ejemplo.com',
    '?estado=todos',
    '?estado=pendiente',
    '?estado=en_revision',
    '?estado=vivos',
    `?pedido=${ids.pedido}`,
    '?desde=2000-01-01&hasta=2100-01-01',
    '?desde=2000-01-01&hasta=2100-01-01&formato=csv',
  ];
}

/** Las listas que, para alguien DE la ciudad A, sí muestran algo marcado (control: la prueba no es vacía). */
const LISTAS_CON_FILAS = [
  'GET /admin/buscar',
  'GET /admin/pedidos',
  'GET /admin/cancelaciones',
  'GET /admin/viajes',
  'GET /admin/viajes-fijos',
  'GET /admin/clientes',
  'GET /admin/repartidores',
  'GET /admin/vehiculos',
  'GET /admin/habilitaciones',
  'GET /admin/papeles-conductor',
  'GET /admin/kyc',
  'GET /admin/tickets',
  'GET /admin/lista-espera',
  'GET /admin/restaurantes',
  'GET /admin/tablero',
  // C-CAMILA: la bandeja y las conversaciones, por la ciudad de la persona.
  'GET /admin/camila/bandeja',
  'GET /admin/camila/hilos',
];
/** Las que solo dan números o comprueban por dentro: se revisan aparte (números en cero). */
const LISTAS_DE_NUMEROS = [
  'GET /admin/resumen',
  'GET /admin/informes',
  'GET /admin/pedidos/contadores',
  'GET /admin/datos-personales/:tipo/:id/:campo',
  'POST /admin/tickets',
  // C-MODERACION: la consulta lleva el alcance (la prueba propia está en moderacion.test.ts).
  'GET /admin/reportes',
  'POST /admin/reportes/:id/accion',
  // C-CAMILA: la ficha y las acciones comprueban la ciudad de la persona por dentro; lo de toda la
  // empresa (ajustes, aprendizaje) exige alcance total (prueba propia en camila.test.ts).
  'GET /admin/camila/hilos/:persona',
  // C-CAMILA-FALLOS: de toda la empresa, exigen alcance total por dentro (camila/fallos.test.ts).
  'GET /admin/camila/fallos',
  'GET /admin/camila/fallos/:id',
  'GET /admin/camila/fallos/:id/captura/:reporte',
  'POST /admin/camila/fallos/:id/arreglado',
  'GET /admin/camila/preguntas',
  'POST /admin/camila/preguntas',
  'POST /admin/camila/preguntas/:id/:decision',
  'POST /admin/camila/hilos/:persona/responder',
  'POST /admin/camila/hilos/:persona/devolver',
  'POST /admin/camila/casos/:id/cerrar',
  'GET /admin/camila/aprendizaje',
  'POST /admin/camila/aprendizaje/armar',
  'POST /admin/camila/aprendizaje/:id/aprobar',
  'POST /admin/camila/aprendizaje/:id/rechazar',
  'GET /admin/camila/ajustes',
  'PUT /admin/camila/ajustes',
];

const conIds = (patron: string, valor: (param: string) => string) =>
  patron.replace(/:([a-zA-Z]+)/g, (_, p: string) => encodeURIComponent(valor(p)));

describe('C-PERMISOS-FINOS: cada ruta del mapa dice «con alcance» o «global» (candado)', () => {
  it('toda ruta del mapa de permisos está clasificada, y nada más', () => {
    expect(Object.keys(ALCANCE_RUTAS_ADMIN).sort()).toEqual(
      Object.keys(PERMISOS_RUTAS_ADMIN).sort(),
    );
  });

  it('una ficha nombra un trozo de su propia ruta; una global lleva su motivo; lo libre nunca es de toda la empresa', () => {
    for (const [clave, a] of Object.entries(ALCANCE_RUTAS_ADMIN)) {
      if (a.modo === 'ficha') expect(clave, clave).toContain(`/:${a.param}`);
      if (a.modo === 'global') expect(a.motivo.length, clave).toBeGreaterThan(20);
      if (a.modo === 'global' && a.clase === 'empresa')
        expect(PERMISOS_RUTAS_ADMIN[clave], clave).not.toBe(LIBRE);
    }
  });

  it('las listas con alcance son exactamente las que revisa el barrido', () => {
    const consultas = Object.entries(ALCANCE_RUTAS_ADMIN)
      .filter(([, a]) => a.modo === 'consulta')
      .map(([k]) => k)
      .sort();
    expect(consultas).toEqual([...LISTAS_CON_FILAS, ...LISTAS_DE_NUMEROS].sort());
  });

  it('lo de toda la empresa (dinero, auditoría, configuración) solo vale con alcance total', () => {
    expect(PERMISOS_SOLO_ALCANCE_TOTAL).toEqual([
      'auditoria.ver',
      'config.editar',
      'config.ver',
      'dinero.aprobar',
      'dinero.conciliar',
      'dinero.configurar',
      'dinero.limites',
      'dinero.reembolsar',
      'dinero.solicitar',
      'dinero.ver',
    ]);
    const plantilla = PLANTILLAS_SISTEMA.find((p) => p.id === 'supervisor');
    const base = {
      dueno: false,
      perfilViejo: null,
      estado: 'activo' as const,
      ajustes: [],
      rutas: LISTA_RUTAS_ADMIN,
      soloAlcanceTotal: PERMISOS_SOLO_ALCANCE_TOTAL,
    };
    const asignar = (zonas: string[] | null) => ({
      plantillaId: 'supervisor',
      nombre: 'Supervisor',
      permisos: plantilla?.permisos ?? [],
      alcance: { paises: null, zonas, servicios: null },
      venceEn: null,
    });
    const ciudad = calcularAcceso({ ...base, asignaciones: [asignar(['US-MI-NOVI'])] });
    expect(ciudad.permisos).not.toContain('dinero.ver');
    expect(ciudad.permisos).not.toContain('auditoria.ver');
    expect(ciudad.permisos).toContain('pedidos.devolver');
    expect(ciudad.sinEfecto).toEqual(expect.arrayContaining(['dinero.ver', 'dinero.aprobar']));
    const todas = calcularAcceso({ ...base, asignaciones: [asignar(null)] });
    expect(todas.permisos).toEqual(expect.arrayContaining(['dinero.ver', 'auditoria.ver']));
    expect(todas.sinEfecto).toBeUndefined();
  });
});

describe('C-PERMISOS-FINOS: barrido de alcance sobre TODAS las rutas con datos', () => {
  it('alguien de otra ciudad, o de otro servicio, no recibe ni una fila de la ciudad A (y alguien de A sí)', async () => {
    const m = mundo();
    const total = await m.cuenta('admin', 'Soporte Total');
    const { ids, zona, otraZona } = await ciudadA(m, total.token);
    const otra = await empleado(m, total.token, ['total'], { alcance: { zonas: [otraZona] } });
    const moto = await empleado(m, total.token, ['total'], { alcance: { servicios: ['moto'] } });
    const aqui = await empleado(m, total.token, ['total'], { alcance: { zonas: [zona] } });
    const lista = marcas(ids);
    const leer = async (metodo: string, ruta: string, token: string, cuerpo?: unknown) => {
      const res = await m.crudo(ruta, {
        method: metodo,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      });
      return { estado: res.status, texto: await res.text() };
    };
    const vistoPorAqui = new Set<string>();
    for (const [clave, a] of Object.entries(ALCANCE_RUTAS_ADMIN)) {
      if (a.modo === 'global') continue;
      const [metodo = 'GET', patron = ''] = clave.split(' ');
      if (a.modo === 'ficha') {
        const ruta = `/datos${conIds(patron, (p) => (p === a.param ? ((ids as Record<string, string>)[a.objeto] ?? '') : p === 'decision' ? 'aprobar' : 'comida'))}`;
        for (const t of [otra.token, moto.token]) {
          const r = await leer(metodo, ruta, t, metodo === 'GET' ? undefined : {});
          expect([403, 404], `${clave} → ${r.estado} ${r.texto.slice(0, 120)}`).toContain(r.estado);
          expect(fuga(r.texto, lista), clave).toEqual([]);
        }
        continue;
      }
      if (metodo !== 'GET') continue;
      const rutas = patron.includes(':')
        ? (['cliente', 'repartidor', 'cuenta', 'ticket', 'restaurante', 'pedido'] as const).flatMap(
            (tipo) =>
              ['telefono', 'correo'].map((campo) =>
                conIds(patron, (p) =>
                  p === 'tipo'
                    ? tipo
                    : p === 'campo'
                      ? campo
                      : tipo === 'cuenta'
                        ? ids.cliente
                        : ((ids as Record<string, string>)[tipo] ?? ''),
                ),
              ),
          )
        : variantes(ids).map((q) => `${patron}${q}`);
      for (const r0 of rutas) {
        for (const t of [otra.token, moto.token]) {
          const r = await leer('GET', `/datos${r0}`, t);
          expect(fuga(r.texto, lista, r0), `${clave} ${r0} → ${r.texto.slice(0, 200)}`).toEqual([]);
        }
        const r = await leer('GET', `/datos${r0}`, aqui.token);
        if (fuga(r.texto, lista, r0).length) vistoPorAqui.add(clave);
      }
    }
    // Control: quien SÍ trabaja en la ciudad A ve lo de A en cada lista (la prueba no es vacía).
    expect([...vistoPorAqui].filter((k) => LISTAS_CON_FILAS.includes(k)).sort()).toEqual(
      [...LISTAS_CON_FILAS].sort(),
    );
    // Los números también son solo de su alcance.
    for (const t of [otra.token, moto.token]) {
      const c = await m.llamar('GET', '/datos/admin/pedidos/contadores', undefined, t);
      expect(c.datos.contadores.todos).toEqual({ vivos: 0, problemas: 0 });
      const inf = await m.llamar(
        'GET',
        '/datos/admin/informes?desde=2000-01-01&hasta=2100-01-01',
        undefined,
        t,
      );
      expect(JSON.stringify(inf.datos)).not.toContain(zona);
      expect(inf.datos.embudo.iniciados).toBe(0);
      const res = await m.llamar('GET', '/datos/admin/resumen', undefined, t);
      expect(res.datos.totales.ticketsAbiertos).toBe(0);
      expect(res.datos.ciudades.map((z: { id: string }) => z.id)).not.toContain(zona);
      const tab = await m.llamar('GET', '/datos/admin/tablero', undefined, t);
      expect(tab.datos.tablero.personas.clientes).toBe(0);
      expect(tab.datos.tablero.personas.restaurantes).toBe(0);
    }
    const cAqui = await m.llamar('GET', '/datos/admin/pedidos/contadores', undefined, aqui.token);
    expect(cAqui.datos.contadores.todos.vivos).toBeGreaterThan(0);
  }, 120_000);
});

describe('C-CAMILA: lo de toda la empresa exige alcance total', () => {
  it('quien trabaja una sola ciudad no ve los fallos reportados ni cambia los ajustes ni lo que Camila aprende', async () => {
    const m = mundo();
    const total = await m.cuenta('admin', 'Soporte Total');
    const { zona } = await ciudadA(m, total.token);
    const aqui = await empleado(m, total.token, ['total'], { alcance: { zonas: [zona] } });
    for (const [metodo, ruta] of [
      ['GET', '/datos/admin/camila/fallos'],
      ['GET', '/datos/admin/camila/preguntas'],
      ['POST', '/datos/admin/camila/fallos/x/arreglado'],
      ['POST', '/datos/admin/camila/aprendizaje/armar'],
      ['PUT', '/datos/admin/camila/ajustes'],
    ] as const) {
      const cuerpo =
        metodo === 'PUT'
          ? { ia: false, topeDiarioCentavos: 0, avisoIaPaises: [], regalosPorDia: 0 }
          : metodo === 'POST'
            ? {}
            : undefined;
      expect((await m.llamar(metodo, ruta, cuerpo, aqui.token)).estado, ruta).toBe(403);
    }
    expect(
      (await m.llamar('GET', '/datos/admin/camila/fallos', undefined, total.token)).estado,
    ).toBe(200);
  });
});

describe('C-PERMISOS-FINOS: el buscador de arriba', () => {
  it('cada grupo exige su permiso de lectura (no basta monitoreo.buscar)', async () => {
    const m = mundo();
    const total = await m.cuenta('admin', 'Soporte Total');
    const { ids } = await ciudadA(m, total.token);
    // Monitor: pedidos, viajes y comercios sí; clientes, repartidores y tickets no.
    const monitor = await empleado(m, total.token, ['monitor']);
    const grupos = async (q: string, t: string) =>
      (
        await m.llamar('GET', `/datos/admin/buscar?q=${encodeURIComponent(q)}`, undefined, t)
      ).datos.grupos.map((g: { tipo: string }) => g.tipo);
    expect(await grupos('Zeta', monitor.token)).toEqual(['restaurantes']);
    expect(await grupos(ids.pedido.slice(0, 6), monitor.token)).toContain('pedidos');
    // Verificador: repartidores sí; pedidos no.
    const verificador = await empleado(m, total.token, ['verificador']);
    expect(await grupos('Zeta', verificador.token)).toEqual(['repartidores']);
    expect(await grupos(ids.pedido.slice(0, 6), verificador.token)).toEqual([]);
    // Total ve todos.
    expect(await grupos('Zeta', total.token)).toEqual(
      expect.arrayContaining(['clientes', 'repartidores', 'restaurantes']),
    );
  });
});

describe('C-PERMISOS-FINOS: «Ver dato» mira el alcance', () => {
  it('fuera de su zona: 403, sin fila de lo visto y con el intento anotado; en su zona: 200 y una fila', async () => {
    const m = mundo();
    const total = await m.cuenta('admin', 'Soporte Total');
    const { ids, zona, otraZona } = await ciudadA(m, total.token);
    const otra = await empleado(m, total.token, ['soporte_2'], { alcance: { zonas: [otraZona] } });
    const aqui = await empleado(m, total.token, ['soporte_2'], { alcance: { zonas: [zona] } });
    for (const [tipo, id] of [
      ['cliente', ids.cliente],
      ['pedido', ids.pedido],
      ['ticket', ids.ticket],
      ['restaurante', ids.restaurante],
      ['repartidor', ids.repartidor],
      ['cuenta', ids.cliente],
    ] as const) {
      const r = await m.llamar(
        'GET',
        `/datos/admin/datos-personales/${tipo}/${id}/telefono`,
        undefined,
        otra.token,
      );
      expect(r.estado, tipo).toBe(403);
    }
    const vistos = () =>
      m.DB.prepare('SELECT usuario_id FROM accesos_sensibles').all<{ usuario_id: string }>();
    expect((await vistos()).results).toEqual([]);
    const intentos = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM acciones_equipo WHERE usuario_id = ? AND estado = 403 AND ruta LIKE '/datos/admin/datos-personales/%'",
    )
      .bind(otra.id)
      .first<{ n: number }>();
    expect(Number(intentos?.n)).toBe(6);
    const bien = await m.llamar(
      'GET',
      `/datos/admin/datos-personales/cliente/${ids.cliente}/telefono`,
      undefined,
      aqui.token,
    );
    expect(bien.estado).toBe(200);
    expect(bien.datos.valor).toBe('+13135550199');
    expect((await vistos()).results).toEqual([{ usuario_id: aqui.id }]);
  });
});

describe('C-PERMISOS-FINOS: el registro del chat no se salta', () => {
  it('leer el chat siempre deja UNA fila por pedido cada 30 minutos, con o sin `desde`', async () => {
    const m = mundo();
    const total = await m.cuenta('admin', 'Soporte Total');
    const { ids } = await ciudadA(m, total.token);
    const s1 = await empleado(m, total.token, ['soporte_1']);
    const filas = async () =>
      Number(
        (
          await m.DB.prepare(
            "SELECT COUNT(*) AS n FROM accesos_sensibles WHERE usuario_id = ? AND tipo = 'chat_pedido'",
          )
            .bind(s1.id)
            .first<{ n: number }>()
        )?.n,
      );
    // Con `desde` desde la primera lectura (antes, así no quedaba nada anotado).
    const primera = await m.llamar(
      'GET',
      `/datos/pedidos/${ids.pedido}/mensajes?desde=0.5`,
      undefined,
      s1.token,
    );
    expect(primera.estado).toBe(200);
    expect(await filas()).toBe(1);
    // Refrescar (con o sin `desde`) no escribe más filas.
    for (const q of ['', '', '?desde=7', '?desde=0.5']) {
      const r = await m.llamar(
        'GET',
        `/datos/pedidos/${ids.pedido}/mensajes${q}`,
        undefined,
        s1.token,
      );
      expect(r.estado).toBe(200);
    }
    expect(await filas()).toBe(1);
    // Otro proceso (sin la memoria): la base dice que ya está anotado y no escribe otra.
    olvidarAnotadosRecientes();
    await m.llamar('GET', `/datos/pedidos/${ids.pedido}/mensajes?desde=3`, undefined, s1.token);
    expect(await filas()).toBe(1);
    // Pasada la ventana, se anota de nuevo.
    olvidarAnotadosRecientes();
    await anotarAccesoSensibleUnaVez(
      m.DB,
      s1.id,
      `pedido:${ids.pedido}`,
      'chat_pedido',
      'pedidos.chat',
      30,
      Date.now() + 31 * 60_000,
    );
    expect(await filas()).toBe(2);
  });
});

describe('C-PERMISOS-FINOS: abrir un reclamo no revela lo de otra zona', () => {
  it('un código de otra ciudad responde exactamente como uno que no existe', async () => {
    const m = mundo();
    const total = await m.cuenta('admin', 'Soporte Total');
    const { ids, otraZona } = await ciudadA(m, total.token);
    const otra = await empleado(m, total.token, ['soporte_1'], { alcance: { zonas: [otraZona] } });
    const abrir = (enlace: string) =>
      m.llamar(
        'POST',
        '/datos/admin/tickets',
        { enlace, asunto: 'Reclamo de prueba', mensaje: 'Detalle del reclamo de prueba' },
        otra.token,
      );
    const ajeno = await abrir(ids.pedido.slice(0, 6));
    const nada = await abrir('fffffe');
    expect(ajeno.estado).toBe(nada.estado);
    expect(ajeno.datos).toEqual(nada.datos);
    const ajenoViaje = await abrir(ids.viaje);
    expect(ajenoViaje.estado).toBe(nada.estado);
    expect(ajenoViaje.datos).toEqual(nada.datos);
  });
});

describe('C-PERMISOS-FINOS: /datos/cuentas/yo devuelve solo lo público', () => {
  it('una cuenta del equipo no recibe sus permisos, su segundo factor ni la huella de su sesión', async () => {
    const m = mundo();
    const total = await m.cuenta('admin', 'Soporte Total');
    const s1 = await empleado(m, total.token, ['soporte_1']);
    for (const t of [s1.token, total.token]) {
      const r = await m.llamar('GET', '/datos/cuentas/yo', undefined, t);
      expect(Object.keys(r.datos.usuario).sort()).toEqual([
        'correo',
        'id',
        'idioma',
        'nombre',
        'rol',
      ]);
      expect(JSON.stringify(r.datos)).not.toMatch(/interno|sesionId|segundoFactor|permisos/);
    }
  });
});

describe('C-EQUIPO-INVITACION: lo aprobado se revisa al aceptar', () => {
  it('suspender a quien invitó cancela sus invitaciones', async () => {
    const m = mundo();
    const total = await m.cuenta('admin', 'Soporte Total');
    const jefe = await empleado(m, total.token, ['supervisor']);
    await m.llamar(
      'PUT',
      `/datos/admin/equipo/miembros/${jefe.id}`,
      {
        asignaciones: [{ plantillaId: 'supervisor', alcance: {} }],
        ajustes: [{ permiso: 'equipo.gestionar', tipo: 'extra', motivo: 'Gestiona el equipo' }],
        motivo: 'Jefe del equipo',
      },
      total.token,
    );
    const inv = await invitar(m, jefe.token, ['soporte_1']);
    expect(inv.r.estado).toBe(201);
    const s = await m.llamar(
      'POST',
      `/datos/admin/equipo/miembros/${jefe.id}/suspender`,
      { motivo: 'Suspensión de prueba' },
      total.token,
    );
    expect(s.estado).toBe(200);
    const cancelada = await m.DB.prepare(
      'SELECT cancelada_en FROM invitaciones_equipo WHERE invitado_por = ?',
    )
      .bind(jefe.id)
      .first<{ cancelada_en: string | null }>();
    expect(cancelada?.cancelada_en).toBeTruthy();
    const a = await aceptar(m, inv.codigo);
    expect(a.estado).toBeGreaterThanOrEqual(400);
    const cuentas = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM usuarios WHERE nombre = 'Persona Equipo'",
    ).first<{ n: number }>();
    expect(Number(cuentas?.n)).toBe(1);
  });

  it('si quien invitó ya no puede dar ese acceso, la invitación queda inválida al aceptarla', async () => {
    const m = mundo();
    const total = await m.cuenta('admin', 'Soporte Total');
    const jefe = await empleado(m, total.token, ['soporte_2']);
    const conGestion = (plantilla: string) =>
      m.llamar(
        'PUT',
        `/datos/admin/equipo/miembros/${jefe.id}`,
        {
          asignaciones: [{ plantillaId: plantilla, alcance: {} }],
          ajustes: [{ permiso: 'equipo.gestionar', tipo: 'extra', motivo: 'Gestiona el equipo' }],
          motivo: 'Cambio de puesto',
        },
        total.token,
      );
    expect((await conGestion('soporte_2')).estado).toBe(200);
    const inv = await invitar(m, jefe.token, ['soporte_1']);
    expect(inv.r.estado).toBe(201);
    // Le bajan el puesto a Monitor: ya no tiene lo de Soporte nivel 1.
    expect((await conGestion('monitor')).estado).toBe(200);
    const a = await aceptar(m, inv.codigo);
    expect(a.estado).toBe(410);
    expect(a.datos.error).toMatch(/can no longer grant this access/);
    // Y no sirve para un segundo intento.
    expect((await aceptar(m, inv.codigo)).estado).toBeGreaterThanOrEqual(400);
  });

  it('si la plantilla creció después de invitar, la invitación no da lo nuevo: queda inválida', async () => {
    const m = mundo();
    const total = await m.cuenta('admin', 'Soporte Total');
    const p = await m.llamar(
      'POST',
      '/datos/admin/equipo/plantillas',
      { nombre: { es: 'Mirador', en: 'Watcher' }, permisos: ['monitoreo.ver'] },
      total.token,
    );
    expect(p.estado, JSON.stringify(p.datos)).toBe(200);
    const pid = p.datos.id as string;
    const inv = await invitar(m, total.token, [pid]);
    expect(inv.r.estado).toBe(201);
    const congelado = await m.DB.prepare('SELECT acceso_json FROM invitaciones_equipo').first<{
      acceso_json: string;
    }>();
    expect(JSON.parse(congelado?.acceso_json ?? '{}').permisos).toEqual(['monitoreo.ver']);
    const e = await m.llamar(
      'PUT',
      `/datos/admin/equipo/plantillas/${pid}`,
      {
        nombre: { es: 'Mirador', en: 'Watcher' },
        permisos: ['monitoreo.ver', 'clientes.datos_personales'],
      },
      total.token,
    );
    expect(e.estado, JSON.stringify(e.datos)).toBe(200);
    const a = await aceptar(m, inv.codigo);
    expect(a.estado).toBe(410);
    expect(a.datos.error).toMatch(/The role changed after you were invited/);
  });
});

describe('C-PERMISOS-FINOS: un registro de acciones que falla queda a la vista', () => {
  it('si no se puede anotar la acción, queda en los errores del servidor (el canario los muestra)', async () => {
    const envolver = (db: D1Database): D1Database =>
      new Proxy(db, {
        get(t, k) {
          if (k === 'prepare')
            return (sql: string) => {
              if (sql.startsWith('INSERT INTO acciones_equipo'))
                return t.prepare('INSERT INTO tabla_que_no_existe (x) VALUES (?)');
              return t.prepare(sql);
            };
          const v = Reflect.get(t, k) as unknown;
          return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(t) : v;
        },
      });
    const m = mundo({}, { envolver });
    const total = await m.cuenta('admin', 'Soporte Total');
    const r = await m.llamar(
      'PUT',
      '/datos/admin/mis-avisos',
      { tipo: 'sistema', activo: true },
      total.token,
    );
    expect(r.estado).toBe(200);
    const e = await m.DB.prepare(
      "SELECT ruta FROM errores_servidor WHERE ruta LIKE 'equipo:acciones:%'",
    ).first<{ ruta: string }>();
    expect(e?.ruta).toBe('equipo:acciones:/datos/admin/mis-avisos');
  });
});

describe('C-PERMISOS-FINOS: los correos de los gerentes de franquicia se enmascaran', () => {
  it('sin datos personales ni gestión de franquicias, enmascarados; con gestión, completos', async () => {
    const m = mundo();
    const total = await m.cuenta('admin', 'Soporte Total');
    const r = await m.llamar(
      'POST',
      '/datos/admin/franquicias',
      { zonaId: 'US-FL-MIAMI', estado: 'activa', duenoCorreo: 'socio.franquicia@ejemplo.com' },
      total.token,
    );
    expect(r.estado).toBe(201);
    const id = r.datos.franquicia.id as string;
    const auditor = await empleado(m, total.token, ['auditor']);
    const visto = await m.llamar('GET', `/datos/admin/franquicias/${id}`, undefined, auditor.token);
    expect(visto.estado).toBe(200);
    expect(JSON.stringify(visto.datos)).not.toContain('socio.franquicia@ejemplo.com');
    const completo = await m.llamar(
      'GET',
      `/datos/admin/franquicias/${id}`,
      undefined,
      total.token,
    );
    expect(JSON.stringify(completo.datos)).toContain('socio.franquicia@ejemplo.com');
  });
});

describe('C-PERMISOS-FINOS: mover a un conductor de ciudad', () => {
  it('nadie lo manda a una ciudad fuera de su propia zona de trabajo', async () => {
    const m = mundo();
    const total = await m.cuenta('admin', 'Soporte Total');
    const { ids, zona } = await ciudadA(m, total.token);
    await m.DB.prepare(
      `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
       VALUES ('US-ZZ-FUERA', 'Ciudad de prueba', 'US', 'USD', 'America/Detroit', 42.48, -83.47, 20, 1)`,
    ).run();
    const aqui = await empleado(m, total.token, ['total'], { alcance: { zonas: [zona] } });
    const r = await m.llamar(
      'PUT',
      `/datos/admin/conductores/${ids.repartidor}/ciudad`,
      { zonaId: 'US-ZZ-FUERA', motivo: 'Cambio de ciudad de prueba' },
      aqui.token,
    );
    expect(r.estado).toBe(403);
    expect(r.datos.campo).toBe('zonaId');
  });
});
