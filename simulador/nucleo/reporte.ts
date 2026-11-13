import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Paso, ResultadoCorrida, ResultadoEscenario } from './libreto.ts';

/**
 * El reporte único de una corrida: un JSON (para máquinas) y una página HTML legible en español,
 * sin nada externo (ni letras, ni scripts, ni imágenes de afuera), que se abre con doble clic.
 */
export function escribirReporte(
  r: ResultadoCorrida,
  carpeta: string,
): { json: string; html: string } {
  // La carpeta la elige quien corre el simulador (por defecto, simulador/reportes/<corrida>).
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  mkdirSync(carpeta, { recursive: true });
  const json = join(carpeta, 'reporte.json');
  const html = join(carpeta, 'reporte.html');
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  writeFileSync(json, JSON.stringify(r, null, 2));
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  writeFileSync(html, paginaHtml(r));
  return { json, html };
}

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const seg = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/** Cómo se cuenta un escenario: bien, falla nueva, falla ya conocida, o conocida que ya no falla. */
export function veredicto(e: ResultadoEscenario): 'bien' | 'falla' | 'conocido' | 'yaNoFalla' {
  if (e.ok) return e.falloConocido ? 'yaNoFalla' : 'bien';
  return e.falloConocido ? 'conocido' : 'falla';
}

const etiqueta = (v: ReturnType<typeof veredicto>) =>
  v === 'bien'
    ? 'En verde'
    : v === 'falla'
      ? 'En rojo'
      : v === 'conocido'
        ? 'En rojo · fallo conocido'
        : 'Ya no falla: quitar la marca de fallo conocido';

export function contar(r: ResultadoCorrida) {
  const v = r.escenarios.map(veredicto);
  return {
    total: v.length,
    bien: v.filter((x) => x === 'bien').length,
    fallas: v.filter((x) => x === 'falla').length,
    conocidos: v.filter((x) => x === 'conocido').length,
    yaNoFallan: v.filter((x) => x === 'yaNoFalla').length,
  };
}

function filaPeticion(p: Paso['peticiones'][number]): string {
  const malo = p.estado === 'red' || p.estado >= 400;
  return `<tr class="${malo ? 'mal' : ''}"><td>${seg(p.t)}</td><td>${esc(p.actor)}</td><td><code>${esc(p.metodo)} ${esc(p.ruta)}</code>${p.mania ? ` <span class="mania">${esc(p.mania)}</span>` : ''}</td><td>${esc(p.estado)}</td><td>${p.ms} ms</td><td class="corto">${esc(p.respuesta ?? '')}</td></tr>`;
}

function bloquePaso(p: Paso): string {
  const detalle = p.peticiones.length
    ? `<details${p.ok ? '' : ' open'}><summary>${p.peticiones.length} peticiones</summary><table><thead><tr><th>Cuándo</th><th>Actor</th><th>Qué pidió</th><th>Respuesta</th><th>Tardó</th><th>Lo que respondió el servidor</th></tr></thead><tbody>${p.peticiones.map(filaPeticion).join('')}</tbody></table></details>`
    : '';
  const fallo = p.ok
    ? ''
    : `<p class="motivo">${esc(p.error)}</p>${p.ultimaRespuesta ? `<p class="servidor">Última respuesta del servidor en este paso: <code>${esc(p.ultimaRespuesta.metodo)} ${esc(p.ultimaRespuesta.ruta)}</code> → ${esc(p.ultimaRespuesta.estado)}<br><code>${esc(p.ultimaRespuesta.respuesta ?? '')}</code></p>` : ''}`;
  const notas = p.notas.length
    ? `<ul class="notas">${p.notas.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`
    : '';
  return `<li class="paso ${p.ok ? 'ok' : 'no'}"><span class="punto"></span><div><strong>${esc(p.nombre)}</strong> <span class="gris">a los ${seg(p.t)}, tardó ${seg(p.ms)}</span>${fallo}${notas}${detalle}</div></li>`;
}

function bloqueEscenario(e: ResultadoEscenario, i: number): string {
  const v = veredicto(e);
  return `<section class="escenario ${v}" id="e${i}">
<h2><span class="sello ${v}">${etiqueta(v)}</span> ${esc(e.nombre)}</h2>
<p>${esc(e.descripcion)}</p>
${e.vigila.length ? `<p class="gris">Vigila: ${e.vigila.map((x) => `<code>${esc(x)}</code>`).join(' ')}</p>` : ''}
${e.falloConocido ? `<p class="conocido">Fallo conocido: ${esc(e.falloConocido)}</p>` : ''}
${e.error ? `<p class="motivo">Por qué falló: ${esc(e.error)}</p>` : ''}
<p class="gris">Tardó ${seg(e.ms)}${e.filas ? ` · el servidor leyó ${e.filas.leidas} filas y escribió ${e.filas.escritas}` : ''} · ${e.comprobaciones.filter((c) => c.ok).length} de ${e.comprobaciones.length} comprobaciones bien</p>
<ol class="linea">${e.pasos.map(bloquePaso).join('')}</ol>
</section>`;
}

export function paginaHtml(r: ResultadoCorrida): string {
  const n = contar(r);
  const indice = r.escenarios
    .map((e, i) => {
      const v = veredicto(e);
      return `<tr class="${v}"><td><a href="#e${i}">${esc(e.nombre)}</a></td><td><span class="sello ${v}">${etiqueta(v)}</span></td><td>${seg(e.ms)}</td><td>${e.filas ? e.filas.escritas : '—'}</td></tr>`;
    })
    .join('');
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Simulador: corrida ${esc(r.corrida)}</title>
<style>
:root{--fondo:#fff;--texto:#101010;--gris:#666b73;--borde:#d9dbe0;--verde:#13803b;--verde-suave:#e8f6ed;--rojo:#c20a1a;--rojo-suave:#fdecee;--ambar:#8a5a00;--ambar-suave:#fff5e0}
@media (prefers-color-scheme:dark){:root{--fondo:#101010;--texto:#f2f2f2;--gris:#a4a8b0;--borde:#2a2a2a;--verde:#4cc47a;--verde-suave:#10261a;--rojo:#ff5a66;--rojo-suave:#2c1215;--ambar:#e0b25a;--ambar-suave:#2a2110}}
*{box-sizing:border-box}body{margin:0;background:var(--fondo);color:var(--texto);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px 64px}h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:0 0 6px}
.gris{color:var(--gris)}code{font:13px ui-monospace,Menlo,monospace;word-break:break-all}
.resumen{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}.cifra{border:1px solid var(--borde);border-radius:10px;padding:10px 14px;min-width:120px}.cifra b{display:block;font-size:22px}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{border-bottom:1px solid var(--borde);padding:6px 8px;text-align:left;vertical-align:top}
tr.mal td{background:var(--rojo-suave)}td.corto{max-width:420px;word-break:break-word;color:var(--gris)}
.sello{display:inline-block;border-radius:999px;padding:1px 10px;font-size:12px;font-weight:600}
.sello.bien,.sello.yaNoFalla{background:var(--verde-suave);color:var(--verde)}.sello.falla{background:var(--rojo-suave);color:var(--rojo)}.sello.conocido{background:var(--ambar-suave);color:var(--ambar)}
.escenario{border:1px solid var(--borde);border-radius:12px;padding:16px;margin:16px 0;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.linea{list-style:none;padding:0;margin:12px 0 0}.paso{display:flex;gap:10px;padding:6px 0}.paso .punto{flex:none;width:12px;height:12px;border-radius:50%;margin-top:5px}
.paso.ok .punto{background:var(--verde)}.paso.no .punto{background:var(--rojo)}.motivo{color:var(--rojo);margin:4px 0}.conocido{color:var(--ambar)}
.servidor{font-size:13px;margin:4px 0}.mania{font-size:11px;border:1px solid var(--borde);border-radius:6px;padding:0 5px;color:var(--gris)}
details{margin-top:4px}summary{cursor:pointer;color:var(--gris);font-size:13px}.notas{margin:4px 0;padding-left:18px;color:var(--gris);font-size:13px}
.tabla-indice{overflow-x:auto}
</style></head><body><main>
<h1>Simulador de compras y entregas</h1>
<p class="gris">Corrida <code>${esc(r.corrida)}</code> · semilla <code>${r.semilla}</code> (con la misma semilla se repite) · contra ${esc(r.destino)} · ${esc(r.inicio)} · tardó ${seg(r.ms)}</p>
<div class="resumen">
<div class="cifra"><b>${n.total}</b>escenarios</div>
<div class="cifra"><b style="color:var(--verde)">${n.bien}</b>en verde</div>
<div class="cifra"><b style="color:var(--rojo)">${n.fallas}</b>fallas nuevas</div>
<div class="cifra"><b style="color:var(--ambar)">${n.conocidos}</b>fallos conocidos</div>
${r.filas ? `<div class="cifra"><b>${r.filas.escritas}</b>filas escritas</div>` : ''}
</div>
${r.notas.length ? `<ul class="notas">${r.notas.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
<div class="tabla-indice"><table><thead><tr><th>Escenario</th><th>Resultado</th><th>Tardó</th><th>Filas escritas</th></tr></thead><tbody>${indice}</tbody></table></div>
${r.escenarios.map(bloqueEscenario).join('\n')}
</main></body></html>
`;
}

/** Resumen corto en Markdown (para la página de la corrida en GitHub). */
export function resumenMarkdown(r: ResultadoCorrida): string {
  const n = contar(r);
  const lineas = [
    `## Simulador de compras y entregas · ${r.ok ? 'en verde' : 'en rojo'}`,
    '',
    `Corrida \`${r.corrida}\`, semilla \`${r.semilla}\`, contra ${r.destino}. ${n.bien} de ${n.total} en verde, ${n.fallas} fallas nuevas, ${n.conocidos} fallos conocidos.${r.filas ? ` Filas escritas: ${r.filas.escritas}.` : ''}`,
    '',
    '| Escenario | Resultado | Tardó | Filas escritas |',
    '| --- | --- | --- | --- |',
    ...r.escenarios.map(
      (e) =>
        `| ${e.nombre} | ${etiqueta(veredicto(e))} | ${seg(e.ms)} | ${e.filas ? e.filas.escritas : '—'} |`,
    ),
  ];
  const malos = r.escenarios.filter((e) => !e.ok);
  if (malos.length) {
    lineas.push('', '### Lo que falló');
    for (const e of malos) lineas.push(`- **${e.nombre}**: ${e.error ?? ''}`);
  }
  return `${lineas.join('\n')}\n`;
}
