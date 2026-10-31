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
  });
  it('la distancia va en la unidad del país de la ruta (C-FLEX-DISTANCIA-PAIS)', () => {
    expect(servidor).toMatch(/SELECT nombre, pais, config_entrega_json FROM empresas/);
    expect(servidor).toMatch(/pais: empresa\?\.pais \?\? null/);
    expect(miRuta).toContain('textoDistancia(distanciaKm(a, b), idioma, pais)');
    expect(miRuta).not.toMatch(/\} km \$\{t\.aprox\}/);
  });
});
