import { describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';

const PLATO = {
  nombreEs: 'Sándwich cubano',
  nombreEn: 'Cuban sandwich',
  precioCentavos: 1250,
  categoria: 'Sándwiches',
};

describe('restaurantes y menús', () => {
  it('el dueño crea su restaurante, queda en revisión y no se ve en público', async () => {
    const m = mundo();
    const dueno = await m.cuenta('restaurante');
    const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    expect(r.estado).toBe(201);
    expect(r.datos.restaurante.estado).toBe('pendiente');
    const lista = await m.llamar('GET', '/datos/restaurantes');
    expect(lista.datos.restaurantes).toHaveLength(0);
    const abrir = await m.llamar(
      'PATCH',
      '/datos/mi-restaurante/abierto',
      { abierto: true },
      dueno.token,
    );
    expect(abrir.estado).toBe(409);
  });

  it('el admin lo aprueba, el dueño lo abre y aparece con su menú', async () => {
    const m = mundo();
    const dueno = await m.cuenta('restaurante');
    const admin = await m.cuenta('admin');
    const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    await m.llamar('POST', '/datos/mi-restaurante/platos', PLATO, dueno.token);
    const ap = await m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${r.datos.restaurante.id}`,
      { estado: 'aprobado', plan: 'crece' },
      admin.token,
    );
    expect(ap.datos.restaurante.plan).toBe('crece');
    await m.llamar('PATCH', '/datos/mi-restaurante/abierto', { abierto: true }, dueno.token);
    const lista = await m.llamar('GET', '/datos/restaurantes?lat=25.78&lng=-80.2');
    expect(lista.datos.restaurantes[0].abierto).toBe(true);
    expect(lista.datos.restaurantes[0].distanciaKm).toBeLessThan(3);
    const det = await m.llamar('GET', `/datos/restaurantes/${r.datos.restaurante.id}`);
    expect(det.datos.platos[0].nombreEn).toBe('Cuban sandwich');
    expect(det.datos.platos[0].precioCentavos).toBe(1250);
  });

  it('un plato agotado o borrado no aparece en público, pero el dueño sí ve el agotado', async () => {
    const m = mundo();
    const dueno = await m.cuenta('restaurante');
    const admin = await m.cuenta('admin');
    const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    await m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${r.datos.restaurante.id}`,
      { estado: 'aprobado' },
      admin.token,
    );
    const a = await m.llamar('POST', '/datos/mi-restaurante/platos', PLATO, dueno.token);
    const b = await m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { ...PLATO, nombreEs: 'Croquetas' },
      dueno.token,
    );
    await m.llamar(
      'PATCH',
      `/datos/mi-restaurante/platos/${a.datos.plato.id}/disponible`,
      { disponible: false },
      dueno.token,
    );
    await m.llamar(
      'DELETE',
      `/datos/mi-restaurante/platos/${b.datos.plato.id}`,
      undefined,
      dueno.token,
    );
    const pub = await m.llamar('GET', `/datos/restaurantes/${r.datos.restaurante.id}`);
    expect(pub.datos.platos).toHaveLength(0);
    const mio = await m.llamar('GET', '/datos/mi-restaurante', undefined, dueno.token);
    expect(mio.datos.platos).toHaveLength(1);
    expect(mio.datos.platos[0].disponible).toBe(false);
  });

  it('nadie toca el menú de otro restaurante', async () => {
    const m = mundo();
    const uno = await m.cuenta('restaurante');
    const otro = await m.cuenta('restaurante');
    await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, uno.token);
    await m.llamar(
      'PUT',
      '/datos/mi-restaurante',
      { ...RESTAURANTE_BASE, nombre: 'Otro' },
      otro.token,
    );
    const p = await m.llamar('POST', '/datos/mi-restaurante/platos', PLATO, uno.token);
    const cambio = await m.llamar(
      'PUT',
      `/datos/mi-restaurante/platos/${p.datos.plato.id}`,
      { ...PLATO, precioCentavos: 1 },
      otro.token,
    );
    expect(cambio.estado).toBe(404);
    const borrar = await m.llamar(
      'DELETE',
      `/datos/mi-restaurante/platos/${p.datos.plato.id}`,
      undefined,
      otro.token,
    );
    expect(borrar.estado).toBe(404);
  });

  it('solo el admin aprueba; un cliente no puede', async () => {
    const m = mundo();
    const dueno = await m.cuenta('restaurante');
    const cliente = await m.cuenta('cliente');
    const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const intento = await m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${r.datos.restaurante.id}`,
      { estado: 'aprobado' },
      cliente.token,
    );
    expect(intento.estado).toBe(403);
    const lista = await m.llamar('GET', '/datos/admin/restaurantes', undefined, dueno.token);
    expect(lista.estado).toBe(403);
  });

  it('valida los precios y los nombres', async () => {
    const m = mundo();
    const dueno = await m.cuenta('restaurante');
    await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const decimal = await m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { ...PLATO, precioCentavos: 12.5 },
      dueno.token,
    );
    expect(decimal.estado).toBe(400);
    const sinNombre = await m.llamar(
      'PUT',
      '/datos/mi-restaurante',
      { ...RESTAURANTE_BASE, nombre: '' },
      dueno.token,
    );
    expect(sinNombre.datos.campo).toBe('nombre');
  });

  it('pausar un restaurante lo cierra y lo saca del público', async () => {
    const m = mundo();
    const dueno = await m.cuenta('restaurante');
    const admin = await m.cuenta('admin');
    const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    await m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${r.datos.restaurante.id}`,
      { estado: 'aprobado' },
      admin.token,
    );
    await m.llamar('PATCH', '/datos/mi-restaurante/abierto', { abierto: true }, dueno.token);
    const p = await m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${r.datos.restaurante.id}`,
      { estado: 'pausado' },
      admin.token,
    );
    expect(p.datos.restaurante.abierto).toBe(false);
    const det = await m.llamar('GET', `/datos/restaurantes/${r.datos.restaurante.id}`);
    expect(det.estado).toBe(404);
  });
});
