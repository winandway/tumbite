// Verificación de SOLO LECTURA de producción, antes y después de publicar (docs/PUBLICACION-ANTICIPADA-FASE-3.md).
// Revisa cada pieza de la salud por separado y acepta UN solo error conocido: la conciliación del
// 15 oct 2026 (compra de prueba de 7,18 USD). Cualquier otro error = ROJO = condición de reversión.
// Uso: YADOMINIOS_LLAVE=… node scripts/produccion/verificar-publicacion.mjs <antes|despues|despues-reloj> <version>
// «despues-reloj» = «despues» + el reloj seguro: pieza «reloj» en ok o atrasado (NUNCA error) y la
// última vuelta del reloj sin tareas críticas fallidas.
const [modoPedido = 'antes', version = ''] = process.argv.slice(2);
const conReloj = modoPedido === 'despues-reloj';
const modo = conReloj ? 'despues' : modoPedido;
if (!['antes', 'despues'].includes(modo)) {
  console.error(`Modo desconocido: ${modoPedido}`);
  process.exit(2);
}
const SITIO = process.env.VERIFICAR_SITIO ?? 'https://tumbite.com';
const LLAVE = process.env.YADOMINIOS_LLAVE;
if (!LLAVE) {
  console.error('Falta YADOMINIOS_LLAVE (solo lectura de la base de producción).');
  process.exit(2);
}
const fallas = [];
const avisos = [];
const exigir = (ok, texto) => (ok ? avisos.push(`ok · ${texto}`) : fallas.push(texto));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function consultar(sql) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch('https://yapanel.yadominios.com/api/sitio/v1/consultar_base', {
        method: 'POST',
        headers: { authorization: `Bearer ${LLAVE}`, 'content-type': 'application/json' },
        body: JSON.stringify({ sql }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.mensaje ?? 'consulta fallida');
      if (d.resultado.rowsWritten !== 0) throw new Error('la consulta escribió: se detiene');
      return d.resultado.results;
    } catch (e) {
      if (i === 4) throw e;
      await espera(1500);
    }
  }
  return [];
}

// La excepción única, autorizada por Richard: exactamente estos valores, ni uno más.
const CONOCIDA = {
  dia: '2026-10-15',
  pedidos: 1,
  vendido: 718,
  restaurantes: 87,
  repartidores: 520,
};
const PEDIDO_CONOCIDO = '95fce528-11b2-427e-946a-b4f8a7fd0033';

// 1. Versión servida.
const html = await (await fetch(`${SITIO}/?v=${Date.now()}`)).text();
const servida = /name="version" content="([^"]+)"/.exec(html)?.[1] ?? '';
if (version) exigir(servida === version, `producción sirve ${version} (sirve ${servida})`);
else avisos.push(`info · producción sirve ${servida}`);

// 2. Salud, pieza por pieza.
const salud = await (await fetch(`${SITIO}/datos/salud`)).json();
const p = salud.piezas ?? {};
const deben = [
  'base',
  'almacen',
  'entorno',
  'esquema',
  'variables',
  'stripe',
  'webhookStripe',
  'correo',
  'avisosCelular',
  'servicios',
  'respaldo',
];
if (modo === 'despues') deben.push('exclusividad');
const pieza = new Map(Object.entries(p));
for (const k of deben) exigir(pieza.get(k) === 'ok', `salud · ${k} = ok (está «${pieza.get(k)}»)`);
for (const k of ['sms', 'retiros', 'tiempoReal'])
  exigir(
    pieza.get(k) === 'pendiente',
    `salud · ${k} = pendiente, apagado a propósito (está «${pieza.get(k)}»)`,
  );
// C-ERRORES-VISIBLES: después de publicar la pieza existe; «pendiente» = hubo errores no
// controlados en la última hora (no tumba la publicación, pero se dice para revisarlos).
if (modo === 'despues')
  exigir(
    ['ok', 'pendiente'].includes(pieza.get('errores')),
    `salud · errores = ok o pendiente (está «${pieza.get('errores')}»)`,
  );
if (pieza.get('errores') === 'pendiente')
  avisos.push(
    'aviso · hubo errores no controlados en la última hora: revisar /datos/admin/errores',
  );
// La pieza «reloj» (reloj seguro): ok, o «atrasado» solo con el programador de GitHub. Error nunca.
if (conReloj)
  exigir(
    ['ok', 'atrasado'].includes(pieza.get('reloj')),
    `salud · reloj = ok o atrasado (está «${pieza.get('reloj')}»)`,
  );
else if (pieza.has('reloj'))
  exigir(
    pieza.get('reloj') !== 'error',
    `salud · reloj no está en error (está «${pieza.get('reloj')}»)`,
  );
const otrasEnError = Object.entries(p).filter(([k, v]) => v === 'error' && k !== 'dinero');
exigir(
  otrasEnError.length === 0,
  `ninguna pieza en error salvo «dinero» (${JSON.stringify(otrasEnError)})`,
);

// 3. Si «dinero» está en error, tiene que ser EXACTAMENTE la excepción conocida.
const conc = await consultar(
  'SELECT dia, pedidos, vendido, cuadra, detalle FROM conciliaciones ORDER BY dia DESC',
);
const sinCuadrar = conc.filter((c) => Number(c.cuadra) === 0);
const ultima = conc[0];
if (p.dinero === 'error') {
  const d = JSON.parse(ultima?.detalle ?? '{}');
  exigir(
    ultima?.dia === CONOCIDA.dia &&
      Number(ultima.pedidos) === CONOCIDA.pedidos &&
      Number(ultima.vendido) === CONOCIDA.vendido &&
      d.restaurantesEsperado === CONOCIDA.restaurantes &&
      d.repartidoresEsperado === CONOCIDA.repartidores,
    `«dinero» en error SOLO por la conciliación conocida del 15 oct (última: ${JSON.stringify({ dia: ultima?.dia, pedidos: ultima?.pedidos, vendido: ultima?.vendido })})`,
  );
} else exigir(p.dinero === 'ok', `salud · dinero = ok (está «${p.dinero}»)`);
exigir(
  sinCuadrar.length === 1 && sinCuadrar[0].dia === CONOCIDA.dia,
  `una sola conciliación sin cuadrar en todo el historial, la del 15 oct (hay: ${sinCuadrar.map((c) => c.dia).join(', ')})`,
);
const del15 = await consultar(
  `SELECT id FROM pedidos WHERE estado = 'entregado' AND date(entregado_en) = '${CONOCIDA.dia}'`,
);
exigir(
  del15.length === 1 && del15[0].id === PEDIDO_CONOCIDO,
  'el 15 oct solo tiene el pedido de prueba conocido',
);

// 4. Nada de dinero nuevo desde la última conciliación (la parte del día que todavía no se cerró).
const [m] = await consultar(
  `SELECT (SELECT COUNT(*) FROM movimientos WHERE date(creado_en) > '${ultima?.dia}') movs,
          (SELECT COUNT(*) FROM pedidos WHERE estado = 'entregado' AND date(entregado_en) > '${ultima?.dia}') entregados,
          (SELECT COUNT(*) FROM cobros WHERE capturado_en IS NULL AND cancelado_en IS NULL) cobros_abiertos,
          (SELECT COUNT(*) FROM pedidos WHERE estado IN ('pagado','aceptado','listo','en_camino')) activos,
          (SELECT COUNT(*) FROM retiros) retiros,
          (SELECT COUNT(*) FROM config WHERE clave = 'retiros_activos') bandera_retiros,
          (SELECT COUNT(*) FROM abonos_fallidos) abonos_fallidos,
          (SELECT COUNT(*) FROM repartidores WHERE conectado = 1) conectados,
          (SELECT group_concat(servicio_id) FROM servicios_implementados) implementados,
          (SELECT COUNT(*) FROM servicios_zona WHERE servicio_id IN ('moto','carro') AND estado = 'disponible') moto_carro`,
);
exigir(
  Number(m.movs) === 0 && Number(m.entregados) === 0,
  `sin movimientos ni entregas nuevas desde el ${ultima?.dia} (${m.movs} / ${m.entregados})`,
);
exigir(Number(m.cobros_abiertos) === 0, `sin cobros abiertos (${m.cobros_abiertos})`);
exigir(
  modo === 'despues' || Number(m.activos) === 0,
  `sin pedidos activos antes de publicar (${m.activos})`,
);
exigir(
  Number(m.retiros) === 0 && Number(m.bandera_retiros) === 0,
  'retiros reales apagados y sin retiros',
);
exigir(Number(m.abonos_fallidos) === 0, 'sin abonos fallidos');
exigir(
  m.implementados === 'comida' && Number(m.moto_carro) === 0,
  `solo Comida; Moto y Carro apagados (${m.implementados}, ${m.moto_carro})`,
);
avisos.push(`info · repartidores conectados: ${m.conectados}`);

// 5. Después de publicar: la Fase 3 puesta y sana.
if (modo === 'despues') {
  try {
    const [f] = await consultar(
      `SELECT (SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name IN ('pedidos_ocupa_conductor','pedidos_libera_por_estado','pedidos_libera_al_soltar','pedidos_reactiva_ocupa','pedidos_reasigna_ocupa','pedidos_ocupa_al_crear','pedidos_libera_al_borrar','operaciones_ocupa_conductor','operaciones_al_asignar','operaciones_libera_conductor','operaciones_libera_al_terminar','operaciones_estado_coherente','operaciones_conductor_coherente','viajes_transicion_valida','viajes_actor_solo_con_transicion','viajes_al_cambiar_estado','repartidores_vehiculo_fijo_en_operacion')) disparadores,
            (SELECT COUNT(*) FROM inconsistencias_operaciones) inconsistencias,
            (SELECT COUNT(*) FROM operaciones) operaciones`,
    );
    exigir(Number(f.disparadores) === 17, `los 17 disparadores de la Fase 3 (${f.disparadores})`);
    exigir(
      Number(f.inconsistencias) === 0,
      `inconsistencias de exclusividad en cero (${f.inconsistencias})`,
    );
    exigir(
      Number(f.operaciones) === 0,
      `ninguna operación de Moto o Carro creada (${f.operaciones})`,
    );
  } catch (e) {
    fallas.push(`no se pudo leer la Fase 3 en la base: ${String(e?.message ?? e).slice(0, 160)}`);
  }
}

// 5b. Con el reloj seguro: la última vuelta registrada no tiene tareas críticas fallidas.
if (conReloj) {
  try {
    const [r] = await consultar(
      `SELECT (SELECT COUNT(*) FROM reloj_tareas) filas,
              (SELECT COUNT(*) FROM reloj_tareas WHERE critica = 1 AND ok = 0
                 AND clave = (SELECT clave FROM tareas_programadas WHERE tarea = 'reloj' AND terminada_en IS NOT NULL ORDER BY terminada_en DESC LIMIT 1)) criticas_ultima,
              (SELECT group_concat(tarea) FROM reloj_tareas WHERE ok = 0 AND creado_en > datetime('now', '-1 day')) fallidas_dia`,
    );
    exigir(
      Number(r.criticas_ultima) === 0,
      `última vuelta del reloj sin tareas críticas fallidas (${r.criticas_ultima})`,
    );
    avisos.push(
      `info · reloj: ${r.filas} resultados de tareas guardados; fallidas en 24 h: ${r.fallidas_dia ?? 'ninguna'}`,
    );
  } catch (e) {
    fallas.push(
      `no se pudo leer el reloj seguro en la base: ${String(e?.message ?? e).slice(0, 160)}`,
    );
  }
}

// 6. Rutas críticas (las del semáforo): 200; la salud solo puede dar 503 por la excepción conocida.
for (const r of [
  '/',
  '/es',
  '/es/how-it-works',
  '/how-it-works',
  '/llms.txt',
  '/panel',
  '/app/',
  '/driver/',
  '/privacy',
  '/terms',
  '/restaurant-terms',
  '/driver-terms',
  '/delete-account',
  '/support',
  '/sitemap.xml',
]) {
  const code = (await fetch(`${SITIO}${r}`)).status;
  exigir(code === 200, `ruta ${r} → 200 (dio ${code})`);
}

for (const a of avisos) console.log(a);
if (fallas.length) {
  console.log(`\nROJO (${fallas.length}): esto NO es la excepción conocida.`);
  for (const f of fallas) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log(
  `\nVERDE: el único error es la conciliación conocida del 15 oct${p.dinero === 'ok' ? ' (y ya no está: dinero = ok)' : ''}.`,
);
