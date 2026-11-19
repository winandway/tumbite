import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCS } from './guias';

/**
 * C-DOCS-SIN-DATOS-REALES (18 nov 2026, Richard) — todos los países. La guía pública «Invita
 * conductores y arma tu equipo» mostraba el nombre, el código y el QR de un equipo de verdad: quien
 * la leía podía creer que ese era el QR de esa línea. En lo público (Docs, la web, las capturas y
 * los guiones que las toman) nunca va el nombre ni el código de un equipo, un líder o un cupón de
 * verdad: solo ejemplos, con un código que el servidor no puede generar.
 *
 * El repositorio es público, así que la lista se revisa en TODO el código y los documentos, no solo
 * en las guías. Para vetar otro nombre real, se agrega aquí.
 */
const RAIZ = join(__dirname, '..', '..', '..', '..', '..');
/** Sin acentos y en minúsculas: «Jehová», «JEHOVA» y «jehova» son lo mismo. */
const llano = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Nombres y códigos de equipos reales (ya llanos). */
export const VETADOS = ['jehova', 'jireh', 'jehovaucs'];
/** Códigos de regalo reales: se revisan tal cual, en mayúsculas, solo en lo que ve el público. */
const CUPONES_REALES = [/\bVIGIA\b/];

/**
 * Añadido de Richard (18 nov 2026): los ejemplos y las capturas públicas son NEUTROS DE LUGAR. Nada
 * de una ciudad o una calle reconocible: quien vive en otra ciudad cree que ahí no sirve. Las páginas
 * que de verdad dicen dónde opera Divoox sí pueden nombrar ciudades; esto es para ejemplos y capturas.
 */
const LUGARES =
  /\b(el vigia|tucani|novi|miami|tampa|orlando|ocala|caracas|merida|bogota|detroit|michigan|florida)\b/;
/** Los guiones cuyas capturas ya se rehicieron sin lugar: en ellos es candado, no aviso. */
const GUIONES_SIN_LUGAR = [
  'e2e/recorrido/referidosEquipos.spec.ts',
  'e2e/recorrido/regalosDivoox.spec.ts',
];
/** Lo que un guion escribe en pantalla: nombres, equipos, regalos y direcciones. */
const SE_VE = /^\s*(equipo|lider|miembros|pasajero|conductor|nombreEs|nombreEn|recogida|destino):/;

const ESTE = 'apps/panel/src/sitio/docs/sinDatosReales.test.ts';
const archivos = execFileSync(
  'git',
  ['ls-files', '--', 'apps', 'packages', 'e2e', 'scripts', 'docs', 'simulador'],
  { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
)
  .split('\n')
  .filter((a) => /\.(ts|tsx|mjs|js|json|md|css|html|sql|txt)$/.test(a) && a !== ESTE);
const leer = (a: string) => readFileSync(join(RAIZ, a), 'utf8');

describe('C-DOCS-SIN-DATOS-REALES', () => {
  it('ninguna guía pública nombra un equipo o un código de verdad', () => {
    const texto = llano(JSON.stringify(DOCS));
    expect(VETADOS.filter((v) => texto.includes(v))).toEqual([]);
    const crudo = JSON.stringify(DOCS);
    expect(CUPONES_REALES.filter((c) => c.test(crudo)).map(String)).toEqual([]);
  });

  it('ningún archivo del repositorio (público) nombra un equipo de verdad', () => {
    expect(archivos.length).toBeGreaterThan(500);
    const malos = archivos.filter((a) => {
      const t = llano(leer(a));
      return VETADOS.some((v) => t.includes(v));
      // Lee todo el repositorio: con la máquina cargada pasa de los cinco segundos de costumbre.
    }, 60_000);
    expect(malos).toEqual([]);
  });

  it('la web pública y los guiones de las capturas no usan un código de regalo de verdad', () => {
    const malos = archivos
      .filter((a) => a.startsWith('apps/panel/src/sitio/') || a.startsWith('e2e/recorrido/'))
      .filter((a) => CUPONES_REALES.some((c) => c.test(leer(a))));
    expect(malos).toEqual([]);
  }, 60_000);

  it('los guiones de las capturas rehechas no escriben en pantalla una ciudad ni una calle real', () => {
    const malas = GUIONES_SIN_LUGAR.flatMap((g) =>
      leer(g)
        .split('\n')
        .filter((l) => SE_VE.test(l) && LUGARES.test(llano(l)))
        .map((l) => `${g}: ${l.trim()}`),
    );
    expect(malas).toEqual([]);
    // La página de la invitación se captura sin ciudad y sin el pie del sitio (lista de ciudades).
    const guion = leer('e2e/recorrido/referidosEquipos.spec.ts');
    expect(guion).toContain('d.invitacion.ciudad = null');
    expect(guion).toContain("locator('footer')");
  });

  it('aviso: guías públicas cuyas capturas o ejemplos nombran una ciudad', () => {
    const conLugar: string[] = [];
    for (const [idioma, secciones] of Object.entries(DOCS))
      for (const seccion of secciones)
        for (const guia of seccion.guias) {
          const textos = (guia.capturas ?? []).flatMap((c) => [c.alt, c.pie]);
          if (textos.some((t) => LUGARES.test(llano(t)))) conLugar.push(`${idioma}/${guia.id}`);
        }
    // No falla: es la lista de trabajo para ir rehaciendo esas capturas sin lugar.
    if (conLugar.length)
      console.warn(
        `C-DOCS-SIN-DATOS-REALES (aviso): ${conLugar.length} guías describen capturas con una ciudad: ${conLugar.join(', ')}`,
      );
    expect(Array.isArray(conLugar)).toBe(true);
  });

  it('las capturas de referidos usan un código que el servidor nunca genera', () => {
    const guion = leer('e2e/recorrido/referidosEquipos.spec.ts');
    const codigos = [...guion.matchAll(/codigo: '([A-Z0-9]+)'/g)].map((m) => m[1] ?? '');
    expect(codigos.length).toBe(2);
    // El alfabeto de los códigos no tiene O, I, 0 ni 1: un final con esos signos no puede salir.
    for (const c of codigos) expect(c.slice(-3)).toMatch(/[OI01]/);
  });
});
