#!/usr/bin/env node
/**
 * C-AUDITORIA-EXCEPCIONES (17 nov 2026): la compuerta de seguridad de dependencias. Corre el mismo
 * `npm audit` de siempre y falla con cualquier aviso alto o crítico, SALVO los anotados uno por uno
 * en `auditoria-excepciones.json` (aviso exacto, motivo y fecha de revisión). Una excepción vencida
 * vuelve a fallar: obliga a mirarla otra vez. Nunca se apaga la auditoría entera.
 */
import { execFileSync } from 'node:child_process';
import excepciones from './auditoria-excepciones.json' with { type: 'json' };

const espacios = [
  '@tumbite/servidor',
  '@tumbite/panel',
  '@tumbite/compartido',
  '@tumbite/tiempo-real',
];
const args = ['audit', '--json', '--omit=dev', ...espacios.flatMap((w) => ['-w', w])];
let salida;
try {
  salida = execFileSync('npm', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
} catch (e) {
  salida = e.stdout; // npm audit sale con código 1 cuando encuentra algo
}
const informe = JSON.parse(salida);
const hoy = new Date().toISOString().slice(0, 10);
const vigentes = new Set(excepciones.filter((x) => x.revisarAntesDe >= hoy).map((x) => x.aviso));
const vencidas = excepciones.filter((x) => x.revisarAntesDe < hoy);

const vulns = new Map(Object.entries(informe.vulnerabilities ?? {}));
/** Los avisos de verdad detrás de un paquete (siguiendo las dependencias que lo arrastran). */
function avisos(nombre, vistos = new Set()) {
  if (vistos.has(nombre)) return [];
  vistos.add(nombre);
  return (vulns.get(nombre)?.via ?? []).flatMap((v) =>
    typeof v === 'string' ? avisos(v, vistos) : [{ url: v.url ?? '', severidad: v.severity }],
  );
}
const graves = new Set(['high', 'critical']);
const fallos = [];
for (const [nombre, v] of vulns) {
  if (!graves.has(v.severity)) continue;
  const sinExcepcion = avisos(nombre).filter(
    (a) => graves.has(a.severidad) && ![...vigentes].some((id) => a.url.endsWith(id)),
  );
  if (sinExcepcion.length) fallos.push(`${nombre}: ${sinExcepcion.map((a) => a.url).join(', ')}`);
}
for (const x of vencidas)
  fallos.push(`excepción vencida (${x.revisarAntesDe}): ${x.aviso} ${x.paquete} — revísala`);
if (fallos.length) {
  console.error('Auditoría de dependencias: hay avisos altos o críticos sin resolver:');
  for (const f of fallos) console.error(`  - ${f}`);
  process.exit(1);
}
const usadas = vulns.size;
console.log(
  usadas
    ? `Auditoría de dependencias: sin avisos nuevos (${vigentes.size} excepción(es) anotada(s) y vigente(s)).`
    : 'Auditoría de dependencias: 0 avisos.',
);
