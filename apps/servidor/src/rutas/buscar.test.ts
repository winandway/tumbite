import { describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';

/** Buscador real del inicio (18 oct 2026): restaurantes y platos de la ciudad, como en los grandes. */
async function escenario() {
  const m = mundo();
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const rid = r.datos.restaurante.id as string;
  await m.llamar(
    'POST',
    '/datos/mi-restaurante/platos',
    { nombreEs: 'Sándwich cubano', nombreEn: 'Cuban sandwich', precioCentavos: 1250 },
    dueno.token,
  );
  await m.llamar(
    'POST',
    '/datos/mi-restaurante/platos',
    { nombreEs: 'Croquetas', nombreEn: 'Croquettes', precioCentavos: 500 },
    dueno.token,
  );
  await m.llamar('PATCH', `/datos/admin/restaurantes/${rid}`, { estado: 'aprobado' }, admin.token);
  await m.abrir(dueno.token);
  return { m, rid, dueno };
}
const EN_MIAMI = 'lat=25.78&lng=-80.2';

describe('GET /datos/buscar', () => {
  it('encuentra restaurantes por nombre o tipo de comida y platos por su nombre, en los dos idiomas', async () => {
    const { m, rid } = await escenario();
    const r = await m.llamar('GET', `/datos/buscar?q=cuban&${EN_MIAMI}`);
    expect(r.estado).toBe(200);
    // «Cubana» es el tipo de comida del restaurante; «Sándwich cubano» es un plato.
    expect(r.datos.restaurantes.map((x: { id: string }) => x.id)).toEqual([rid]);
    expect(r.datos.platos).toHaveLength(1);
    expect(r.datos.platos[0]).toMatchObject({
      nombre: 'Sándwich cubano',
      precioCentavos: 1250,
      restauranteId: rid,
      restauranteNombre: 'Sabor Prueba',
      abiertoAhora: true,
    });
    const en = await m.crudo(`/datos/buscar?q=croquet&${EN_MIAMI}`, {
      headers: { 'x-idioma': 'en' },
    });
    const d = (await en.json()) as { platos: { nombre: string }[]; restaurantes: unknown[] };
    expect(d.platos[0]?.nombre).toBe('Croquettes');
    expect(d.restaurantes).toHaveLength(0);
  });

  it('sin acentos ni mayúsculas encuentra igual, y los comodines no se cuelan', async () => {
    const { m } = await escenario();
    const r = await m.llamar('GET', `/datos/buscar?q=SANDWICH&${EN_MIAMI}`);
    expect(r.datos.platos).toHaveLength(1);
    const raro = await m.llamar('GET', `/datos/buscar?q=%25%25&${EN_MIAMI}`);
    expect(raro.datos.platos).toHaveLength(0);
    expect(raro.datos.restaurantes).toHaveLength(0);
  });

  it('exige al menos dos letras y no muestra lo que no está aprobado ni lo agotado', async () => {
    const { m, rid, dueno } = await escenario();
    expect((await m.llamar('GET', `/datos/buscar?q=c&${EN_MIAMI}`)).estado).toBe(400);
    const admin = await m.cuenta('admin');
    await m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${rid}`,
      { estado: 'pendiente' },
      admin.token,
    );
    const r = await m.llamar('GET', `/datos/buscar?q=cuban&${EN_MIAMI}`);
    expect(r.datos.restaurantes).toHaveLength(0);
    expect(r.datos.platos).toHaveLength(0);
    await m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${rid}`,
      { estado: 'aprobado' },
      admin.token,
    );
    const mio = await m.llamar('GET', '/datos/mi-restaurante', undefined, dueno.token);
    const cubano = mio.datos.platos.find((p: { nombreEs: string }) =>
      p.nombreEs.includes('cubano'),
    );
    await m.llamar(
      'PATCH',
      `/datos/mi-restaurante/platos/${cubano.id}/disponible`,
      { disponible: false },
      dueno.token,
    );
    const r2 = await m.llamar('GET', `/datos/buscar?q=cuban&${EN_MIAMI}`);
    expect(r2.datos.restaurantes).toHaveLength(1);
    expect(r2.datos.platos).toHaveLength(0);
  });

  it('fuera de toda ciudad activa no hay resultados y se dice', async () => {
    const { m } = await escenario();
    const r = await m.llamar('GET', '/datos/buscar?q=cuban&lat=48.85&lng=2.35');
    expect(r.datos).toMatchObject({ zona: null, restaurantes: [], platos: [] });
  });
});
