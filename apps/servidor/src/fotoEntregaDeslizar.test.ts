import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FOTO_PRUEBA, RESTAURANTE_BASE, mundo } from './pruebas/ayuda';

/**
 * C-FOTO-ENTREGA-IPHONE y C-DESLIZAR-ENTREGA (15 nov 2026, primera prueba real de Richard en Novi,
 * Michigan, con Divoox Driver en un iPhone): en la puerta del cliente tomó la foto y el pedido no
 * se cerró. Arriba salió «No pudimos leer los datos enviados.» y en el chat «No se pudo subir la
 * foto.» aunque la foto sí estaba. Dos causas:
 *
 *  1. En el iPhone la foto sale de la cámara SIN tipo (Blob.type vacío) y la app la mandaba como
 *     «application/octet-stream». El servidor decidía «es foto» solo si el tipo empezaba por
 *     «image/»; si no, intentaba leerla como JSON y fallaba. Ahora la foto se reconoce por sus
 *     bytes (como ya hacía la foto de la recogida) y la app manda «image/jpeg» si falta el tipo.
 *  2. La app exigía que el servidor devolviera la dirección de la foto («url»); el chat, la
 *     verificación de identidad, las quejas y los paquetes respondían solo «ok». La foto subía y la
 *     app decía que no. Ahora basta con que el servidor diga que sí, y esas rutas también dan url.
 *
 * Y el cierre como DoorDash Dasher y Uber Driver: la foto se sube por su propio camino y queda
 * como evidencia (sin cerrar el pedido); después, en la puerta, «Desliza para completar la
 * entrega». Todos los países.
 */
afterEach(() => vi.unstubAllGlobals());

const raiz = join(__dirname, '..', '..', '..');
const CASA = { lat: 25.78, lng: -80.2 };

async function enCamino(host?: string) {
  vi.stubGlobal(
    'fetch',
    async () => new Response(JSON.stringify({ id: 'pi_x', client_secret: 'x' }), { status: 200 }),
  );
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' }, host ? { host } : {});
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin');
  const cliente = await m.cuenta('cliente', 'Ana Cliente');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const rid = r.datos.restaurante.id as string;
  await m.llamar('PATCH', `/datos/admin/restaurantes/${rid}`, { estado: 'aprobado' }, admin.token);
  const plato = await m.llamar(
    'POST',
    '/datos/mi-restaurante/platos',
    { nombreEs: 'Pizza', precioCentavos: 1500 },
    dueno.token,
  );
  await m.abrir(dueno.token);
  const rep = await m.cuenta('repartidor', 'Rita Reparto');
  await m.llamar(
    'POST',
    '/datos/repartidor/conectar',
    { conectado: true, lat: 25.771, lng: -80.191 },
    rep.token,
  );
  const p = await m.llamar(
    'POST',
    '/datos/pedidos',
    {
      restauranteId: rid,
      lineas: [{ platoId: plato.datos.plato.id, cantidad: 1 }],
      propinaCentavos: 300,
      direccion: '30080 Calle de Prueba',
      lat: CASA.lat,
      lng: CASA.lng,
    },
    cliente.token,
  );
  const id = p.datos.pedidoId as string;
  await m.DB.prepare(
    "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1' WHERE id = ?",
  )
    .bind(id)
    .run();
  await m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }, dueno.token);
  await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
  await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
  await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token);
  const rec = await m.recoger(id, rep.token, dueno.token);
  expect(rec.estado, JSON.stringify(rec.datos)).toBe(200);
  // En la puerta: dos lecturas precisas del GPS (la llegada confiable).
  await m.envejecerGps(id);
  await m.ubicar(rep.token, CASA);
  await m.ubicar(rep.token, CASA);
  return { m, id, rep, cliente };
}

/** La foto tal como la manda un iPhone: bytes de imagen y SIN tipo de imagen. */
const fotoIphone = (m: ReturnType<typeof mundo>, ruta: string, token: string) =>
  m.crudo(`${ruta}${ruta.includes('?') ? '&' : '?'}lat=${CASA.lat}&lng=${CASA.lng}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/octet-stream',
    },
    body: FOTO_PRUEBA as BodyInit,
  });

const estadoPedido = async (m: ReturnType<typeof mundo>, id: string) =>
  (await m.DB.prepare('SELECT estado FROM pedidos WHERE id = ?').bind(id).first<{
    estado: string;
  }>())!.estado;

describe('la foto de la entrega desde un iPhone (C-FOTO-ENTREGA-IPHONE)', () => {
  it('la versión 17 (foto directo a «entregado», sin tipo) ya entrega en vez de «No pudimos leer…»', async () => {
    const { m, id, rep } = await enCamino();
    const res = await fotoIphone(m, `/datos/repartidor/pedidos/${id}/entregado`, rep.token);
    const datos = (await res.json()) as { error?: string };
    expect(datos.error ?? '').not.toContain('No pudimos leer');
    expect(res.status).toBe(200);
    expect(await estadoPedido(m, id)).toBe('entregado');
  });

  it('la foto del chat responde con su dirección (la app vieja ya no dice «No se pudo subir»)', async () => {
    const { m, id, rep } = await enCamino();
    const res = await fotoIphone(m, `/datos/pedidos/${id}/mensajes/foto`, rep.token);
    expect(res.status).toBe(201);
    const datos = (await res.json()) as { url?: string };
    expect(datos.url?.startsWith(`/datos/pedidos/${id}/mensajes/`)).toBe(true);
    expect(datos.url).toMatch(/\/mensajes\/\d+\/foto$/);
  });
});

describe('C-DESLIZAR-SIEMPRE · en el sitio de pruebas la foto sola nunca cierra la entrega', () => {
  // 16 nov 2026, pedido 407F de Richard en el sitio de pruebas: con una app de pruebas vieja (la
  // compilación 17 hecha desde un código anterior al deslizador) la foto de la puerta cerró el pedido
  // sola y nunca salió «Desliza para completar». En el sitio de pruebas el camino viejo ya no cierra:
  // guarda la foto como evidencia y pide instalar la app nueva. En producción sigue aceptado hasta
  // que todas las versiones de tienda traigan el deslizador.
  it('la foto directo a «entregado» no cierra el pedido y dice que hay que instalar la app nueva', async () => {
    const { m, id, rep } = await enCamino('staging.tumbite.com');
    const res = await fotoIphone(m, `/datos/repartidor/pedidos/${id}/entregado`, rep.token);
    expect(res.status).toBe(409);
    const datos = (await res.json()) as { error?: string };
    expect(datos.error ?? '').toMatch(/app de pruebas|test app/i);
    expect(await estadoPedido(m, id)).toBe('en_camino');
    // La foto no se pierde: queda como la de la puerta, y con la app nueva se cierra deslizando.
    const cierre = await m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/entregado`,
      { ...CASA, modo: 'puerta' },
      rep.token,
    );
    expect(cierre.estado, JSON.stringify(cierre.datos)).toBe(200);
    expect(await estadoPedido(m, id)).toBe('entregado');
  });
});

describe('foto aparte y deslizar para completar (C-DESLIZAR-ENTREGA)', () => {
  it('la foto queda como evidencia sin cerrar el pedido; el cliente no la ve hasta el cierre', async () => {
    const { m, id, rep, cliente } = await enCamino();
    const res = await fotoIphone(m, `/datos/repartidor/pedidos/${id}/foto-entrega`, rep.token);
    expect(res.status).toBe(200);
    const datos = (await res.json()) as { url?: string };
    expect(datos.url).toBe(`/datos/pedidos/${id}/evidencia/entrega`);
    expect(await estadoPedido(m, id)).toBe('en_camino');
    const yo = await m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token);
    expect(yo.datos.activo).toMatchObject({ id, fotoEntregaLista: true });
    const suyo = await m.llamar('GET', `/datos/pedidos/${id}`, undefined, cliente.token);
    expect(suyo.datos.pedido.fotoEntrega).toBeNull();
  });

  it('deslizar en la puerta cierra el pedido con la foto ya subida', async () => {
    const { m, id, rep, cliente } = await enCamino();
    await fotoIphone(m, `/datos/repartidor/pedidos/${id}/foto-entrega`, rep.token);
    const fin = await m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/entregado`,
      { ...CASA, modo: 'puerta' },
      rep.token,
    );
    expect(fin.estado).toBe(200);
    expect(await estadoPedido(m, id)).toBe('entregado');
    const ev = await m.DB.prepare(
      "SELECT clave, modo, confirmada_en FROM evidencias WHERE pedido_id = ? AND tipo = 'entrega'",
    )
      .bind(id)
      .first<{ clave: string; modo: string; confirmada_en: string | null }>();
    expect(ev?.clave).toMatch(/^evidencias\//);
    expect(ev?.modo).toBe('puerta');
    expect(ev?.confirmada_en).not.toBeNull();
    const suyo = await m.llamar('GET', `/datos/pedidos/${id}`, undefined, cliente.token);
    expect(suyo.datos.pedido.fotoEntrega).not.toBeNull();
  });

  it('deslizar sin foto no cierra: primero la foto', async () => {
    const { m, id, rep } = await enCamino();
    const fin = await m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/entregado`,
      { ...CASA, modo: 'puerta' },
      rep.token,
    );
    expect(fin.estado).toBe(409);
    expect(String(fin.datos.error)).toMatch(/foto|photo/i);
    expect(await estadoPedido(m, id)).toBe('en_camino');
  });

  it('deslizar lejos de la puerta no cierra', async () => {
    const { m, id, rep } = await enCamino();
    await fotoIphone(m, `/datos/repartidor/pedidos/${id}/foto-entrega`, rep.token);
    const fin = await m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/entregado`,
      { lat: CASA.lat + 0.05, lng: CASA.lng, modo: 'puerta' },
      rep.token,
    );
    expect(fin.estado).toBe(409);
    expect(await estadoPedido(m, id)).toBe('en_camino');
  });
});

describe('las apps: subir fotos sin falsos errores y el deslizador (fuente)', () => {
  const api = readFileSync(join(raiz, 'packages/compartido/src/api.ts'), 'utf8');
  const inicio = readFileSync(join(raiz, 'apps/repartidor/src/Inicio.tsx'), 'utf8');
  // Desde C-SERVICIOS-CONECTADOS el gesto y la acción del lector viven en la pieza común
  // `Deslizador`; el cierre de la entrega la usa con sus textos.
  const deslizar = () => {
    try {
      return [
        'apps/repartidor/src/piezas/DeslizarParaCompletar.tsx',
        'packages/movil/src/Deslizador.tsx',
      ]
        .map((f) => readFileSync(join(raiz, f), 'utf8'))
        .join('\n');
    } catch {
      return '';
    }
  };

  it('una foto sin tipo viaja como «image/jpeg» y un «sí» sin url ya no es un error', () => {
    expect(api).toContain("foto.type || 'image/jpeg'");
    expect(api).not.toContain('!res.ok || !datos?.url');
  });

  it('la foto de la puerta va a «foto-entrega» y el cierre es el deslizador', () => {
    expect(inicio).toContain('/foto-entrega`');
    expect(inicio).toContain('<DeslizarParaCompletar');
    expect(inicio).toContain("modo: 'puerta'");
  });

  it('«Modo destino» no aparece con un pedido en curso', () => {
    expect(inicio).toMatch(
      /!estado\?\.activo[^\n]*\?\s*<ModoDestino|!estado\?\.activo && \(?\s*<ModoDestino/,
    );
  });

  it('el deslizador está en español e inglés y se puede usar con lector de pantalla', () => {
    expect(deslizar()).toContain('Desliza para completar');
    expect(deslizar()).toContain('Slide to complete delivery');
    expect(deslizar()).toContain("accessibilityActions={[{ name: 'activate'");
    expect(deslizar()).toContain('<Deslizador');
  });
});
