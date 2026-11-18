import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-SESION-TERMINADA (18 nov 2026, ANR de Driver): al recibir «sesión terminada» la app cierra la
 * sesión UNA vez (sin llamar al servidor con la llave vencida), todas las pantallas con sondeos se
 * desmontan y la pantalla de entrar lo dice. Los sondeos esperan cada vez más si fallan.
 */
const leer = (ruta: string) => readFileSync(join(__dirname, '..', '..', '..', ruta), 'utf8');

describe('la sesión que termina se cierra una vez', () => {
  it('la sesión escucha el 401 de la API y se cierra sola, una vez', () => {
    const s = leer('packages/movil/src/sesion.tsx');
    expect(s).toContain('alSesionTerminada');
    expect(s).toContain('llaveVencida === token');
    expect(s).toContain('sesionTerminada');
  });
  it('la pantalla de entrar dice que la sesión terminó', () => {
    expect(leer('packages/movil/src/Acceso.tsx')).toContain('sesionTerminada');
  });
  it('el sondeo de la app espera cada vez más cuando falla y se corta al desmontar', () => {
    // El comportamiento se prueba con relojes de mentira en compartido/sondeoMotor.test.ts.
    const s = leer('packages/movil/src/useSondeo.ts');
    expect(s).toContain('crearSondeo(');
    expect(s).toContain('s.detener()');
    expect(s).toContain("if (e === 'active') reanudarSondeos();");
  });
});

describe('ningún sondeo de red pregunta a ritmo fijo', () => {
  // Los relojes de red de las apps pasan por useSondeo (los de solo pantalla, como un contador de
  // segundos, pueden seguir con setInterval).
  const archivos = [
    'apps/repartidor/src/Inicio.tsx',
    'apps/repartidor/src/servicios/PanelServicios.tsx',
    'apps/repartidor/src/soporte/ChatSoporteApp.tsx',
    'apps/repartidor/src/flex/MiRuta.tsx',
    'apps/repartidor/src/piezas/ModoDestino.tsx',
    'apps/cliente/src/app/ride.tsx',
    'apps/cliente/src/app/order/[id].tsx',
    'apps/cliente/src/app/group/[codigo].tsx',
    'packages/movil/src/ChatPedido.tsx',
    'apps/restaurante/src/Inicio.tsx',
  ];
  for (const a of archivos)
    it(a, () => {
      const s = leer(a);
      expect(s).toContain('useSondeo(');
      expect(s).not.toMatch(/setInterval\(\(\) => void (cargar|leer|sincronizar|reintentar)\(\)/);
      expect(s).not.toMatch(/setInterval\((cargar|leer|leerDemanda), /);
    });
});

describe('la ubicación de fondo no insiste', () => {
  const s = leer('apps/repartidor/src/ubicacionFondo.ts');
  it('con la sesión vencida se apaga y queda apagada', () => {
    expect(s).toMatch(/esSesionTerminada\(r, datos\)\)[\s\S]{0,250}fijarModoRastreo\('apagado'\)/);
    // Un 429 (freno) no pierde la lectura: queda en la cola para reintentar.
    expect(s).toContain('r.status >= 500 || r.status === 429) fallo(cuerpo)');
  });
  it('si el servidor falla, el reintento espera cada vez más (no en cada lectura de 15 s)', () => {
    expect(s).toContain('esperaSondeo(');
    expect(s).toContain('proximoIntento');
    // Con un pedido o viaje en curso, el tope es de 30 s (el cliente no deja de ver al conductor).
    expect(s).toContain("modoActual === 'activo' ? 30_000 : undefined");
  });
  it('el inicio la apaga al desmontarse', () => {
    expect(leer('apps/repartidor/src/Inicio.tsx')).toMatch(
      /fijarModoRastreo\('apagado'\);\s*void detenerUbicacionFondo\(\);/,
    );
  });
});

describe('el reloj del inicio de Driver no pinta todo cada segundo', () => {
  it('cada segundo solo con una cuenta atrás en segundos; si no, cada 30 s', () => {
    const s = leer('apps/repartidor/src/Inicio.tsx');
    expect(s).toContain('relojSegundos ? 1000 : 30_000');
    expect(s).not.toContain('setInterval(() => setTic(Date.now()), 1000)');
  });
});

describe('lo crítico no espera más de 20 s', () => {
  it('estado y ofertas de Driver, viaje del cliente y seguimiento del pedido', () => {
    for (const a of [
      'apps/repartidor/src/Inicio.tsx',
      'apps/cliente/src/app/ride.tsx',
      'apps/cliente/src/app/order/[id].tsx',
      'apps/restaurante/src/Inicio.tsx',
    ])
      expect(leer(a), a).toContain('topeMs: ESPERA_MAXIMA_CRITICA_MS');
  });
});

describe('la oferta de viaje se muestra con su tiempo real', () => {
  it('la cuenta atrás usa los segundos que da el servidor, no el reloj del teléfono', () => {
    const s = leer('apps/repartidor/src/viajes/OfertaViaje.tsx');
    expect(s).toContain('venceOferta(oferta, Date.now())');
    expect(leer('apps/repartidor/src/Inicio.tsx')).toContain('key={ofertasViaje[0].operacionId}');
  });
});
