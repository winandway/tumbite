import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TEXTOS_VIAJE } from '../../../apps/repartidor/src/viajes/textos';
import { TEXTOS_RUTA } from '../../../apps/repartidor/src/flex/textos';
import { textosGrandes } from '../../../apps/repartidor/src/grandes/textos';

/**
 * C-PASOS-DESLIZANDO (paquete 12, 19 nov 2026; todos los países). Como Uber Driver y DoorDash Dasher,
 * en Driver todo paso del trabajo que cierra una etapa y no se deshace con facilidad se DESLIZA con la
 * pieza única `Deslizador` (que vibra al cruzar el 85 %), nunca se toca: un toque en el bolsillo no
 * marca «Llegué» ni arranca un viaje. Lo que es navegación o se puede deshacer (abrir el mapa, chat,
 * ayuda, foto) sigue siendo un botón.
 *
 * Ya deslizaban antes de este paquete: conectarse y desconectarse (C-CONECTAR-DESLIZANDO), volver de la
 * pausa, completar la entrega de comida en la puerta (C-ENTREGA-DESLIZAR), terminar el viaje y entregar
 * el envío (C-CERRAR-DESLIZANDO) y finalizar una parada de Flex (C-FLEX-DESLIZAR).
 *
 * Visto en ROJO el 19 nov 2026 antes de cambiar el código: «Llegué», «Iniciar viaje», «Llegué a la
 * parada», «Seguir el viaje», «Llegué al restaurante», «Entregado en mano», «Llegué al centro», «Salir
 * a la ruta», «Ya estacioné» y «Cerrar la ruta» eran `<Boton>` de un toque y este archivo fallaba.
 */
const raiz = join(import.meta.dirname, '..', '..', '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');
/** Sin espacios ni saltos, para buscar etiquetas JSX sin depender del formato. */
const junto = (s: string) => s.replace(/\s+/g, '');
/** Los `testID` que lleva cada `<Deslizador …>` del archivo. */
const idsDeslizador = (s: string) =>
  [...s.matchAll(/<Deslizador\b[^>]*?testID="([^"]+)"/gs)].map((m) => m[1]);

describe('C-PASOS-DESLIZANDO: los pasos del trabajo se deslizan', () => {
  it('la pieza única vibra al cruzar el umbral', () => {
    expect(leer('packages/movil/src/Deslizador.tsx')).toMatch(/Vibration\.vibrate\(/);
  });

  it('viaje (moto, carro y envío): llegué, iniciar, llegué a la parada y seguir se deslizan', () => {
    const v = leer('apps/repartidor/src/viajes/ViajeActivo.tsx');
    for (const clave of ['llegue', 'iniciar', 'llegueParada', 'seguir'])
      expect(junto(v), `«${clave}» no puede ser un botón de un toque`).not.toContain(
        `<Botontexto={t.${clave}}`,
      );
    expect(idsDeslizador(v)).toEqual(
      expect.arrayContaining([
        'viaje-llegue',
        'viaje-iniciar',
        'viaje-parada-llegue',
        'viaje-parada-seguir',
      ]),
    );
    // Lo reversible sigue siendo botón.
    expect(junto(v)).toContain('<Botontexto={t.navegar}');
  });

  it('comida: «Llegué al restaurante» y «Entregado en mano» se deslizan', () => {
    const i = leer('apps/repartidor/src/Inicio.tsx');
    expect(i).not.toMatch(/<Boton\s+texto=\{tg\.pedido\.llegue\}/);
    expect(i).not.toMatch(/<Boton\s+texto=\{t\.enMano\}/);
    expect(idsDeslizador(i)).toEqual(expect.arrayContaining(['pedido-llegue', 'entregar-en-mano']));
  });

  it('Flex: llegar al centro, salir a la ruta, estacionar y cerrar la ruta se deslizan', () => {
    const r = leer('apps/repartidor/src/flex/MiRuta.tsx');
    for (const clave of ['llegueCentro', 'salir', 'llegue', 'cerrar'])
      expect(junto(r), `«${clave}» no puede ser un botón de un toque`).not.toContain(
        `<Botontexto={t.${clave}}`,
      );
    for (const clave of [
      'deslizarLlegueCentro',
      'deslizarSalir',
      'deslizarLlegue',
      'deslizarCerrar',
    ])
      expect(junto(r)).toContain(`<Deslizartexto={t.${clave}}`);
  });

  it('cada texto de deslizar existe en español y en inglés y dice que se desliza', () => {
    const vEs = TEXTOS_VIAJE.es.activo;
    const vEn = TEXTOS_VIAJE.en.activo;
    for (const k of [
      'deslizarLlegue',
      'deslizarIniciar',
      'deslizarLlegueParada',
      'deslizarSeguir',
    ] as const) {
      expect(vEs[k]).toMatch(/^Desliza/);
      expect(vEn[k]).toMatch(/^Slide/);
    }
    expect(TEXTOS_VIAJE.es.activoEnvio.deslizarIniciar).toMatch(/^Desliza/);
    expect(TEXTOS_VIAJE.en.activoEnvio.deslizarIniciar).toMatch(/^Slide/);
    for (const k of [
      'deslizarLlegueCentro',
      'deslizarSalir',
      'deslizarLlegue',
      'deslizarCerrar',
    ] as const) {
      expect(TEXTOS_RUTA.es[k]).toMatch(/^Desliza/);
      expect(TEXTOS_RUTA.en[k]).toMatch(/^Slide/);
    }
    expect(textosGrandes('es').pedido.deslizarLlegue).toMatch(/^Desliza/);
    expect(textosGrandes('en').pedido.deslizarLlegue).toMatch(/^Slide/);
  });
});
