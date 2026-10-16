// Pruebas S de la Fase 0 contra el SITIO DE PRUEBAS (nunca producción).
// Corre desde GitHub con el secreto del reloj que GitHub ya guarda: nadie lo ve ni lo comparte.
// Uso: URL_PRUEBAS=https://staging.tumbite.com RELOJ_SECRETO=… node scripts/staging/probar-staging.mjs
const base = process.env.URL_PRUEBAS;
const secreto = process.env.RELOJ_SECRETO;
if (!base || !secreto) {
  console.error('Faltan URL_PRUEBAS o RELOJ_SECRETO.');
  process.exit(1);
}
if (!/staging\.tumbite\.com|tumbite-pruebas/.test(base)) {
  console.error('Solo se corre contra el sitio de pruebas.');
  process.exit(1);
}
const pedir = async (ruta, cuerpo) => {
  const r = await fetch(`${base}/datos/interno/diagnostico/${ruta}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-reloj-secreto': secreto },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) return { prueba: ruta, ok: false, error: `${r.status} ${JSON.stringify(datos)}` };
  return datos;
};

const resultados = {};
resultados.S2 = await pedir('s2');
resultados.S3 = await pedir('s3');
resultados.S4 = await pedir('s4');
{
  const { tabla } = await pedir('s5/preparar');
  const t0 = Date.now();
  const r = await Promise.all(
    Array.from({ length: 50 }, (_, i) =>
      pedir('s5/aceptar', { tabla, conductor: `c${i}` }).catch((e) => ({ error: String(e) })),
    ),
  );
  const fin = await pedir('s5/cerrar', { tabla });
  const ganadores = r.filter((x) => x.gano).length;
  const errores = r.filter((x) => x.error).length;
  resultados.S5 = {
    prueba: 'S5',
    ok: ganadores === 1 && Boolean(fin.ganador),
    ganadores,
    errores,
    ms: Date.now() - t0,
    ganador: fin.ganador,
  };
}
resultados.S7 = await pedir('s7');
resultados.S11 = await pedir('s11');
// Entrega 1b: cobro al entregar contra Stripe en modo prueba.
resultados.L1 = await pedir('l1');
// Fases 1 y 2 (validación del 15 oct 2026).
resultados.F1 = await pedir('f1');
const antes = await pedir('migraciones', { paso: 'verificar' });
const m4 = await pedir('migraciones', { paso: 'm4' });
const m5 = await pedir('migraciones', { paso: 'm5' });
const despues = await pedir('migraciones', { paso: 'verificar' });
const sinComida = despues.resultados?.[2]?.[0]?.sin_comida;
const identidadSinEvidencia = despues.resultados?.at(-1)?.[0]?.identidad_sin_evidencia;
resultados.MIGRACIONES = {
  prueba: 'M4 y M5 en la base de pruebas',
  ok: sinComida === 0 && identidadSinEvidencia === 0,
  antes: antes.resultados,
  m4: m4.cambios,
  m5: m5.cambios,
  despues: despues.resultados,
};
resultados.MIGRACIONES_PRUEBA = await pedir('migraciones-prueba');
resultados.F2 = await pedir('f2');
// Fase 3 (16 oct 2026): concurrencia REAL — peticiones en paralelo al worker contra D1.
{
  const p = await pedir('f3/preparar', { conductores: 20 });
  if (!p.carrera) resultados.F3 = { prueba: 'F3', ok: false, error: JSON.stringify(p) };
  else {
    const t0 = Date.now();
    const r = await Promise.all(
      p.conductores.map((k, i) =>
        pedir('f3/aceptar', {
          operacion: p.carrera,
          conductor: k.id,
          vehiculo: k.vehiculo,
          clave: `c${i}`,
        }),
      ),
    );
    const ganadores = r.filter((x) => x.resultado === 'tomada').length;
    const k0 = p.conductores[0];
    // Reintentos duplicados: la misma clave cinco veces a la vez.
    const rep = await Promise.all(
      Array.from({ length: 5 }, () =>
        pedir('f3/aceptar', {
          operacion: p.carrera,
          conductor: k0.id,
          vehiculo: k0.vehiculo,
          clave: 'c0',
        }),
      ),
    );
    const ganoK0 = r[0]?.resultado === 'tomada';
    const d = await Promise.all([
      pedir('f3/aceptar', {
        operacion: p.dobleA,
        conductor: k0.id,
        vehiculo: k0.vehiculo,
        clave: 'a',
      }),
      pedir('f3/aceptar', {
        operacion: p.dobleB,
        conductor: k0.id,
        vehiculo: k0.vehiculo,
        clave: 'b',
      }),
      pedir('f3/comida', { pedido: p.pedido, conductor: k0.id }),
    ]);
    const exitos =
      d.filter((x) => x.resultado === 'tomada').length + (d[2]?.tomado ? 1 : 0) + (ganoK0 ? 1 : 0);
    const fin = await pedir('f3/cerrar', { sufijo: p.sufijo });
    resultados.F3 = {
      prueba: 'F3',
      ok:
        ganadores === 1 &&
        exitos === 1 &&
        (!ganoK0 || rep.every((x) => x.resultado === 'ya_es_tuya')) &&
        Boolean(fin.ok),
      ganadores,
      exitosDelMismoConductor: exitos,
      reintentos: rep.map((x) => x.resultado),
      ms: Date.now() - t0,
      casos: fin.casos,
    };
  }
}

// Reloj seguro (16 oct 2026): tareas aisladas, vueltas cruzadas, reintentos y el Manager real con
// Stripe en modo prueba, contra la base D1 real.
resultados.RELOJ = await pedir('reloj');

let todo = true;
for (const [k, v] of Object.entries(resultados)) {
  const estado = v.omitido ? 'OMITIDA' : v.ok ? 'OK' : 'FALLA';
  if (!v.ok && !v.omitido) todo = false;
  console.log(`${k}: ${estado} ${JSON.stringify(v)}`);
}
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## Pruebas S en el sitio de pruebas\n\n\`\`\`json\n${JSON.stringify(resultados, null, 2)}\n\`\`\`\n`,
  );
}
process.exit(todo ? 0 : 1);
