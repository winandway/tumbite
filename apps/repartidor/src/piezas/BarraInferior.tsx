import type { Idioma } from '@tumbite/compartido';
import { BarraPestanas, COLOR } from '@tumbite/movil';
import { textosDriver } from './textos';

export type Pestana = 'inicio' | 'pedidos' | 'ganancias' | 'perfil';

/**
 * Barra inferior del Driver: Inicio, Pedidos, Ganancias y Perfil. C-COLORES-DRIVER y C-APPS-DISENO
 * (15 nov 2026): íconos de línea (rellenos al elegirse) en el azul de logística, el color del Driver.
 */
export function BarraInferior({
  idioma,
  activa,
  alTocar,
}: {
  idioma: Idioma;
  activa: Pestana;
  alTocar: (p: Pestana) => void;
}) {
  const t = textosDriver(idioma);
  const nombre = (p: Pestana) => new Map(Object.entries(t.nav) as [Pestana, string][]).get(p) ?? p;
  return (
    <BarraPestanas
      activa={activa}
      alTocar={(p) => alTocar(p as Pestana)}
      colorActivo={COLOR.logistica}
      pestanas={[
        { clave: 'inicio', texto: nombre('inicio'), icono: 'home-outline', iconoActivo: 'home' },
        {
          clave: 'pedidos',
          texto: nombre('pedidos'),
          icono: 'receipt-outline',
          iconoActivo: 'receipt',
        },
        {
          clave: 'ganancias',
          texto: nombre('ganancias'),
          icono: 'stats-chart-outline',
          iconoActivo: 'stats-chart',
        },
        {
          clave: 'perfil',
          texto: nombre('perfil'),
          icono: 'person-outline',
          iconoActivo: 'person',
        },
      ]}
    />
  );
}
