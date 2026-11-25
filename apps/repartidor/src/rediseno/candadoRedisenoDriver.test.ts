import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-REDISENO-DRIVER (24 nov 2026, borrador aprobado por Richard; todos los países). Las pantallas
 * clave de Divoox Driver usan las piezas del rediseño (packages/movil/src/driverKit.tsx). Si alguien
 * vuelve a la cabecera con menú, a la barra de «Pedidos/Perfil», a la tarjeta negra del estado o a las
 * ofertas sin etiqueta de servicio, esta prueba se pone en rojo. La de pantalla (360, 430 y tableta)
 * está en e2e/recorrido/redisenoDriver.spec.ts.
 */
const SRC = join(import.meta.dirname, '..');
const leer = (...p: string[]) => readFileSync(join(SRC, ...p), 'utf8');
const kit = readFileSync(
  join(SRC, '..', '..', '..', 'packages', 'movil', 'src', 'driverKit.tsx'),
  'utf8',
);

describe('C-REDISENO-DRIVER: las pantallas clave usan las piezas nuevas', () => {
  it('la barra de abajo tiene cuatro lugares: Inicio, Ganancias, Avisos (con su número) y Cuenta', () => {
    const b = leer('piezas', 'BarraInferior.tsx');
    expect(b).toMatch(/export type Pestana = 'inicio' \| 'ganancias' \| 'avisos' \| 'cuenta';/);
    for (const c of ['inicio', 'ganancias', 'avisos', 'cuenta'])
      expect(b).toContain(`clave: '${c}'`);
    expect(b).toMatch(/insignia: sinLeer > 0 \? sinLeer : undefined/);
    expect(b).not.toContain("clave: 'pedidos'");
    expect(b).not.toContain("clave: 'perfil'");
  });

  it('el inicio: mapa entero, escudo, ganado hoy, modo destino, barra de activación y hoja abajo', () => {
    const i = leer('Inicio.tsx');
    const inicio = i.slice(i.indexOf('C-REDISENO-DRIVER: el inicio del borrador'));
    for (const pieza of [
      '<FlotanteDriver',
      '<BotonRedondoDriver',
      '<PildoraGanancias',
      '<BarraActivacionDriver',
      '<HojaDriver testID="hoja-inicio"',
    ])
      expect(inicio, pieza).toContain(pieza);
    expect(inicio).toContain('testID="escudo-seguridad"');
    // Sin la cabecera vieja con menú de hamburguesa y logo.
    expect(i).not.toMatch(/<CabeceraDriver\s/);
    expect(i).not.toContain('setMenuAbierto');
    // La cabecera blanca de las demás pantallas y la columna de tableta.
    expect(i).toContain('<CabeceraDriverPantalla');
    expect(i).toMatch(/<AnchoDriver estilo=\{\{ flexGrow: 1 \}\}>\{cuerpo\}<\/AnchoDriver>/);
    // Abrir «Avisos» deja la campana en cero (C-CAMPANA-SE-VACIA).
    expect(i).toMatch(/if \(p === 'avisos'\) setCampanaSinLeer\(0\)/);
  });

  it('el estado del inicio es el punto y la línea del borrador, no la tarjeta negra', () => {
    const p = leer('servicios', 'PanelServicios.tsx');
    const estado = p.slice(
      p.indexOf('function TarjetaEstado'),
      p.indexOf('export type RutaFlexPanel'),
    );
    expect(estado).toContain('<EstadoConexionDriver');
    expect(estado).not.toContain('COLOR.negro');
  });

  it('las ofertas: etiqueta del servicio, reloj, tres datos, ruta, Aceptar y Rechazar nuevos', () => {
    for (const archivo of [
      ['viajes', 'OfertaViaje.tsx'],
      ['grandes', 'Oferta.tsx'],
    ] as const) {
      const o = leer(...archivo);
      for (const pieza of [
        '<EtiquetaServicioDriver',
        '<RelojOfertaDriver',
        '<CuentaAtrasDriver',
        '<DatosTresDriver',
        '<RutaDriver',
        '<BotonDriver',
        '<RechazarDriver',
      ])
        expect(o, `${archivo.join('/')}: ${pieza}`).toContain(pieza);
    }
    // Envíos en azul petróleo.
    expect(leer('viajes', 'OfertaViaje.tsx')).toMatch(
      /variante=\{oferta\.servicioId === 'envios' \? 'petroleo' : 'negro'\}/,
    );
  });

  it('el viaje en curso: etiqueta, barra de tres pasos y título del paso; el cierre con el círculo verde', () => {
    const v = leer('viajes', 'ViajeActivo.tsx');
    expect(v).toContain('<EtiquetaServicioDriver');
    expect(v).toContain('<BarraPasosDriver');
    expect(v).toContain('<TituloPasoDriver');
    expect(v).toMatch(/backgroundColor: DK\.verde,/);
    expect(leer('piezas', 'Progreso.tsx')).toContain('<BarraPasosDriver');
  });

  it('la cuenta: cabecera de perfil, filas y el selector de idioma estilo Amazon', () => {
    const c = leer('rediseno', 'CuentaDriver.tsx');
    expect(c).toContain('<PerfilCabeceraDriver');
    expect(c).toContain('<FilaDriver');
    expect(c).toContain('<SelectorIdioma');
    expect(leer('Inicio.tsx')).toContain('<CuentaDriver');
  });

  it('ganancias con «Ganancias | Billetera» y seguridad con «Desliza para emergencias»', () => {
    expect(leer('Inicio.tsx')).toContain('<SegmentadoDriver');
    const s = leer('grandes', 'Seguridad.tsx');
    expect(s).toMatch(/<Deslizador[\s\S]{0,120}testID="seguridad-emergencia"/);
    expect(s).toContain("deslizarEmergencia: 'Desliza para emergencias'");
  });

  it('el kit: solo colores de Divoox, sin degradados ni emojis, y nada estirado en tableta', () => {
    expect(kit).toContain("rojo: '#F20D20'");
    expect(kit).toContain("rojoOscuro: '#C20A1A'");
    expect(kit).toContain("negro: '#101010'");
    expect(kit).toContain("gris: '#666B73'");
    expect(kit).toContain("petroleo: '#1F4D69'");
    expect(kit).not.toMatch(/Gradient|gradient/);
    expect(kit).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(kit).toMatch(/export const ANCHO_MAXIMO_DRIVER = 600;/);
    expect(kit.slice(kit.indexOf('export function HojaDriver'))).toContain(
      'maxWidth: ANCHO_MAXIMO_DRIVER',
    );
  });
});
