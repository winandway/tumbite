import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';

/**
 * C-CONTRATO-APPS (CON-1, 2 nov 2026): la causa del cierre de «Equipo» en la app del restaurante
 * fue leer una forma de respuesta que el servidor no manda. Esta prueba recorre el código de las
 * tres apps, toma cada lectura `api.pedir<{ … }>('GET', '/datos/…')` con dirección fija, llama a esa
 * misma dirección con una cuenta del rol de la app y exige que la respuesta traiga cada llave
 * obligatoria que la pantalla declara. Si alguien cambia el servidor o la app sin el otro, se
 * pone en rojo. Todos los países.
 */
const RAIZ = join(__dirname, '..', '..', '..');
const APPS = { cliente: 'cliente', repartidor: 'repartidor', restaurante: 'restaurante' } as const;
type Rol = keyof typeof APPS;

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === 'node_modules' ? [] : archivos(p);
    return /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}

/** Llaves de primer nivel de un tipo `{ a: X; b?: Y }`; las opcionales (`?`) no se exigen. */
export function llavesObligatorias(tipo: string): string[] {
  const cuerpo = tipo.trim().slice(1, -1);
  const llaves: string[] = [];
  let hondo = 0;
  let tramo = '';
  const cerrar = () => {
    const m = /^\s*([A-Za-z_$][\w$]*)\s*(\??)\s*:/.exec(tramo);
    if (m && !m[2]) llaves.push(m[1]!);
    tramo = '';
  };
  for (const ch of cuerpo) {
    if ('{[(<'.includes(ch)) hondo++;
    else if ('}])>'.includes(ch)) hondo--;
    if (hondo === 0 && (ch === ';' || ch === ',' || ch === '\n')) cerrar();
    else tramo += ch;
  }
  cerrar();
  return llaves;
}

type Lectura = { rol: Rol; archivo: string; ruta: string; llaves: string[]; lista?: true };

/** Cada `pedir<{…}>('GET', '/datos/…')` con dirección fija (sin variables ni consulta). */
export function lecturas(fuente: string): { ruta: string; llaves: string[]; lista?: true }[] {
  const out: { ruta: string; llaves: string[]; lista?: true }[] = [];
  let i = 0;
  while ((i = fuente.indexOf('pedir<', i)) !== -1) {
    let j = i + 'pedir<'.length;
    let hondo = 1;
    const ini = j;
    while (j < fuente.length && hondo > 0) {
      const ch = fuente[j]!;
      if (ch === '<') hondo++;
      else if (ch === '>' && fuente[j - 1] !== '=') hondo--;
      j++;
    }
    const tipo = fuente.slice(ini, j - 1).trim();
    const resto = /^\(\s*'GET'\s*,\s*'(\/datos\/[^'?$]*)'/.exec(fuente.slice(j));
    if (resto && tipo.startsWith('{'))
      out.push({ ruta: resto[1]!, llaves: llavesObligatorias(tipo) });
    // El fallo de «Equipo»: la pantalla esperaba una lista y el servidor manda un objeto.
    else if (resto && /^(\w+\[\]|Array<.*>)$/s.test(tipo))
      out.push({ ruta: resto[1]!, llaves: [], lista: true });
    i = j;
  }
  return out;
}

function todas(): Lectura[] {
  return (Object.keys(APPS) as Rol[]).flatMap((rol) =>
    archivos(join(RAIZ, APPS[rol], 'src')).flatMap((archivo) =>
      lecturas(readFileSync(archivo, 'utf8')).map((l) => ({
        rol,
        archivo: relative(RAIZ, archivo),
        ...l,
      })),
    ),
  );
}

describe('C-CONTRATO-APPS: lo que leen las tres apps es lo que manda el servidor', () => {
  it('el lector entiende tipos anidados y llaves opcionales', () => {
    expect(
      llavesObligatorias('{ a: { x: number; y: string }; b?: string; c: Array<{ z: 1 }> }'),
    ).toEqual(['a', 'c']);
    expect(
      lecturas("api.pedir<{ equipo: M[]; miRol: string }>('GET', '/datos/mi-restaurante/equipo')"),
    ).toEqual([{ ruta: '/datos/mi-restaurante/equipo', llaves: ['equipo', 'miRol'] }]);
    expect(lecturas("api.pedir<Miembro[]>('GET', '/datos/mi-restaurante/equipo')")).toEqual([
      { ruta: '/datos/mi-restaurante/equipo', llaves: [], lista: true },
    ]);
  });

  it('cada lectura con dirección fija trae las llaves que la pantalla usa', async () => {
    const m = mundo();
    const tokens = {
      cliente: (await m.cuenta('cliente', 'Ana Contrato')).token,
      repartidor: (await m.cuenta('repartidor', 'Rita Contrato')).token,
      restaurante: (await m.cuenta('restaurante', 'Rosa Contrato')).token,
    };
    await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, tokens.restaurante);
    const ls = todas();
    // Si el lector deja de encontrar lecturas, la prueba no protege nada: que salte.
    expect(ls.length).toBeGreaterThan(30);
    const fallos: string[] = [];
    for (const l of ls) {
      const r = await m.llamar('GET', l.ruta, undefined, tokens[l.rol]);
      // Lo que responde con error (servicio apagado, falta un paso previo) lo cubre su propia prueba.
      if (r.estado !== 200) continue;
      if (l.lista && !Array.isArray(r.datos))
        fallos.push(`${l.archivo}: ${l.ruta} espera una lista y llega un objeto`);
      for (const k of l.llaves)
        if (!(k in (r.datos as object))) fallos.push(`${l.archivo}: ${l.ruta} no trae «${k}»`);
    }
    expect(fallos).toEqual([]);
  });

  it('CON-4: el panel web lee lo que manda el servidor (superadmin, restaurante y demás)', async () => {
    const m = mundo();
    const restaurante = (await m.cuenta('restaurante', 'Rosa Panel')).token;
    await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, restaurante);
    // El panel no dice el rol de cada pantalla: se prueba con cada cuenta y vale la primera que entra.
    const cuentas = [
      (await m.cuenta('admin', 'Soporte Panel')).token,
      restaurante,
      (await m.cuenta('repartidor', 'Rita Panel')).token,
      (await m.cuenta('cliente', 'Ana Panel')).token,
    ];
    const ls = archivos(join(RAIZ, 'panel', 'src')).flatMap((archivo) =>
      lecturas(readFileSync(archivo, 'utf8')).map((l) => ({
        archivo: relative(RAIZ, archivo),
        ...l,
      })),
    );
    expect(ls.length).toBeGreaterThan(30);
    const fallos: string[] = [];
    for (const l of ls) {
      let datos: unknown;
      for (const token of cuentas) {
        const r = await m.llamar('GET', l.ruta, undefined, token);
        if (r.estado === 200) {
          datos = r.datos;
          break;
        }
      }
      if (datos === undefined) continue;
      if (l.lista && !Array.isArray(datos))
        fallos.push(`${l.archivo}: ${l.ruta} espera una lista y llega un objeto`);
      for (const k of l.llaves)
        if (!(k in (datos as object))) fallos.push(`${l.archivo}: ${l.ruta} no trae «${k}»`);
    }
    expect(fallos).toEqual([]);
  });
});
