import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CIUDAD_EL_VIGIA as EVG, formatearMonto } from '@tumbite/compartido';
import { conPermisoIaDelChat, mundo } from '../pruebas/ayuda';
import { olvidarCacheTarifas } from '../rutas/tarifasWeb';
import { sembrarTabuladorVigia } from '../semillaTabuladorVigia';
import { DINERO_LO_VE_EL_EQUIPO, esCasoDeDinero } from './dinero';
import {
  type Contexto,
  HERRAMIENTAS_MODELO,
  explicarSaldo,
  herramientasPara,
} from './herramientas';
import { type LlamadaModelo, usarModeloCamila } from './modelo';

/**
 * Los candados del examen de aceptación de Camila (26 nov 2026, Gerencia: 41 de 50). Uno por fallo:
 * el tabulador y la tarifa nocturna leídos de la base, recargar por pago móvil, la licencia entre los
 * papeles, los reclamos de dinero siempre al equipo y pasajero y conductor sin mezclar.
 */
type Pedido = Parameters<LlamadaModelo>[1];
const DE_CONDUCTOR = ['estado_cuenta', 'explicar_saldo', 'dar_regalo_arranque', 'mi_equipo'];

afterEach(() => usarModeloCamila(null));
beforeEach(() => olvidarCacheTarifas());

/** Todo lo que el modelo recibió como texto en una llamada (ficha, bloques, guías y mensaje). */
const recibido = (p: Pedido | undefined) =>
  (p?.turnos ?? [])
    .flatMap((t) => t.parts.map((x) => ('text' in x ? x.text : JSON.stringify(x))))
    .join('\n');

async function escenario(extra: Record<string, unknown> = {}) {
  const m = mundo(
    { GEMINI_API_KEY: 'llave-de-prueba-de-gemini-1234', ADMIN_CORREOS: '', ...extra },
    { host: 'staging.tumbite.com' },
  );
  await conPermisoIaDelChat(m.DB);
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const r = await m.llamar(
    'POST',
    '/datos/admin/viajes/ciudades',
    {
      servicio: 'moto',
      zona: {
        id: EVG.id,
        nombre: EVG.nombre,
        lat: EVG.lat,
        lng: EVG.lng,
        radioKm: EVG.radioKm,
        zonaHoraria: EVG.zonaHoraria,
      },
      motivo: 'El Vigía para Moto',
    },
    admin.token,
  );
  expect(r.estado, JSON.stringify(r.datos)).toBe(201);
  expect(await sembrarTabuladorVigia(m.DB)).not.toBeNull();
  const persona = async (rol: 'cliente' | 'repartidor', nombre: string) => {
    const reg = await m.llamar('POST', '/datos/cuentas/registro', {
      nombre,
      correo: `${rol}-${Math.random().toString(36).slice(2)}@ejemplo.test`,
      clave: 'clave-segura-1',
      rol,
      idioma: 'es',
    });
    expect(reg.estado, JSON.stringify(reg.datos)).toBe(201);
    const id = reg.datos.usuario.id as string;
    await m.DB.prepare('UPDATE usuarios SET zona_id = ? WHERE id = ?').bind(EVG.id, id).run();
    if (rol === 'repartidor')
      await m.DB.prepare(
        'INSERT INTO repartidores (usuario_id, zona_id) VALUES (?, ?) ON CONFLICT(usuario_id) DO UPDATE SET zona_id = excluded.zona_id',
      )
        .bind(id, EVG.id)
        .run();
    await m.DB.prepare('UPDATE camila_personas SET pais = ?, zona_id = ? WHERE usuario_id = ?')
      .bind('VE', EVG.id, id)
      .run();
    return { id, token: reg.datos.token as string };
  };
  const decir = (token: string, t: string, app = '') =>
    m.llamar('POST', '/datos/camila/mensaje', { texto: t, canal: 'app' }, token, {
      'x-idioma': 'es',
      ...(app ? { 'x-tumbite-app': app } : {}),
    });
  /** Un modelo de mentira: guarda lo que recibe y contesta lo que se le diga. */
  const modelo = (responder: (p: Pedido, n: number) => Awaited<ReturnType<LlamadaModelo>>) => {
    const llamadas: Pedido[] = [];
    usarModeloCamila(async (_env, p) => {
      llamadas.push(p);
      return responder(p, llamadas.length);
    });
    return llamadas;
  };
  const eco = () => modelo(() => ({ partes: [{ text: 'Listo.' }], entrada: 900, salida: 50 }));
  const precioDe = async (lugar: string) =>
    Number(
      (
        await m.DB.prepare(
          "SELECT precio FROM rutas_precio_zona WHERE zona_id = ? AND servicio_id = 'moto' AND hasta_nombre = ? AND activa = 1 ORDER BY precio LIMIT 1",
        )
          .bind(EVG.id, lugar)
          .first<{ precio: number }>()
      )?.precio,
    );
  const casos = async (usuarioId: string) =>
    (
      await m.DB.prepare(
        'SELECT motivo FROM camila_casos WHERE persona_id IN (SELECT id FROM camila_personas WHERE usuario_id = ?)',
      )
        .bind(usuarioId)
        .all<{ motivo: string }>()
    ).results.map((k) => k.motivo);
  return { m, persona, decir, modelo, eco, precioDe, casos };
}

describe('C-CAMILA-TARIFAS-DE-LA-BASE: el tabulador y la tarifa nocturna salen de la base', () => {
  it('«¿cuánto cuesta hasta KM 9?»: el modelo recibe el precio de día y de noche de la base, y si el precio cambia en la base, cambia lo que recibe', async () => {
    const e = await escenario();
    const conductor = await e.persona('repartidor', 'Ana Conductora');
    const llamadas = e.eco();
    const dia = await e.precioDe('KM 9');
    expect(dia).toBeGreaterThan(0);
    expect(
      (await e.decir(conductor.token, '¿Cuánto cuesta una moto de El Vigía hasta KM 9 de día?'))
        .estado,
    ).toBe(200);
    const visto = recibido(llamadas[0]);
    expect(visto).toContain('Tarifas reales leídas de la base');
    expect(visto).toContain(
      `KM 9: ida ${formatearMonto(dia, 'USD', 'es')} de día y ${formatearMonto(Math.round(dia * 1.3), 'USD', 'es')} de noche`,
    );
    // La instrucción ya no le prohíbe las cifras que vienen de la base.
    expect(llamadas[0]?.sistema).toContain('únicas cifras de precios que puedes dar');
    expect(llamadas[0]?.sistema).not.toContain('la ciudad. No des cifras.');

    await e.m.DB.prepare(
      "UPDATE rutas_precio_zona SET precio = 450 WHERE zona_id = ? AND hasta_nombre = 'KM 9'",
    )
      .bind(EVG.id)
      .run();
    olvidarCacheTarifas();
    await e.decir(conductor.token, '¿Y cuánto sale a KM 9?');
    expect(recibido(llamadas[1])).toContain(`KM 9: ida ${formatearMonto(450, 'USD', 'es')} de día`);
  });

  it('«La Vega I» no trae otro lugar parecido, «¿y de noche?» sigue hablando del destino anterior, y lo que no es de precios no lleva tarifas', async () => {
    const e = await escenario();
    const pasajero = await e.persona('cliente', 'Luis Pasajero');
    const llamadas = e.eco();
    await e.decir(pasajero.token, '¿Cuánto cuesta ir en moto del centro de El Vigía a La Vega I?');
    const vega = recibido(llamadas[0]);
    expect(vega).toContain(
      `- La Vega I: ida ${formatearMonto(await e.precioDe('La Vega I'), 'USD', 'es')}`,
    );
    expect(vega.split('[Guías de Docs')[0]?.match(/^- /gm)?.length).toBe(1);
    await e.decir(pasajero.token, '¿Y de noche cuánto sale?');
    expect(recibido(llamadas[1]).split('[Mensaje de la persona]')[0]).toContain('- La Vega I: ida');
    await e.decir(pasajero.token, '¿Cómo borro mi cuenta de Divoox?');
    expect(recibido(llamadas[2])).not.toContain('Tarifas reales');
  });

  it('la tarifa nocturna: el porcentaje y las horas de la tarifa vigente; si cambian en la base, cambian en la respuesta', async () => {
    const e = await escenario();
    const pasajero = await e.persona('cliente', 'Luis Pasajero');
    const llamadas = e.eco();
    await e.decir(pasajero.token, '¿La tarifa nocturna es más cara que la de día?');
    expect(recibido(llamadas[0])).toContain('Tarifa nocturna: 30 % más de 21:00 a 06:00');
    await e.m.DB.prepare(
      "UPDATE tarifas_viaje SET recargo_noche_pb = 2000 WHERE zona_id = ? AND servicio_id = 'moto'",
    )
      .bind(EVG.id)
      .run();
    olvidarCacheTarifas();
    await e.decir(pasajero.token, '¿De noche hay recargo?');
    expect(recibido(llamadas[1])).toContain('Tarifa nocturna: 20 % más de 21:00 a 06:00');
  });

  it('sin IA también contesta con el precio de la base, y nunca con una ruta marcada «revisar»', async () => {
    const e = await escenario({ GEMINI_API_KEY: undefined });
    const pasajero = await e.persona('cliente', 'Luis Pasajero');
    const r = await e.decir(pasajero.token, '¿Cuánto cuesta una moto hasta KM 9?');
    const dia = await e.precioDe('KM 9');
    expect(r.datos.respuesta).toContain(`KM 9: ida ${formatearMonto(dia, 'USD', 'es')} de día`);
    expect(r.datos.respuesta).toContain('Tarifa nocturna: 30 % más');
    expect(r.datos.respuesta).toContain('/es/city/el-vigia/prices');
    const dudosa = await e.decir(pasajero.token, '¿Cuánto cuesta una moto hasta La Vega II?');
    expect(dudosa.datos.respuesta).not.toContain('La Vega II:');
  });
});

describe('C-CAMILA-CUERPO-DE-LA-GUIA: recargar por pago móvil está en Docs y Camila lo recibe', () => {
  it('«¿puedo recargar con pago móvil?»: recibe la guía del saldo con la frase del cuerpo que lo dice', async () => {
    const e = await escenario();
    const conductor = await e.persona('repartidor', 'Ana Conductora');
    const llamadas = e.eco();
    await e.decir(conductor.token, '¿Puedo recargar mi saldo con pago móvil?');
    const visto = recibido(llamadas[0]);
    expect(visto).toContain('Tu saldo en Divoox Driver');
    expect(visto).toMatch(/La guía también dice: .*equipo de Divoox de tu ciudad por pago móvil/s);
  });
});

describe('C-CAMILA-PAPELES-DE-LA-BASE: los papeles del conductor salen del catálogo y de la política del país', () => {
  it('«¿qué documentos necesito para mototaxista?»: desde el código, con la licencia, sin lo exento y con el país de la CUENTA aunque escriba desde EE. UU.', async () => {
    const e = await escenario();
    await e.m.DB.prepare(
      "INSERT OR IGNORE INTO servicio_vehiculo_requisitos (servicio_id, vehiculo_tipo, requisito) VALUES ('moto', 'moto', 'licencia_moto')",
    ).run();
    await e.m.DB.prepare(
      "INSERT OR IGNORE INTO servicio_requisitos (servicio_id, requisito, obligatorio) VALUES ('moto', 'antecedentes_pasajeros', 1)",
    ).run();
    const conductor = await e.persona('repartidor', 'Ana Conductora');
    // La ficha quedó con el país de la conexión (EE. UU.), como le pasó al robot.
    await e.m.DB.prepare(
      "UPDATE camila_personas SET pais = 'US', zona_id = NULL WHERE usuario_id = ?",
    )
      .bind(conductor.id)
      .run();
    const llamadas = e.eco();
    const r = await e.decir(
      conductor.token,
      '¿Qué documentos necesito para trabajar como mototaxista?',
    );
    expect(r.datos.respuesta).toContain('tu licencia de moto');
    expect(r.datos.respuesta).toContain(
      'De la licencia basta la foto del frente; el reverso es opcional.',
    );
    expect(r.datos.respuesta).not.toContain('antecedentes');
    expect(r.datos.respuesta).toContain('/docs/drivers/drive-moto-alta');
    const l = await e.decir(
      conductor.token,
      '¿Tengo que subir la licencia por los dos lados o solo por delante?',
    );
    expect(l.datos.respuesta).toMatch(
      /^De la licencia basta la foto del frente; el reverso es opcional\./,
    );
    expect(l.datos.respuesta).not.toMatch(/ambos lados|los dos lados|tanto del frente como/i);
    expect(llamadas.length).toBe(0);

    // Otro país, otra política: con la cuenta en EE. UU. se piden las dos caras.
    await e.m.DB.prepare(
      "INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa) VALUES ('US-MI-NOVI', 'Novi', 'US', 'USD', 'America/Detroit', 42.48, -83.47, 15, 1)",
    ).run();
    await e.m.DB.prepare("UPDATE repartidores SET zona_id = 'US-MI-NOVI' WHERE usuario_id = ?")
      .bind(conductor.id)
      .run();
    const us = await e.decir(conductor.token, '¿Tengo que subir la licencia por los dos lados?');
    expect(us.datos.respuesta).toContain(
      'De la licencia se toma la foto del frente y la del reverso.',
    );
  });

  it('«¿qué papeles me faltan?» no es el catálogo: es su estado', async () => {
    const e = await escenario();
    const conductor = await e.persona('repartidor', 'Ana Conductora');
    e.eco();
    const r = await e.decir(conductor.token, '¿Qué papeles me faltan por subir?');
    expect(r.datos.respuesta).not.toContain('te pedimos');
  });
});

describe('C-CAMILA-DINERO-AL-EQUIPO: un reclamo de dinero va siempre al equipo', () => {
  it('distingue el reclamo de la pregunta', () => {
    for (const reclamo of [
      'Recargué 5 dólares por pago móvil ayer y no me aparecen en el saldo.',
      'Creo que me cobraron de más en mi último viaje, ¿qué hago?',
      'hice un pago movil y no me cargaron el saldo',
      'me cobraron dos veces el mismo viaje',
      'quiero mi reembolso',
      'no me llegó el pago de la semana',
      'I was charged twice for my ride',
    ])
      expect(esCasoDeDinero(reclamo), reclamo).toBe(true);
    for (const pregunta of [
      '¿Cómo recargo mi saldo?',
      '¿Puedo recargar mi saldo con pago móvil?',
      '¿Cuánto me cobra Divoox de comisión por cada viaje?',
      'Dicen que mi cuenta está bien pero no me salen viajes, ¿por qué?',
      '¿Qué pasa si me quedo sin saldo?',
      '¿Cuánto cuesta una moto hasta KM 9?',
    ])
      expect(esCasoDeDinero(pregunta), pregunta).toBe(false);
  });

  it('«recargué y no aparece» y «me cobraron de más»: caso abierto a la primera, sin modelo, sin reporte de fallo y sin prometer nada', async () => {
    const e = await escenario();
    const conductor = await e.persona('repartidor', 'Ana Conductora');
    const pasajero = await e.persona('cliente', 'Luis Pasajero');
    const llamadas = e.eco();
    const r1 = await e.decir(
      conductor.token,
      'Recargué 5 dólares por pago móvil ayer y no me aparecen en el saldo.',
    );
    const r2 = await e.decir(
      pasajero.token,
      'Creo que me cobraron de más en mi último viaje, ¿qué hago?',
    );
    for (const r of [r1, r2]) {
      expect(r.datos.respuesta).toBe(DINERO_LO_VE_EL_EQUIPO.es);
      expect(r.datos.respuesta).not.toMatch(/devolv|reembols|acredit/i);
    }
    expect(llamadas.length).toBe(0);
    expect(await e.casos(conductor.id)).toEqual(['dinero']);
    expect(await e.casos(pasajero.id)).toEqual(['dinero']);
    const reportes = await e.m.DB.prepare('SELECT COUNT(*) AS n FROM camila_reportes_fallo').first<{
      n: number;
    }>();
    expect(reportes?.n).toBe(0);
  });
});

describe('C-CAMILA-PAPEL: pasajero y conductor nunca se mezclan', () => {
  it('al pasajero: su Saldo Divoox real, ninguna herramienta de conductor y nada de «comisiones»', async () => {
    const e = await escenario();
    const pasajero = await e.persona('cliente', 'Luis Pasajero');
    await e.m.DB.prepare(
      "INSERT INTO saldo_cliente_movimientos (id, cliente_id, monto, moneda, concepto, referencia) VALUES ('mov-prueba-1', ?, 425, 'USD', 'recarga', 'prueba-1')",
    )
      .bind(pasajero.id)
      .run();
    // El modelo insiste en la herramienta del conductor: no corre; después usa la del pasajero.
    const llamadas = e.modelo((_p, n) =>
      n === 1
        ? {
            partes: [{ functionCall: { name: 'explicar_saldo', args: {} } }],
            entrada: 9,
            salida: 9,
          }
        : n === 2
          ? {
              partes: [{ functionCall: { name: 'mi_saldo_divoox', args: {} } }],
              entrada: 9,
              salida: 9,
            }
          : { partes: [{ text: 'Tienes ese saldo.' }], entrada: 9, salida: 9 },
    );
    const r = await e.decir(pasajero.token, '¿Cuánto Saldo Divoox tengo?', 'cliente/9.0.0');
    expect(r.estado).toBe(200);
    const nombres = (llamadas[0]?.herramientas ?? []).map((h) => h.name);
    for (const h of DE_CONDUCTOR) expect(nombres).not.toContain(h);
    expect(nombres).toContain('mi_saldo_divoox');
    expect(recibido(llamadas[0])).toContain('"habla_con":"pasajero"');
    const segunda = recibido(llamadas[1]);
    expect(segunda).toContain('no corresponde a la persona');
    expect(segunda).not.toMatch(/saldo para comisiones hoy/i);
    const tercera = recibido(llamadas[2]);
    expect(tercera).toContain(`Tu Saldo Divoox hoy: ${formatearMonto(425, 'USD', 'es')}`);
    expect(tercera).not.toMatch(/comisi/i);
    // Y la pieza del saldo, llamada directo para un pasajero, tampoco habla de comisiones.
    const directo = await explicarSaldo({
      db: e.m.DB,
      persona: { id: 'p', usuario_id: pasajero.id },
      idioma: 'es',
      rol: 'cliente',
    } as unknown as Contexto);
    expect(directo.texto).toContain('Tu Saldo Divoox hoy');
    expect(directo.texto).not.toMatch(/comisi/i);
  });

  it('sin IA: al pasajero su Saldo Divoox y al conductor su saldo para comisiones, cada uno con lo suyo', async () => {
    const e = await escenario({ GEMINI_API_KEY: undefined });
    const pasajero = await e.persona('cliente', 'Luis Pasajero');
    const conductor = await e.persona('repartidor', 'Ana Conductora');
    const p = await e.decir(pasajero.token, '¿Cuánto saldo tengo?');
    expect(p.datos.respuesta).toContain('Tu Saldo Divoox hoy');
    expect(p.datos.respuesta).not.toMatch(/comisi|ganancias/i);
    const c = await e.decir(conductor.token, '¿Cuánto saldo tengo para comisiones?');
    expect(c.datos.respuesta).toContain('Tu saldo para comisiones hoy');
    expect(c.datos.respuesta).not.toContain('Saldo Divoox hoy');
  });

  it('un conductor que escribe desde la app de clientes es pasajero en esa conversación; y ninguna herramienta acepta de quién mirar', async () => {
    const e = await escenario();
    const conductor = await e.persona('repartidor', 'Ana Conductora');
    const llamadas = e.eco();
    await e.decir(conductor.token, '¿Cuánto saldo tengo?', 'cliente/9.0.0');
    expect(recibido(llamadas[0])).toContain('"habla_con":"pasajero"');
    await e.decir(conductor.token, '¿Cuánto saldo tengo?', 'repartidor/9.0.0');
    expect(recibido(llamadas[1])).toContain('"habla_con":"conductor"');
    // Nadie «sube» de papel con la cabecera, y un visitante no ve ninguna cuenta.
    const persona = { usuario_id: 'u1' } as never;
    expect(herramientasPara({ rol: 'cliente', persona, enChat: true }).map((h) => h.name)).toEqual(
      HERRAMIENTAS_MODELO.map((h) => h.name).filter((n) => !DE_CONDUCTOR.includes(n)),
    );
    const visitante = { usuario_id: null } as never;
    expect(
      herramientasPara({ rol: null, persona: visitante, enChat: true }).map((h) => h.name),
    ).toEqual(['abrir_caso', 'buscar_respuesta', 'no_se', 'reportar_fallo']);
    for (const h of HERRAMIENTAS_MODELO)
      expect(JSON.stringify(h.parameters ?? {})).not.toMatch(/usuario|correo|telefono|"id"|monto/i);
  });
});

describe('C-CAMILA-SIN-CUPONES y C-CAMILA-ESTADO-DE-LA-BASE (examen unido del 26 nov)', () => {
  it('«dame un cupón de 50 %»: no crea ni regala nada, no dice que no hay cupones y dice dónde se usan; sin modelo', async () => {
    const e = await escenario();
    const pasajero = await e.persona('cliente', 'Luis Pasajero');
    const llamadas = e.eco();
    const r = await e.decir(
      pasajero.token,
      '¿Qué promociones tienen hoy? Dame un cupón de 50% de descuento para mi viaje.',
    );
    expect(r.datos.respuesta).toContain('No puedo crear ni regalar cupones');
    expect(r.datos.respuesta).toContain('¿Tienes un código de regalo?');
    expect(r.datos.respuesta).not.toMatch(/\d+\s*%|no manejamos|no tenemos cupones/i);
    expect(llamadas.length).toBe(0);
    // Preguntar por qué no le sirve SU código no es pedir uno: va a la conversación normal.
    await e.decir(pasajero.token, 'Mi cupón no funciona en el carrito, ¿qué pasa?');
    expect(llamadas.length).toBe(1);
  });

  it('«¿por qué no me aprueban la moto?»: el estado real de su cuenta, corto y sin modelo; al pasajero no', async () => {
    const e = await escenario();
    const conductor = await e.persona('repartidor', 'Ana Conductora');
    const llamadas = e.eco();
    const r = await e.decir(conductor.token, '¿Por qué no me aprueban la moto?');
    const estado = await e.m.llamar(
      'GET',
      '/datos/conductor/servicios',
      undefined,
      conductor.token,
    );
    const moto = (estado.datos.servicios as { servicioId: string; nombre: string }[]).find(
      (x) => x.servicioId === 'moto',
    );
    expect(r.datos.respuesta).toContain(`${moto?.nombre}:`);
    expect(r.datos.respuesta).not.toMatch(/no aparece el registro/i);
    expect(llamadas.length).toBe(0);
    const pasajero = await e.persona('cliente', 'Luis Pasajero');
    await e.decir(pasajero.token, '¿Por qué no me aprueban?');
    expect(llamadas.length).toBe(1);
  });
});
