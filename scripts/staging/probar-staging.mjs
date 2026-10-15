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
