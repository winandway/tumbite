import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { rutaDelViaje } from '../../../cliente/src/viajes/rutaDelViaje';

/**
 * C-CODIGO-A-LA-VISTA y C-CHAT-VIAJE-LLEGA (24 nov 2026, Gerencia tras pruebas reales; todos los
 * países), del lado de las apps. La prueba del servidor (los dos sentidos del chat) está en
 * apps/servidor/src/rutas/chatViajeLlega.test.ts; la de pantalla a 360 px con el teclado abierto, en
 * e2e/recorrido/redisenoDriver.spec.ts.
 */
const SRC = join(import.meta.dirname, '..');
const RAIZ = join(SRC, '..', '..', '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');
const viaje = leer('apps/repartidor/src/viajes/ViajeActivo.tsx');
const principal = viaje.slice(viaje.indexOf('<TituloPasoDriver'));

describe('C-CODIGO-A-LA-VISTA', () => {
  it('al llegar, el aviso «Pídele el código al pasajero» con la casilla va arriba (antes del precio y del mapa)', () => {
    const aviso = principal.indexOf('titulo={t.avisoCodigo}');
    expect(aviso).toBeGreaterThan(0);
    expect(aviso).toBeLessThan(principal.indexOf('testID="viaje-precio"'));
    expect(aviso).toBeLessThan(principal.indexOf('testID="viaje-mapa"'));
    const bloque = principal.slice(aviso, principal.indexOf('</CodigoALaVistaDriver>', aviso));
    expect(bloque).toContain('testID="viaje-pin"');
    expect(bloque).toContain('autoFocus');
    expect(bloque).toContain('t.quedanIntentos(viaje.intentos_pin_quedan)');
  });

  it('al entregar un envío, «Pídele el código de entrega» con su casilla, también arriba', () => {
    const aviso = principal.indexOf('titulo={t.avisoCodigoEntrega}');
    expect(aviso).toBeGreaterThan(0);
    expect(aviso).toBeLessThan(principal.indexOf('testID="viaje-precio"'));
    expect(principal.slice(aviso, aviso + 900)).toContain('testID="envio-pin-entrega"');
  });

  it('tras un código equivocado se relee el viaje (los intentos que quedan)', () => {
    expect(viaje).toMatch(
      /setError\([^)]*\)\);\s*\/\/ C-CODIGO-A-LA-VISTA[^\n]*\n\s*if \(!final\) alCambiar\(\);/,
    );
  });

  it('comida con PIN: «Pídele el código de entrega» arriba de la entrega', () => {
    const i = leer('apps/repartidor/src/Inicio.tsx');
    expect(i).toMatch(/<CodigoALaVistaDriver[\s\S]{0,200}t\.pinAviso/);
  });

  it('los textos en los dos idiomas', () => {
    const t = leer('apps/repartidor/src/viajes/textos.ts');
    expect(t).toContain("avisoCodigo: 'Pídele el código al pasajero'");
    expect(t).toContain("avisoCodigo: 'Ask your rider for their code'");
    expect(t).toContain("avisoCodigoEntrega: 'Pídele el código de entrega'");
    expect(t).toContain("avisoCodigoEntrega: 'Ask for the delivery code'");
  });
});

describe('C-CHAT-VIAJE-LLEGA (apps)', () => {
  it('Driver: arriba del viaje, la tarjeta con el último mensaje y lo no leído', () => {
    const tarjeta = principal.indexOf('<TarjetaChatViaje');
    expect(tarjeta).toBeGreaterThan(0);
    expect(tarjeta).toBeLessThan(principal.indexOf('testID="viaje-precio"'));
    expect(principal.slice(tarjeta, tarjeta + 300)).toContain(
      'sinLeer={viaje.mensajesSinLeer ?? 0}',
    );
  });

  it('clientes: la tarjeta en el viaje en curso, en vez del botón escondido', () => {
    const v = leer('apps/cliente/src/viajes/ViajeEnCurso.tsx');
    expect(v).toContain('<TarjetaChatViaje');
    expect(v).toContain('sinLeer={viaje.mensajesSinLeer ?? 0}');
    expect(v).not.toMatch(/texto=\{verChat \? t\.ocultarMensajes : t\.mensajesConductor\}/);
  });

  it('el chat abierto marca «visto» (y el número baja a cero)', () => {
    expect(leer('packages/movil/src/ChatPedido.tsx')).toMatch(
      /if \(esViaje && r\.mensajes\.some\(\(x\) => !x\.mio\)\) vistoPendiente\.current = true;[\s\S]{0,200}api\.pedir\('POST', `\$\{raiz\}\/mensajes\/visto`/,
    );
  });

  it('tocar un aviso de mensaje abre el viaje con el chat abierto (clientes y Driver)', () => {
    expect(rutaDelViaje({ tipo: 'viaje', viajeId: 'viaje-12345678', mensaje: '1' })).toEqual({
      pathname: '/ride',
      params: { servicio: 'moto', viaje: 'viaje-12345678', chat: expect.stringMatching(/^\d+$/) },
    });
    expect(rutaDelViaje({ tipo: 'viaje', viajeId: 'viaje-12345678' })?.params).not.toHaveProperty(
      'chat',
    );
    expect(leer('apps/cliente/src/app/ride.tsx')).toContain('abrirChat={Number(params.chat) || 0}');
    const i = leer('apps/repartidor/src/Inicio.tsx');
    expect(i).toMatch(/d\.tipo === 'viaje' && d\.mensaje === '1'/);
    expect(i).toContain('abrirChat={chatDelAviso}');
    expect(leer('apps/servidor/src/rutas/chatViaje.ts')).toContain(
      "datos: { tipo: 'viaje', viajeId: v.id, mensaje: '1' }",
    );
  });
});

describe('C-CHAT-VISTO-REINTENTA y reabrir el chat (revisión del 25 nov)', () => {
  it('cada aviso de mensaje tocado lleva un valor nuevo: el chat del pasajero se vuelve a abrir', async () => {
    const uno = rutaDelViaje({ tipo: 'viaje', viajeId: 'viaje-abc-123', mensaje: '1' });
    await new Promise((r) => setTimeout(r, 2));
    const dos = rutaDelViaje({ tipo: 'viaje', viajeId: 'viaje-abc-123', mensaje: '1' });
    expect(Number(uno?.params.chat)).toBeGreaterThan(0);
    expect(dos?.params.chat).not.toBe(uno?.params.chat);
    const pantalla = leer('apps/cliente/src/viajes/ViajeEnCurso.tsx');
    expect(pantalla).toContain('if (abrirChat !== abrirVisto)');
  });

  it('marcar «visto» nunca se traga el fallo: queda pendiente y se repite en la próxima consulta', () => {
    const chat = leer('packages/movil/src/ChatPedido.tsx');
    expect(chat).not.toMatch(/mensajes\/visto`, \{\}\)\.catch\(\(\) => undefined\)/);
    const fallo = chat.slice(chat.indexOf('mensajes/visto'));
    expect(fallo.slice(0, 300)).toContain('vistoPendiente.current = true');
  });
});
