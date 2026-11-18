import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from '../pruebas/ayuda';

/**
 * C-LUGARES-GUARDADOS, C-DESTINO-RECIENTES y C-DESTINO-POPULARES (17 nov 2026) — todos los países.
 * Reglas de Richard: docs/disenos/borrador-inicio/LUGARES-GUARDADOS.md y BUSQUEDA-DESTINO.md.
 */
const MIAMI = { lat: 25.7617, lng: -80.1918 };

async function viaje(
  m: ReturnType<typeof mundo>,
  clienteId: string,
  n: string,
  destino: { lat: number; lng: number; direccion: string },
  creado = '2026-11-10 12:00:00',
) {
  await m.DB.prepare(
    "INSERT INTO operaciones (id, servicio_id, tipo_operacion, cliente_id, zona_id, estado_general, creado_en) VALUES (?, 'moto', 'viaje_pasajero', ?, 'US-FL-MIAMI', 'terminada', ?)",
  )
    .bind(n, clienteId, creado)
    .run();
  await m.DB.prepare(
    `INSERT INTO viajes (operacion_id, estado, ultimo_actor, ultima_clave, origen_lat, origen_lng, origen_direccion,
       destino_lat, destino_lng, destino_direccion, pin_recogida)
     VALUES (?, 'terminado', 'sistema', ?, 25.76, -80.19, 'Origen', ?, ?, ?, '4321')`,
  )
    .bind(n, `alta:${n}`, destino.lat, destino.lng, destino.direccion)
    .run();
}

describe('lugares guardados con nombre e ícono (C-LUGARES-GUARDADOS)', () => {
  it('guarda el ícono, edita por id sin duplicar y nadie edita un lugar ajeno', async () => {
    const m = mundo();
    const cli = await m.cuenta('cliente');
    const nuevo = await m.llamar(
      'POST',
      '/datos/mis-direcciones',
      {
        etiqueta: 'Gimnasio',
        icono: 'gimnasio',
        direccion: 'Av. Los Próceres 10',
        lat: 25.7,
        lng: -80.2,
      },
      cli.token,
    );
    expect(nuevo.estado).toBe(201);
    expect(nuevo.datos.direccion).toMatchObject({ etiqueta: 'Gimnasio', icono: 'gimnasio' });
    const id = nuevo.datos.direccion.id as string;

    const editado = await m.llamar(
      'PUT',
      `/datos/mis-direcciones/${id}`,
      {
        etiqueta: 'Gym',
        icono: 'estrella',
        direccion: 'Av. Los Próceres 12',
        lat: 25.71,
        lng: -80.21,
        referencia: 'Portón negro',
      },
      cli.token,
    );
    expect(editado.estado).toBe(200);
    expect(editado.datos.direccion).toMatchObject({
      id,
      etiqueta: 'Gym',
      icono: 'estrella',
      referencia: 'Portón negro',
    });

    // El ícono que no es de la lista no se guarda.
    const malo = await m.llamar(
      'PUT',
      `/datos/mis-direcciones/${id}`,
      {
        etiqueta: 'Gym',
        icono: 'cohete',
        direccion: 'Av. Los Próceres 12',
        lat: 25.71,
        lng: -80.21,
      },
      cli.token,
    );
    expect(malo.estado).toBe(400);
    // Nadie edita un lugar ajeno.
    const otro = await m.cuenta('cliente');
    const ajeno = await m.llamar(
      'PUT',
      `/datos/mis-direcciones/${id}`,
      { etiqueta: 'Mío', direccion: 'Calle 1 de ejemplo', lat: 25.7, lng: -80.2 },
      otro.token,
    );
    expect(ajeno.estado).toBe(404);
  });
});

describe('Recientes y Populares de «¿A dónde vas?»', () => {
  it('recientes: solo los destinos propios, con su fecha, sin datos de nadie más', async () => {
    const m = mundo();
    const yo = await m.cuenta('cliente');
    const otro = await m.cuenta('cliente');
    await viaje(m, yo.id, 'v1', { lat: 25.77, lng: -80.19, direccion: 'Torre Norte, Calle 3' });
    await viaje(m, otro.id, 'v2', { lat: 25.79, lng: -80.2, direccion: 'Casa de otra persona' });
    const r = await m.llamar('GET', '/datos/lugares/recientes', undefined, yo.token);
    expect(r.estado).toBe(200);
    expect(r.datos.destinos).toEqual([
      { direccion: 'Torre Norte, Calle 3', lat: 25.77, lng: -80.19, en: '2026-11-10T12:00:00Z' },
    ]);
    expect((await m.llamar('GET', '/datos/lugares/recientes')).estado).toBe(401);
  });

  it('populares: solo lugares pedidos por diez clientes distintos o más, redondeados, nunca una casa', async () => {
    const m = mundo();
    const hace = new Date(Date.now() - 5 * 86_400_000).toISOString().replace('T', ' ').slice(0, 19);
    const clientes = [];
    for (let i = 0; i < 10; i++) clientes.push(await m.cuenta('cliente', `Cliente ${i}`));
    // La terminal: diez personas distintas (cada una con el pin un poco movido).
    for (const [i, c] of clientes.entries())
      await viaje(
        m,
        c.id,
        `t${i}`,
        {
          lat: 25.7801 + i * 0.00002,
          lng: -80.2101,
          direccion: 'Terminal de pasajeros, Av. Bolívar',
        },
        hace,
      );
    // Una casa: una sola persona, muchas veces. Nunca sale.
    for (let i = 0; i < 9; i++)
      await viaje(
        m,
        clientes[0]!.id,
        `c${i}`,
        { lat: 25.79, lng: -80.25, direccion: 'Casa de alguien, Calle 9' },
        hace,
      );
    const r = await m.llamar('GET', `/datos/lugares/populares?lat=${MIAMI.lat}&lng=${MIAMI.lng}`);
    expect(r.estado).toBe(200);
    expect(r.datos.origen).toBe('ciudad');
    expect(r.datos.lugares).toHaveLength(1);
    expect(r.datos.lugares[0]).toMatchObject({
      titulo: 'Terminal de pasajeros',
      detalle: 'Av. Bolívar',
    });
    // Redondeado a unos 100 m: nunca el punto exacto de una persona.
    expect(String(r.datos.lugares[0].lat).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(3);
    // Se calcula una vez al día por ciudad y se guarda: la segunda visita no escribe.
    const filas = async () =>
      Number(
        (
          await m.DB.prepare(
            "SELECT COUNT(*) AS n FROM config WHERE clave LIKE 'populares:%'",
          ).first<{ n: number }>()
        )?.n,
      );
    expect(await filas()).toBe(1);
    await m.llamar('GET', `/datos/lugares/populares?lat=${MIAMI.lat}&lng=${MIAMI.lng}`);
    expect(await filas()).toBe(1);
  });

  // Revisión de calidad del 18 nov: con pocos clientes en una celda de 100 m (un edificio), la calle
  // exacta de un viaje es la dirección de personas. Mínimo diez clientes y nunca el número de la casa.
  it('populares: con nueve clientes no sale; con diez, la calle sale sin el número de la casa', async () => {
    const m = mundo();
    const hace = new Date(Date.now() - 5 * 86_400_000).toISOString().replace('T', ' ').slice(0, 19);
    const clientes = [];
    for (let i = 0; i < 10; i++) clientes.push(await m.cuenta('cliente', `Vecino ${i}`));
    for (const [i, c] of clientes.slice(0, 9).entries())
      await viaje(
        m,
        c.id,
        `e${i}`,
        { lat: 25.7811, lng: -80.2111, direccion: '43381 Grand River Ave, Novi, MI' },
        hace,
      );
    const nueve = await m.llamar(
      'GET',
      `/datos/lugares/populares?lat=${MIAMI.lat}&lng=${MIAMI.lng}`,
    );
    expect(nueve.datos.lugares).toEqual([]);
    await m.DB.prepare("DELETE FROM config WHERE clave LIKE 'populares:%'").run();
    await viaje(
      m,
      clientes[9]!.id,
      'e9',
      { lat: 25.7811, lng: -80.2111, direccion: '43381 Grand River Ave, Novi, MI' },
      hace,
    );
    const diez = await m.llamar(
      'GET',
      `/datos/lugares/populares?lat=${MIAMI.lat}&lng=${MIAMI.lng}`,
    );
    expect(diez.datos.lugares).toHaveLength(1);
    expect(diez.datos.lugares[0].titulo).toBe('Grand River Ave');
    expect(JSON.stringify(diez.datos)).not.toContain('43381');
  });

  it('sin datos ni buscador, «ninguno» también se guarda una hora (no repite la consulta en cada apertura)', async () => {
    const m = mundo();
    await m.llamar('GET', `/datos/lugares/populares?lat=${MIAMI.lat}&lng=${MIAMI.lng}`);
    const fila = await m.DB.prepare(
      "SELECT valor FROM config WHERE clave LIKE 'populares:%'",
    ).first<{ valor: string }>();
    expect(fila && JSON.parse(fila.valor).origen).toBe('ninguno');
  });

  // C-SIN-PLUS-CODE (18 nov 2026): una lista guardada ANTES del arreglo (con «J86Q+CHP, …») se
  // limpia al leerla; ninguna ciudad muestra códigos de mapa aunque su lista sea vieja.
  it('una lista guardada con códigos de mapa sale limpia al leerla', async () => {
    const m = mundo();
    await m.llamar('GET', `/datos/lugares/populares?lat=${MIAMI.lat}&lng=${MIAMI.lng}`);
    await m.DB.prepare(
      "UPDATE config SET valor = ?, actualizado_en = datetime('now') WHERE clave LIKE 'populares:%'",
    )
      .bind(
        JSON.stringify({
          origen: 'mapa',
          lugares: [
            {
              titulo: 'Junior Mall',
              detalle: 'J86Q+CHP, Avenida Don Pepe Rojas',
              lat: 8.6,
              lng: -71.6,
            },
            { titulo: 'Universidad', detalle: 'J9JJ+FWM, La Blanca', lat: 8.61, lng: -71.61 },
          ],
        }),
      )
      .run();
    const r = await m.llamar('GET', `/datos/lugares/populares?lat=${MIAMI.lat}&lng=${MIAMI.lng}`);
    expect(r.datos.lugares.map((l: { detalle: string }) => l.detalle)).toEqual([
      'Avenida Don Pepe Rojas',
      'La Blanca',
    ]);
  });

  it('ciudad sin datos y sin buscador de mapas: lista vacía, sin error', async () => {
    const m = mundo();
    const r = await m.llamar('GET', `/datos/lugares/populares?lat=${MIAMI.lat}&lng=${MIAMI.lng}`);
    expect(r.estado).toBe(200);
    expect(r.datos.lugares).toEqual([]);
  });

  describe('con el buscador de mapas', () => {
    afterEach(() => vi.unstubAllGlobals());
    it('ciudad nueva: lugares conocidos cercanos del mapa (terminal, hospital…), guardados por un día', async () => {
      const m = mundo({ GOOGLE_PLACES_KEY: 'llave-de-prueba-123' });
      const original = globalThis.fetch;
      let llamadas = 0;
      vi.stubGlobal('fetch', async (url: RequestInfo | URL, init?: RequestInit) => {
        const u = String(url);
        if (!u.includes('googleapis.com')) return original(url, init);
        llamadas++;
        return Response.json({
          places: [
            {
              displayName: { text: 'Terminal de pasajeros' },
              shortFormattedAddress: 'Av. Bolívar',
              location: { latitude: 25.78, longitude: -80.21 },
            },
            {
              displayName: { text: 'Hospital central' },
              shortFormattedAddress: 'Av. Principal',
              location: { latitude: 25.77, longitude: -80.2 },
            },
          ],
        });
      });
      const r = await m.llamar('GET', `/datos/lugares/populares?lat=${MIAMI.lat}&lng=${MIAMI.lng}`);
      expect(r.datos.origen).toBe('mapa');
      expect(r.datos.lugares.map((x: { titulo: string }) => x.titulo)).toEqual([
        'Terminal de pasajeros',
        'Hospital central',
      ]);
      await m.llamar('GET', `/datos/lugares/populares?lat=${MIAMI.lat}&lng=${MIAMI.lng}`);
      expect(llamadas).toBe(1);
    });

    it('resultados: con la ubicación, cada lugar trae su distancia y el nombre aparte de la dirección', async () => {
      const m = mundo({ GOOGLE_PLACES_KEY: 'llave-de-prueba-123' });
      const original = globalThis.fetch;
      let cuerpo: Record<string, unknown> = {};
      vi.stubGlobal('fetch', async (url: RequestInfo | URL, init?: RequestInit) => {
        const u = String(url);
        if (!u.includes('googleapis.com')) return original(url, init);
        cuerpo = JSON.parse(String(init?.body));
        return Response.json({
          suggestions: [
            {
              placePrediction: {
                placeId: 'ChIJ_terminal_1',
                text: { text: 'Terminal de pasajeros, Av. Bolívar' },
                structuredFormat: {
                  mainText: { text: 'Terminal de pasajeros' },
                  secondaryText: { text: 'Av. Bolívar' },
                },
                distanceMeters: 1200,
              },
            },
          ],
        });
      });
      const r = await m.llamar(
        'GET',
        `/datos/lugares/sugerencias?q=Te&lat=${MIAMI.lat}&lng=${MIAMI.lng}&sesion=sesion-prueba-1`,
      );
      expect(r.estado).toBe(200);
      expect(cuerpo.origin).toEqual({ latitude: MIAMI.lat, longitude: MIAMI.lng });
      expect(r.datos.sugerencias[0]).toEqual({
        id: 'ChIJ_terminal_1',
        texto: 'Terminal de pasajeros, Av. Bolívar',
        principal: 'Terminal de pasajeros',
        secundario: 'Av. Bolívar',
        distanciaM: 1200,
      });
    });
  });
});
