import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ETIQUETAS_DIETA, esquemaPlato } from '@tumbite/compartido';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';

/**
 * C-FILTROS-DIETA (29 oct 2026, como DoorDash y Uber Eats): el restaurante marca cada plato como
 * vegetariano, vegano, sin gluten, halal o picante; el cliente ve esas marcas en el menú y filtra el
 * buscador por ellas, con o sin texto. Las marcas son una lista cerrada (nada de texto libre).
 * Todos los países.
 */
const raiz = join(__dirname, '..', '..', '..');
const leer = (...r: string[]) => readFileSync(join(raiz, ...r), 'utf8');

async function escenario() {
  const m = mundo();
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const rid = r.datos.restaurante.id as string;
  await m.llamar('PATCH', `/datos/admin/restaurantes/${rid}`, { estado: 'aprobado' }, admin.token);
  await m.abrir(dueno.token);
  const crear = (cuerpo: Record<string, unknown>) =>
    m.llamar('POST', '/datos/mi-restaurante/platos', cuerpo, dueno.token);
  return { m, dueno, rid, crear };
}

describe('filtros de dieta en el menú y el buscador', () => {
  it('la lista de marcas es cerrada y el esquema rechaza las inventadas', () => {
    expect([...ETIQUETAS_DIETA]).toEqual([
      'vegetariano',
      'vegano',
      'sin_gluten',
      'halal',
      'picante',
    ]);
    expect(
      esquemaPlato.safeParse({ nombreEs: 'Ensalada', precioCentavos: 900 }).data?.etiquetas,
    ).toEqual([]);
    expect(
      esquemaPlato.safeParse({ nombreEs: 'Ensalada', precioCentavos: 900, etiquetas: ['keto'] })
        .success,
    ).toBe(false);
  });

  it('el restaurante guarda las marcas, las cambia y el menú público las muestra', async () => {
    const { m, dueno, rid, crear } = await escenario();
    const p = await crear({
      nombreEs: 'Ensalada verde',
      precioCentavos: 900,
      etiquetas: ['vegano', 'vegetariano', 'vegano'],
    });
    expect(p.estado).toBe(201);
    expect(p.datos.plato.etiquetas).toEqual(['vegetariano', 'vegano']);
    const id = p.datos.plato.id as string;
    const cambio = await m.llamar(
      'PUT',
      `/datos/mi-restaurante/platos/${id}`,
      { nombreEs: 'Ensalada verde', precioCentavos: 900, etiquetas: ['sin_gluten'] },
      dueno.token,
    );
    expect(cambio.datos.plato.etiquetas).toEqual(['sin_gluten']);
    const menu = await m.llamar('GET', `/datos/restaurantes/${rid}`);
    expect(menu.datos.platos[0].etiquetas).toEqual(['sin_gluten']);
  });

  it('el buscador filtra los platos por marca, con texto o solo con la marca', async () => {
    const { m, crear } = await escenario();
    await crear({ nombreEs: 'Pizza margarita', precioCentavos: 1200, etiquetas: ['vegetariano'] });
    await crear({ nombreEs: 'Pizza de pepperoni', precioCentavos: 1400 });
    await crear({ nombreEs: 'Pizza diabla', precioCentavos: 1400, etiquetas: ['picante'] });
    const conTexto = await m.llamar('GET', '/datos/buscar?q=pizza&dieta=vegetariano');
    expect(conTexto.estado).toBe(200);
    expect(conTexto.datos.platos.map((p: { nombre: string }) => p.nombre)).toEqual([
      'Pizza margarita',
    ]);
    expect(conTexto.datos.platos[0].etiquetas).toEqual(['vegetariano']);
    const soloMarca = await m.llamar('GET', '/datos/buscar?dieta=picante');
    expect(soloMarca.estado).toBe(200);
    expect(soloMarca.datos.platos.map((p: { nombre: string }) => p.nombre)).toEqual([
      'Pizza diabla',
    ]);
    // El restaurante sale si tiene al menos un plato con esa marca.
    expect(soloMarca.datos.restaurantes.length).toBe(1);
    const sinNada = await m.llamar('GET', '/datos/buscar?dieta=keto');
    expect(sinNada.estado).toBe(400);
    const vacio = await m.llamar('GET', '/datos/buscar');
    expect(vacio.estado).toBe(400);
    // Sin filtro, todo sigue como antes.
    const todos = await m.llamar('GET', '/datos/buscar?q=pizza');
    expect(todos.datos.platos.length).toBe(3);
  });

  it('el panel, la app del restaurante y la del cliente usan las marcas, con su guía en los dos idiomas', () => {
    expect(leer('apps', 'panel', 'src', 'panel', 'Menu.tsx')).toContain('ETIQUETAS_DIETA');
    expect(leer('apps', 'restaurante', 'src', 'MiMenu.tsx')).toContain('ETIQUETAS_DIETA');
    const buscar = leer('apps', 'cliente', 'src', 'app', 'search.tsx');
    expect(buscar).toContain('ETIQUETAS_DIETA');
    expect(buscar).toContain('dieta=');
    const guias = leer('apps', 'panel', 'src', 'sitio', 'docs', 'guias.ts');
    expect(guias.split(`id: 'dietary-filters'`).length - 1).toBe(2);
  });
});
