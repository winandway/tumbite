import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Repaso de «Mi ruta» en el simulador de iPhone con una ruta de prueba en Michigan (31 oct 2026, L1):
 * - C-FLEX-CARGA-LISTA: con todos los paquetes cargados, la pantalla seguía ofreciendo «Escanear
 *   siguiente» y el botón para salir quedaba abajo, debajo de «escanea todos los paquetes». Como en
 *   Amazon Flex, con la carga completa el botón principal es «Salir a la ruta».
 * - C-FLEX-MAPA-ENCUADRE: el mapa de la ruta encuadraba antes de terminar de cargar y las paradas
 *   quedaban fuera de la pantalla (el mismo fallo de C-MAPA-ENCUADRE en el mapa del inicio).
 * - C-FLEX-DISTANCIA-PAIS: la distancia a la parada salía en kilómetros en una ruta de EE. UU.; la
 *   unidad la decide el país de la empresa (C-DISTANCIA-POR-PAIS).
 */
const RAIZ = join(__dirname, '..', '..', '..', 'apps');
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), 'utf8');
const miRuta = leer('repartidor', 'src', 'flex', 'MiRuta.tsx');
const mapa = leer('repartidor', 'src', 'flex', 'MapaRuta.tsx');
const servidor = leer('servidor', 'src', 'flex', 'rutasComun.ts');

describe('Mi ruta: repaso en el simulador', () => {
  it('con la carga completa el botón principal es «Salir a la ruta» (C-FLEX-CARGA-LISTA)', () => {
    expect(miRuta).toMatch(/const cargaLista =/);
    expect(miRuta).toMatch(/cargaLista \? \(\s*<Boton\s+texto=\{t\.salir\}/);
    // En la pantalla de «Paquete cargado» tampoco se ofrece escanear otro si ya no queda ninguno.
    expect(miRuta).toMatch(/escaneo\.modo === 'carga' && cargaLista/);
  });
  it('el mapa de la ruta encuadra cuando termina de cargar (C-FLEX-MAPA-ENCUADRE)', () => {
    expect(mapa).toContain('onMapReady={() => setListo(true)}');
    expect(mapa).toMatch(/if \(!listo \|\| todos\.length < 2\) return;/);
    // Y nace ya mostrando todos los puntos (en el iPhone, encuadrar después no siempre se aplica).
    expect(mapa).toContain('initialRegion={inicial}');
    expect(mapa).toContain('const inicial = regionDe(todos);');
  });
  it('la distancia va en la unidad del país de la ruta (C-FLEX-DISTANCIA-PAIS)', () => {
    expect(servidor).toMatch(/SELECT nombre, pais, config_entrega_json FROM empresas/);
    expect(servidor).toMatch(/pais: empresa\?\.pais \?\? null/);
    expect(miRuta).toContain('textoDistancia(distanciaKm(a, b), idioma, pais)');
    expect(miRuta).not.toMatch(/\} km \$\{t\.aprox\}/);
  });
});

/**
 * C-FLEX-DESLIZAR-SCROLL (31 oct 2026, simulador de iPhone): dentro de la pantalla que se desplaza,
 * la bola de «Desliza para finalizar» avanzaba un poco y se quedaba trabada: la lista se quedaba con
 * el gesto y la entrega no se cerraba. La bola toma el gesto desde que se toca, no lo suelta, y si
 * igual lo pierde vuelve al inicio.
 */
describe('Desliza para finalizar dentro de una pantalla que se desplaza', () => {
  const piezas = leer('repartidor', 'src', 'flex', 'piezas.tsx');
  const deslizar = piezas.slice(piezas.indexOf('export function Deslizar'));
  it('toma el gesto al tocar y no se lo cede a la lista', () => {
    expect(deslizar).toContain('onStartShouldSetPanResponder: () => true');
    expect(deslizar).toContain('onPanResponderTerminationRequest: () => false');
  });
  it('al elegir dónde lo dejó se borra el aviso que lo pedía', () => {
    expect(miRuta).toMatch(
      /setLugar\(k\);[\s\S]{0,120}if \(aviso === t\.faltaLugar\) setAviso\(''\)/,
    );
  });
  it('el gesto se arma una vez y lee el ancho y la acción actuales', () => {
    expect(deslizar).toContain('const [gesto] = useState(() => {');
    expect(deslizar).toContain('actual.current.alTerminar()');
    expect(deslizar).toContain('actual.current.tope');
  });
  it('al firmar o tomar la foto se borra el aviso de lo que faltaba (C-FLEX-AVISO-AL-DAR)', () => {
    expect(miRuta).toMatch(/setPidiendoFirma\(false\);[\s\S]{0,160}setAviso\(''\)/);
    expect(miRuta).toMatch(/setFoto\([\s\S]{0,120}\);\s*setAviso\(''\)/);
  });
  it('«Firma lista» va en verde (lo hecho es verde)', () => {
    expect(miRuta).toMatch(
      /texto=\{firma \? t\.firmaLista : t\.firmar\}[\s\S]{0,160}exito=\{Boolean\(firma\)\}/,
    );
  });
  it('si pierde el gesto, la bola vuelve al inicio', () => {
    expect(deslizar).toContain('onPanResponderTerminate: volver');
    expect(deslizar).toMatch(/const volver = \(\) => Animated\.spring\(x, \{ toValue: 0/);
  });
});

describe('Mi ruta: el final de la ruta', () => {
  it('con todas las paradas hechas, «Terminar entregas» es el botón principal (C-FLEX-TERMINAR-A-LA-VISTA)', () => {
    expect(miRuta).toContain('const todasHechas =');
    expect(miRuta).toMatch(
      /\{todasHechas \? \(\s*\/\/[^\n]*\n[^\n]*\n\s*<Boton\s+texto=\{t\.devolucion\}\s+exito/,
    );
  });
  it('sin paquetes que devolver dice que ya puede cerrar, sin una caja vacía (C-FLEX-SIN-DEVOLUCIONES)', () => {
    expect(miRuta).toContain('{t.sinDevoluciones}');
  });
  it('el aviso de «fuera del área» usa la unidad del país', () => {
    expect(miRuta).toContain('t.fueraDeArea(textoDistanciaCorta(metros, idioma, ruta.pais))');
  });
});

describe('Inicio del Driver con una ruta de paquetes (C-FLEX-RUTA-EN-INICIO)', () => {
  const inicio = leer('repartidor', 'src', 'Inicio.tsx');
  it('muestra la ruta activa con su botón para continuar', () => {
    expect(inicio).toContain("'/datos/v1/flex/conductor/rutas'");
    expect(inicio).toContain('testID="ruta-flex-inicio"');
    expect(inicio).toContain("onPress={() => setVista('miRuta')}");
  });
  it('con la ruta en curso no dice «Buscando pedidos»', () => {
    expect(inicio).toContain("estado?.conectado && !(rutaFlex && rutaFlex.estado === 'en_curso')");
  });
});

describe('Mi ruta en oscuro y a pantalla completa (Richard, con las capturas de Amazon Flex)', () => {
  const piezas = leer('repartidor', 'src', 'flex', 'piezas.tsx');
  const inicio = leer('repartidor', 'src', 'Inicio.tsx');
  it('la paleta de logística es oscura y el texto va en blanco por defecto (C-FLEX-OSCURO)', () => {
    expect(piezas).toContain("export const FONDO = '#0F1F2A'");
    expect(piezas).toContain("export const TEXTO = '#FFFFFF'");
    expect(miRuta).toContain('Texto as Text');
    expect(miRuta).not.toContain('color: C.secundario');
  });
  it('las paradas de la lista van unidas por una línea que se pone verde (C-FLEX-LISTA-UNIDA)', () => {
    expect(miRuta).toContain('testID="lista-unida"');
    expect(miRuta).toMatch(/ultima \? 'transparent' : hecha \? VERDE : BORDE/);
  });
  it('dentro de la ruta no va la cabecera del logo (C-FLEX-PANTALLA-COMPLETA)', () => {
    const desde = inicio.indexOf("if (vista === 'miRuta')");
    const bloque = inicio.slice(desde, inicio.indexOf("if (vista === 'alta')", desde));
    expect(bloque).toContain('testID="mi-ruta-completa"');
    expect(bloque).not.toContain('CabeceraDriver');
    expect(bloque).not.toContain('lienzo(');
    expect(miRuta).toContain('testID="flex-volver"');
  });
});

describe('Mi ruta: escanear en la parada y «Parada actual» (como Amazon Flex)', () => {
  const inicio = leer('repartidor', 'src', 'Inicio.tsx');
  it('no deja deslizar para entregar sin escanear los paquetes de la parada (C-FLEX-ESCANEO-PARADA)', () => {
    expect(miRuta).toContain('testID="escaneo-parada"');
    expect(miRuta).toMatch(
      /if \(sinEscanear\) \{[\s\S]{0,120}setAvisoEscaneo\(t\.faltaEscanear\(sinEscanear\)\)/,
    );
    expect(miRuta).toContain('setAvisoEscaneo(t.noEsDeParada)');
    expect(miRuta).toContain(
      "<Listo marcado={p.estado === 'entregado' || escaneados.has(p.id)} />",
    );
  });
  it('«Parada actual» va fija abajo, fuera de lo que se desplaza (C-FLEX-PARADA-ACTUAL)', () => {
    expect(miRuta).toContain('testID="parada-actual"');
    expect(inicio).toContain('ponerPie={setPieFlex}');
    expect(inicio).toMatch(/<\/ScrollView>\s*\{pieFlex\}/);
  });
});

describe('punto de encuentro en la parada (C-FLEX-ENCUENTRO, LG2)', () => {
  it('el conductor ve el nombre del punto y que quien recibe lo espera ahí', () => {
    expect(miRuta).toContain('testID="parada-encuentro"');
    expect(miRuta).toContain("p.entrega === 'encuentro' && p.puntoEncuentro");
  });
});
