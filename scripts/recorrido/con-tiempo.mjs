// C-RECORRIDO-TANDAS: corre un comando y avisa en la corrida (anotación de GitHub y resumen) cuando
// tarda más del 70 % de su límite, ANTES de que el límite lo corte y frene la publicación.
// Uso: node scripts/recorrido/con-tiempo.mjs <limite-en-minutos> <nombre> -- <comando…>
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

export const UMBRAL = 0.7;

/** El aviso que toca para lo que tardó (o null si va bien). */
export function avisoDeTiempo(nombre, segundos, limiteMin) {
  const limite = limiteMin * 60;
  if (segundos <= limite * UMBRAL) return null;
  const pct = Math.round((segundos / limite) * 100);
  return `${nombre} tardó ${Math.round(segundos / 60)} min, el ${pct} % de su límite de ${limiteMin} min. Reparte sus pruebas en otra tanda antes de que lo corte (scripts/recorrido/tandas.mjs).`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [limiteTexto, nombre, separador, ...comando] = process.argv.slice(2);
  const limiteMin = Number(limiteTexto);
  if (!limiteMin || !nombre || separador !== '--' || !comando.length)
    throw new Error('uso: con-tiempo.mjs <limite-min> <nombre> -- <comando…>');
  const inicio = Date.now();
  const r = spawnSync(comando.join(' '), { stdio: 'inherit', shell: true });
  const segundos = (Date.now() - inicio) / 1000;
  const aviso = avisoDeTiempo(nombre, segundos, limiteMin);
  console.log(`${nombre}: ${Math.round(segundos)} s de ${limiteMin * 60} s`);
  if (aviso) {
    console.log(`::warning title=Tiempo del recorrido::${aviso}`);
    const resumen = process.env.GITHUB_STEP_SUMMARY;
    // La ruta del resumen la pone GitHub en la corrida (no viene de nadie de afuera).
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (resumen) appendFileSync(resumen, `⚠️ ${aviso}\n`);
  }
  process.exit(r.status ?? 1);
}
