import { describe, expect, it } from 'vitest';
import { app } from '../app';
import { mundo } from '../pruebas/ayuda';

/**
 * C-DISPONIBLE-MUNDO (10 nov 2026) — todos los países. La app dice dónde ya funciona Divoox y, a
 * quien todavía no le llega, le ofrece «Avísame cuando llegue»; al restaurante, «Quiero traer
 * Divoox a mi ciudad». El registro nunca se limita por país.
 */
const SANTIAGO = { lat: -33.4489, lng: -70.6693 };

describe('disponibilidad en el mundo', () => {
  it('dice en qué países y ciudades ya funciona, con el nombre del país en los dos idiomas', async () => {
    const m = mundo();
    const r = await m.llamar('GET', '/datos/disponibilidad');
    expect(r.estado).toBe(200);
    expect(r.datos.paises).toEqual([
      {
        codigo: 'US',
        nombre: { es: 'Estados Unidos', en: 'United States' },
        ciudades: ['Miami'],
      },
    ]);
    expect(r.datos.proximas).toEqual([]);
  });

  it('una ciudad apagada no se anuncia como disponible', async () => {
    const m = mundo();
    await m.DB.prepare(
      "INSERT INTO zonas (id, nombre, pais, moneda, lat, lng, radio_km, activa) VALUES ('CL-RM-SANTIAGO','Santiago','CL','CLP',?,?,25,0)",
    )
      .bind(SANTIAGO.lat, SANTIAGO.lng)
      .run();
    const r = await m.llamar('GET', '/datos/disponibilidad');
    expect(r.datos.paises.map((p: { codigo: string }) => p.codigo)).toEqual(['US']);
  });

  it('«Avísame cuando llegue» desde la app: con la sesión basta (sin escudo web) y guarda país y punto', async () => {
    const m = mundo();
    const cliente = await m.cuenta('cliente');
    // El mismo servidor, ahora con el escudo web encendido (como en pruebas y en producción).
    const conEscudo = async (cuerpo: unknown, token?: string) => {
      const res = await app.request(
        '/datos/lista-espera',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'cf-connecting-ip': '10.9.9.9',
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(cuerpo),
        },
        { DB: m.DB, TURNSTILE_SECRET_KEY: 'secreto-de-prueba' },
      );
      return { estado: res.status, datos: (await res.json()) as { zona: unknown } };
    };
    const cuerpo = {
      tipo: 'comensal',
      nombre: 'Camila',
      correo: 'camila@ejemplo.com',
      ciudad: 'Santiago',
      pais: 'cl',
      origen: 'app',
      ...SANTIAGO,
    };
    const suyo = (await m.DB.prepare('SELECT correo FROM usuarios WHERE id = ?')
      .bind(cliente.id)
      .first<{
        correo: string;
      }>())!.correo;
    // Sin sesión y sin pase del escudo: no entra (como siempre en la web).
    expect((await conEscudo(cuerpo)).estado).toBe(403);
    // Con sesión, pero para el correo de OTRA persona: tampoco (no se mandan correos a terceros).
    expect((await conEscudo(cuerpo, cliente.token)).estado).toBe(403);
    cuerpo.correo = suyo;
    const r = await conEscudo(cuerpo, cliente.token);
    expect(r.estado).toBe(201);
    expect(r.datos.zona).toBeNull();
    const fila = await m.DB.prepare(
      'SELECT pais, origen, lat, lng, ciudad FROM lista_espera WHERE correo = ?',
    )
      .bind(suyo)
      .first();
    expect(fila).toEqual({
      pais: 'CL',
      origen: 'app',
      lat: SANTIAGO.lat,
      lng: SANTIAGO.lng,
      ciudad: 'Santiago',
    });
  });

  it('el superadmin ve de qué país y de dónde llegó cada anotación', async () => {
    const m = mundo();
    await m.llamar('POST', '/datos/lista-espera', {
      tipo: 'restaurante',
      nombre: 'Rosa',
      correo: 'rosa@ejemplo.com',
      ciudad: 'Santiago',
      negocio: 'Sabor',
      telefono: '+56912345678',
      pais: 'CL',
    });
    const admin = await m.cuenta('admin');
    const lista = await m.llamar('GET', '/datos/admin/lista-espera', undefined, admin.token);
    expect(lista.datos.personas[0]).toMatchObject({ pais: 'CL', origen: 'web' });
    expect(lista.datos.porPais).toEqual({ CL: 1 });
  });

  it('un restaurante de cualquier país se registra, y se le dice si su ciudad todavía no tiene cobertura', async () => {
    const m = mundo();
    const dueno = await m.cuenta('restaurante');
    const datos = {
      nombre: 'Sabor del Sur',
      descripcionEs: '',
      descripcionEn: '',
      categoria: 'Pizza',
      telefono: '+56912345678',
      direccion: 'Av. Providencia 100, Santiago',
      tiempoPrepMin: 20,
      imagen: null,
    };
    const fuera = await m.llamar(
      'PUT',
      '/datos/mi-restaurante',
      { ...datos, ...SANTIAGO },
      dueno.token,
    );
    expect(fuera.datos.error ?? '').toBe('');
    expect(fuera.estado).toBe(201);
    expect(fuera.datos.cobertura).toBe('fuera');
    const dentro = await m.llamar(
      'PUT',
      '/datos/mi-restaurante',
      { ...datos, lat: 25.77, lng: -80.19 },
      dueno.token,
    );
    expect(dentro.estado).toBe(200);
    expect(dentro.datos.cobertura).toBe('dentro');
  });
});
