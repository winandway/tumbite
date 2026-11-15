import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, llevarA, mundo } from '../pruebas/ayuda';
import { crearAlmacenPruebas } from '../pruebas/r2';

/**
 * C-FOTO-PUERTA (15 nov 2026) — todos los países. Fotos del frente y de la puerta fijadas a la
 * dirección guardada. Privadas; las ve el repartidor asignado y solo mientras el pedido va «en
 * camino»; mirar no escribe; una fila por foto. Ejemplos en Novi, Michigan.
 */
const CASA = '100 Calle de Ejemplo, Novi, MI';

afterEach(() => vi.unstubAllGlobals());

async function escenario() {
  vi.stubGlobal(
    'fetch',
    async () =>
      new Response(JSON.stringify({ id: 'cs_1', client_secret: 'cs_1_secret_x' }), { status: 200 }),
  );
  const almacen = crearAlmacenPruebas();
  const m = mundo({ BUCKET: almacen.bucket, STRIPE_SECRET_KEY: 'sk_test_x' });
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin');
  const cliente = await m.cuenta('cliente', 'Ana Cliente');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const restId = r.datos.restaurante.id as string;
  await m.llamar(
    'PATCH',
    `/datos/admin/restaurantes/${restId}`,
    { estado: 'aprobado' },
    admin.token,
  );
  const plato = await m.llamar(
    'POST',
    '/datos/mi-restaurante/platos',
    { nombreEs: 'Cubano', precioCentavos: 1500 },
    dueno.token,
  );
  await m.abrir(dueno.token);
  const guardar = (extra: Record<string, unknown> = {}, token = cliente.token) =>
    m.llamar(
      'POST',
      '/datos/mis-direcciones',
      { etiqueta: 'Casa', direccion: CASA, lat: 25.78, lng: -80.2, ...extra },
      token,
    );
  const pedir = (extra: Record<string, unknown> = {}) =>
    m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: restId,
        lineas: [{ platoId: plato.datos.plato.id, cantidad: 2 }],
        propinaCentavos: 400,
        direccion: CASA,
        lat: 25.78,
        lng: -80.2,
        ...extra,
      },
      cliente.token,
    );
  async function repartidor(nombre: string) {
    const d = await m.cuenta('repartidor', nombre);
    await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 25.771, lng: -80.191 },
      d.token,
    );
    return d;
  }
  /** El pedido asignado a un repartidor y llevado a «en camino». */
  async function enCamino(pedidoId: string, rep: { id: string }) {
    await m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1', repartidor_id = ? WHERE id = ?",
    )
      .bind(rep.id, pedidoId)
      .run();
    await llevarA(m.DB, pedidoId, 'en_camino');
  }
  const ver = (ruta: string, token: string) => m.llamar('GET', ruta, undefined, token);
  return { m, almacen, admin, cliente, restId, guardar, pedir, repartidor, enCamino, ver };
}

describe('foto de la puerta: el cliente', () => {
  it('sube, cambia y borra; casa lleva dos fotos y edificio tres; todo privado', async () => {
    const { m, almacen, cliente, guardar, ver } = await escenario();
    const d = (await guardar()).datos.direccion;
    expect(d).toMatchObject({ tipoLugar: '', fotos: [] });
    const ruta = `/datos/mis-direcciones/${d.id}/fotos`;
    const subida = await m.foto(`${ruta}/1`, cliente.token);
    expect(subida.estado).toBe(201);
    // La app (api.subirFoto) exige una dirección en la respuesta: la ruta privada de la foto.
    expect(subida.datos.url).toBe(`${ruta}/1`);
    const chica = await m.foto(`${ruta}/1?tam=mini`, cliente.token);
    expect(chica.estado).toBe(201);
    expect(chica.datos.url).toBe(`${ruta}/1`);
    // Sin apartamento es casa: no hay tercera foto.
    expect((await m.foto(`${ruta}/3`, cliente.token)).estado).toBe(422);
    // La miniatura sin su foto no entra.
    expect((await m.foto(`${ruta}/2?tam=mini`, cliente.token)).estado).toBe(409);
    const claves = () => [...almacen.datos.keys()];
    expect(claves()).toHaveLength(2);
    // Privadas: en puertas/<usuario>/…, nunca en la carpeta pública, y sin caché compartida.
    for (const k of claves()) {
      expect(k.startsWith(`puertas/${cliente.id}/${d.id}/`)).toBe(true);
      expect(k).not.toContain('fotos/');
      expect(almacen.datos.get(k)?.cache).toBe('private, no-store');
    }
    // Cambiarla borra de verdad la anterior (la grande y su miniatura).
    const antes = claves();
    expect((await m.foto(`${ruta}/1`, cliente.token)).estado).toBe(201);
    expect(claves()).toHaveLength(1);
    expect(antes).not.toContain(claves()[0]);
    // Al decir «edificio» se abre la tercera.
    const cambio = await m.llamar(
      'PATCH',
      `/datos/mis-direcciones/${d.id}`,
      { tipoLugar: 'edificio' },
      cliente.token,
    );
    expect(cambio.datos).toMatchObject({ tipoLugar: 'edificio', fotos: [1] });
    expect((await m.foto(`${ruta}/3`, cliente.token)).estado).toBe(201);
    const lista = await ver('/datos/mis-direcciones', cliente.token);
    expect(lista.datos.direcciones[0]).toMatchObject({ tipoLugar: 'edificio', fotos: [1, 3] });
    // De edificio a casa, las de adentro se quitan y la del frente se queda.
    await m.llamar('PATCH', `/datos/mis-direcciones/${d.id}`, { tipoLugar: 'casa' }, cliente.token);
    expect(claves()).toHaveLength(1);
    // Borrar una foto y borrar la dirección no dejan archivos.
    expect((await m.llamar('DELETE', `${ruta}/1`, undefined, cliente.token)).estado).toBe(200);
    expect(claves()).toHaveLength(0);
    await m.foto(`${ruta}/1`, cliente.token);
    await m.llamar('DELETE', `/datos/mis-direcciones/${d.id}`, undefined, cliente.token);
    expect(claves()).toHaveLength(0);
    const filas = await m.DB.prepare('SELECT COUNT(*) AS n FROM direcciones_fotos').first<{
      n: number;
    }>();
    expect(Number(filas?.n)).toBe(0);
  });

  it('con apartamento es edificio sin preguntar; otra persona no ve ni toca la foto', async () => {
    const { m, cliente, guardar } = await escenario();
    const d = (await guardar({ apto: 'Apto 4B' })).datos.direccion;
    const ruta = `/datos/mis-direcciones/${d.id}/fotos`;
    expect((await m.foto(`${ruta}/3`, cliente.token)).estado).toBe(201);
    const otro = await m.cuenta('cliente');
    expect((await m.llamar('GET', `${ruta}/3`, undefined, otro.token)).estado).toBe(404);
    expect((await m.foto(`${ruta}/1`, otro.token)).estado).toBe(404);
    expect((await m.llamar('DELETE', `${ruta}/3`, undefined, otro.token)).estado).toBe(404);
    expect((await m.llamar('GET', `${ruta}/3`)).estado).toBe(401);
    const mia = await m.llamar('GET', `${ruta}/3`, undefined, cliente.token);
    expect(mia.estado).toBe(200);
    expect(mia.res.headers.get('cache-control')).toBe('private, no-store');
  });
});

describe('foto de la puerta: el repartidor', () => {
  it('solo el asignado y solo en camino; al entregar deja de verla', async () => {
    const { m, cliente, guardar, pedir, repartidor, ver } = await escenario();
    const d = (await guardar({ apto: 'Apto 4B' })).datos.direccion;
    await m.foto(`/datos/mis-direcciones/${d.id}/fotos/1`, cliente.token);
    await m.foto(`/datos/mis-direcciones/${d.id}/fotos/3`, cliente.token);
    const p = await pedir({ apto: 'Apto 4B' });
    expect(p.estado).toBeLessThan(300);
    const id = p.datos.pedidoId as string;
    const fila = await m.DB.prepare('SELECT direccion_id FROM pedidos WHERE id = ?')
      .bind(id)
      .first<{ direccion_id: string }>();
    expect(fila?.direccion_id).toBe(d.id);
    const rep = await repartidor('Rita Reparto');
    const otro = await repartidor('Otto Otro');
    const lista = `/datos/repartidor/pedidos/${id}/puerta`;
    // Asignado pero todavía sin recoger: nada.
    await m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1', repartidor_id = ? WHERE id = ?",
    )
      .bind(rep.id, id)
      .run();
    await llevarA(m.DB, id, 'listo');
    expect((await ver(lista, rep.token)).datos.fotos).toEqual([]);
    expect((await ver(`${lista}/1`, rep.token)).estado).toBe(404);
    await llevarA(m.DB, id, 'en_camino');
    const enRuta = await ver(lista, rep.token);
    expect(enRuta.datos.fotos).toEqual([
      { orden: 1, rol: 'entrada' },
      { orden: 3, rol: 'apto' },
    ]);
    const foto = await ver(`${lista}/1?tam=mini`, rep.token);
    expect(foto.estado).toBe(200);
    expect(foto.res.headers.get('cache-control')).toBe('private, no-store');
    // Otro repartidor, el cliente por esta ruta, y nadie sin sesión: no.
    expect((await ver(lista, otro.token)).estado).toBe(404);
    expect((await ver(`${lista}/1`, otro.token)).estado).toBe(404);
    expect((await ver(lista, cliente.token)).estado).toBe(403);
    expect((await m.llamar('GET', `${lista}/1`)).estado).toBe(401);
    // Entregado: se acabó.
    await llevarA(m.DB, id, 'entregado');
    expect((await ver(lista, rep.token)).datos.fotos).toEqual([]);
    expect((await ver(`${lista}/1`, rep.token)).estado).toBe(404);
  });

  it('un regalo y un pedido a una dirección sin guardar no se enlazan con ninguna foto', async () => {
    const { m, cliente, guardar, pedir } = await escenario();
    const d = (await guardar()).datos.direccion;
    await m.foto(`/datos/mis-direcciones/${d.id}/fotos/1`, cliente.token);
    const regalo = await pedir({
      paraOtro: { nombre: 'Persona Regalo', telefono: '+12485550100', mensaje: '' },
    });
    const otra = await pedir({ direccion: '300 Otra Calle, Novi, MI' });
    for (const p of [regalo, otra]) {
      expect(p.estado).toBeLessThan(300);
      const f = await m.DB.prepare('SELECT direccion_id FROM pedidos WHERE id = ?')
        .bind(p.datos.pedidoId)
        .first<{ direccion_id: string | null }>();
      expect(f?.direccion_id).toBeNull();
    }
  });
});

describe('foto de la puerta: presupuesto de escrituras e interruptor por zona', () => {
  it('tres fotos escriben tres filas; mirar (cliente o repartidor) no escribe nada', async () => {
    const { m, cliente, guardar, pedir, repartidor, enCamino, ver } = await escenario();
    const d = (await guardar({ apto: 'Torre 2' })).datos.direccion;
    const id = (await pedir({ apto: 'Torre 2' })).datos.pedidoId as string;
    const rep = await repartidor('Rita Reparto');
    await enCamino(id, rep);
    const escritas: string[] = [];
    const preparar = m.DB.prepare.bind(m.DB);
    m.DB.prepare = (sql: string) => {
      if (
        /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(sql) &&
        !/sesiones|limites|intentos/i.test(sql)
      )
        escritas.push(sql);
      return preparar(sql);
    };
    for (const n of [1, 2, 3]) {
      await m.foto(`/datos/mis-direcciones/${d.id}/fotos/${n}`, cliente.token);
      await m.foto(`/datos/mis-direcciones/${d.id}/fotos/${n}?tam=mini`, cliente.token);
    }
    expect(escritas).toHaveLength(3);
    expect(escritas.every((s) => s.includes('direcciones_fotos'))).toBe(true);
    escritas.length = 0;
    await ver('/datos/mis-direcciones', cliente.token);
    await ver(`/datos/mis-direcciones/${d.id}/fotos/1?tam=mini`, cliente.token);
    await ver(`/datos/repartidor/pedidos/${id}/puerta`, rep.token);
    for (const n of [1, 2, 3]) await ver(`/datos/repartidor/pedidos/${id}/puerta/${n}`, rep.token);
    expect(escritas).toEqual([]);
    m.DB.prepare = preparar;
    const filas = await m.DB.prepare('SELECT COUNT(*) AS n FROM direcciones_fotos').first<{
      n: number;
    }>();
    expect(Number(filas?.n)).toBe(3);
  });

  it('el interruptor nace apagado; encendido, sin la primera foto no se puede pedir', async () => {
    const { m, admin, cliente, restId, guardar, pedir } = await escenario();
    const zona = await m.DB.prepare(
      'SELECT z.id, z.foto_puerta_obligatoria AS o FROM restaurantes r JOIN zonas z ON z.id = r.zona_id WHERE r.id = ?',
    )
      .bind(restId)
      .first<{ id: string; o: number }>();
    expect(zona?.o).toBe(0);
    expect((await pedir()).estado).toBeLessThan(300);
    const cambiar = (encendido: boolean, token = admin.token) =>
      m.llamar(
        'PATCH',
        `/datos/admin/zonas/${zona!.id}`,
        { fotoPuertaObligatoria: encendido },
        token,
      );
    expect((await cambiar(true, cliente.token)).estado).toBe(403);
    expect((await cambiar(true)).estado).toBe(200);
    const zonas = await m.llamar('GET', '/datos/admin/zonas', undefined, admin.token);
    expect(
      zonas.datos.zonas.find((z: { id: string }) => z.id === zona!.id).fotoPuertaObligatoria,
    ).toBe(true);
    // El interruptor de la foto no apaga ni enciende la zona.
    const sigue = await m.DB.prepare('SELECT activa FROM zonas WHERE id = ?')
      .bind(zona!.id)
      .first<{ activa: number }>();
    expect(sigue?.activa).toBe(1);
    const sinFoto = await pedir();
    expect(sinFoto.estado).toBe(422);
    expect(sinFoto.datos.campo).toBe('fotoPuerta');
    const d = (await guardar()).datos.direccion;
    await m.foto(`/datos/mis-direcciones/${d.id}/fotos/1`, cliente.token);
    expect((await pedir()).estado).toBeLessThan(300);
    // Recoger en el local y un regalo no la piden.
    await m.llamar('DELETE', `/datos/mis-direcciones/${d.id}/fotos/1`, undefined, cliente.token);
    expect((await pedir({ entrega: 'recoger' })).estado).not.toBe(422);
  });
});

describe('foto de la puerta: candados del código', () => {
  const leer = (f: string) => readFileSync(join(__dirname, f), 'utf8');
  it('nunca usa la carpeta pública ni deja caché compartida', () => {
    // Sin los comentarios: lo que cuenta es el código.
    const codigo = leer('fotoPuerta.ts')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(codigo).not.toMatch(/['"`]\/?media\//);
    // Toda clave nueva del almacén nace bajo puertas/.
    const claves = [...codigo.matchAll(/const clave = `([^`]*)`/g)].map((m) => m[1]);
    expect(claves.length).toBeGreaterThan(0);
    expect(claves.every((k) => k?.startsWith('puertas/'))).toBe(true);
    expect(codigo).toMatch(/puertas\/\$\{u\.id\}/);
    expect(codigo).not.toMatch(/cacheControl: 'public/);
    // El repartidor solo las ve «en camino».
    expect(codigo).toMatch(/p\.estado === 'en_camino'/);
  });
  it('lo público (/media) no sirve nada del prefijo privado', () => {
    expect(leer('fotos.ts')).not.toMatch(/puertas\//);
  });
});
