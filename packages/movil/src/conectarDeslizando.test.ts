import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { altoTarjetaServicio, debeConfirmar } from './serviciosLogica';

/**
 * C-CONECTAR-DESLIZANDO (Richard, 18 nov 2026; todos los países). En Driver, conectarse es deslizar
 * de izquierda a derecha, nunca un toque: un toque en el bolsillo o un niño conectaban sin querer,
 * llegaba un viaje y el conductor se llevaba una mala nota. Una sola pieza (`Deslizador`) para
 * conectar, desconectar, llegar y entregar.
 */
const raiz = join(import.meta.dirname, '..', '..', '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');

describe('el gesto: un toque o soltar a medio camino no conectan; deslizar completo, sí', () => {
  const recorrido = 280;
  it('un toque simple (sin moverse) no conecta', () => {
    expect(debeConfirmar(0, recorrido)).toBe(false);
  });
  it('soltar a medio camino no conecta', () => {
    expect(debeConfirmar(recorrido / 2, recorrido)).toBe(false);
    expect(debeConfirmar(recorrido * 0.84, recorrido)).toBe(false);
  });
  it('deslizar completo sí conecta', () => {
    expect(debeConfirmar(recorrido, recorrido)).toBe(true);
  });
});

describe('ningún punto de conexión de Driver se toca: todos deslizan', () => {
  it('la tarjeta de un servicio desconectado se conecta deslizando (sin botón «Conectar»)', () => {
    const s = leer('packages/movil/src/TarjetaServicio.tsx');
    expect(s).toMatch(/sentido="conectar"/);
    expect(s).not.toMatch(/texto=\{textos\.conectar\}/);
  });
  it('«Conectarme» y «Desconectarme» del inicio deslizan', () => {
    const s = leer('apps/repartidor/src/servicios/PanelServicios.tsx');
    expect(s).not.toMatch(/<BotonAncho[\s\S]{0,120}t\.conectarme/);
    expect(s).not.toMatch(/<BotonAncho[\s\S]{0,120}t\.desconectarme/);
    expect(s).toMatch(/testID="conectarme"/);
    expect(s).toMatch(/<Deslizador[\s\S]{0,400}testID="conectarme"/);
  });
  it('volver de la pausa también desliza', () => {
    const s = leer('apps/repartidor/src/Inicio.tsx');
    expect(s).not.toMatch(/texto=\{estado\.pausado \? tg\.pausa\.reanudar : tg\.pausa\.pausar\}/);
    expect(s).toMatch(/<Deslizador[\s\S]{0,300}tg\.pausa\.reanudar/);
  });
  // Revisor (18 nov 2026): «Deshacer» tras desconectar reconectaba con UN toque (el escenario del
  // bolsillo: se desliza, se desconecta y el toque siguiente reconecta). El aviso ahora solo informa.
  it('ningún toque reconecta: el aviso tras desconectar solo informa', () => {
    const inicio = leer('apps/repartidor/src/Inicio.tsx');
    const aviso = inicio.match(/<AvisoDeshacer[\s\S]*?\/>/)?.[0] ?? '';
    expect(aviso).not.toBe('');
    expect(aviso).not.toMatch(/alDeshacer|conectar/);
    expect(aviso).toMatch(/avisoVolver/);
    // Ningún manejador de toque (onPress, alTocar, alDeshacer) llama a conectar o reanudar.
    const archivos = [
      'apps/repartidor/src/Inicio.tsx',
      'apps/repartidor/src/servicios/PanelServicios.tsx',
      'packages/movil/src/TarjetaServicio.tsx',
    ];
    const conecta =
      /(conectarServicio\(|alConectarServicio\(|alConectarTodo|alConectar\b|alternar\(\)|pausado: false|conectado: true)/g;
    for (const f of archivos) {
      const s = leer(f);
      for (const m of s.matchAll(conecta)) {
        const antes = s.slice(Math.max(0, (m.index ?? 0) - 160), m.index);
        const ultimaEtiqueta = antes.lastIndexOf('<');
        const tramo = antes.slice(ultimaEtiqueta);
        expect(tramo, `${f}: «${m[0]}» cuelga de un toque`).not.toMatch(
          /(onPress|alTocar|alDeshacer)=\{[^}]*$/,
        );
      }
    }
  });
  it('con lector de pantalla, conectar pide confirmar', () => {
    const s = leer('packages/movil/src/Deslizador.tsx');
    expect(s).toMatch(/confirmarConSistema/);
    expect(s).toMatch(/sentido/);
  });
});

describe('lo que pidió el revisor sobre el deslizador (18 nov 2026)', () => {
  it('el pulgar arranca lejos del borde del gesto «atrás» de Android (≥ 24 dp de la pantalla)', () => {
    const s = leer('packages/movil/src/Deslizador.tsx');
    const margen = Number(s.match(/export const MARGEN_PULGAR = (\d+);/)?.[1]);
    // Las pantallas de Driver dejan 16 dp a cada lado; el pulgar suma su margen dentro del riel.
    expect(16 + margen).toBeGreaterThanOrEqual(24);
    expect(s).toMatch(/const margen = MARGEN_PULGAR;/);
    expect(leer('apps/repartidor/src/servicios/PanelServicios.tsx')).toMatch(
      /paddingHorizontal: 16/,
    );
  });
  it('el «Sí» de conectar o reanudar no sale en rojo; solo lo que apaga', () => {
    const s = leer('packages/movil/src/Deslizador.tsx');
    expect(s).toMatch(/style: destructivo \? 'destructive' : 'default'/);
    expect(s).toMatch(/props\.sentido !== 'conectar'/);
    expect(s).toMatch(/props\.tono === 'neutro'/);
  });
  it('la tarjeta crece con la letra grande y no corta el nombre ni el detalle', () => {
    expect(altoTarjetaServicio(1)).toBe(68);
    // Nombre (20) y detalle (17) a 1,6 veces, más el relleno.
    expect(altoTarjetaServicio(1.6)).toBeGreaterThanOrEqual(Math.ceil(37 * 1.6) + 16);
    expect(altoTarjetaServicio(3)).toBe(altoTarjetaServicio(1.6));
    expect(leer('packages/movil/src/Deslizador.tsx')).toMatch(/height: alto,/);
  });
});

// C-CERRAR-DESLIZANDO (robot de Android, 18 nov 2026): «Entregar el paquete» cerraba un envío con
// un toque. Entregar un envío y terminar un viaje se deslizan, como el cierre de la comida.
describe('ningún toque cierra una entrega ni un viaje', () => {
  const v = leer('apps/repartidor/src/viajes/ViajeActivo.tsx');
  it('terminar y entregar van en el deslizador', () => {
    expect(v).toMatch(/<Deslizador[\s\S]{0,200}testID="viaje-terminar"/);
    expect(v).not.toMatch(/<Boton\s+texto=\{esEnvio \? t\.entregar : t\.terminar\}/);
    expect(v).not.toMatch(/alTocar=\{[^}]*paso\('terminar'/);
  });
  it('la comida sigue cerrándose con la foto y «Desliza para completar»', () => {
    expect(leer('apps/repartidor/src/Inicio.tsx')).toMatch(/<DeslizarParaCompletar/);
  });
});

// Revisor B4 (18 nov 2026): con VoiceOver o TalkBack, la acción «activar» de un deslizador cerraba
// el viaje o la entrega (y cobraba) sin preguntar. Todo deslizador de acción de Driver pregunta.
describe('con lector de pantalla, todo deslizador que hace algo pregunta antes', () => {
  const archivos = [
    'apps/repartidor/src/Inicio.tsx',
    'apps/repartidor/src/servicios/PanelServicios.tsx',
    'apps/repartidor/src/viajes/ViajeActivo.tsx',
    'apps/repartidor/src/flex/piezas.tsx',
    'apps/repartidor/src/piezas/DeslizarParaCompletar.tsx',
  ];
  it('cada <Deslizador variante="accion"> lleva confirmar', () => {
    for (const f of archivos) {
      const s = leer(f);
      for (const m of s.matchAll(/<Deslizador\s+variante="accion"[\s\S]*?\/>/g))
        expect(m[0], f).toMatch(/confirmar=\{/);
    }
  });
  it('la pieza de Flex exige el texto de confirmar a quien la usa', () => {
    expect(leer('apps/repartidor/src/flex/MiRuta.tsx')).toMatch(
      /<Deslizar[\s\S]{0,120}confirmar=\{t\.confirmarFinalizar\}/,
    );
  });
});
