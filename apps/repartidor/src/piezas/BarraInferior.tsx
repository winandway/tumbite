import type { Idioma } from '@tumbite/compartido';
import { BarraPestanas, DK } from '@tumbite/movil';
import { textosDriver } from './textos';

export type Pestana = 'inicio' | 'ganancias' | 'avisos' | 'cuenta';

/**
 * C-REDISENO-DRIVER (24 nov 2026, borrador aprobado por Richard): una sola barra de abajo con cuatro
 * lugares, como Uber Driver y DoorDash Dasher: Inicio, Ganancias, Avisos (con el número de lo que no
 * ha visto; se va a cero al abrirla, C-CAMPANA-SE-VACIA) y Cuenta. Íconos de línea, el elegido en
 * negro. Nada se repite en otra pantalla.
 */
export function BarraInferior({
  idioma,
  activa,
  alTocar,
  sinLeer = 0,
}: {
  idioma: Idioma;
  activa: Pestana;
  alTocar: (p: Pestana) => void;
  /** Lo que la campana todavía no mostró (lo cuenta el servidor). */
  sinLeer?: number;
}) {
  const t = textosDriver(idioma).nav;
  return (
    <BarraPestanas
      activa={activa}
      colorActivo={DK.negro}
      alTocar={(p) => alTocar(p as Pestana)}
      pestanas={[
        { clave: 'inicio', texto: t.inicio, icono: 'home-outline', iconoActivo: 'home' },
        {
          clave: 'ganancias',
          texto: t.ganancias,
          icono: 'stats-chart-outline',
          iconoActivo: 'stats-chart',
        },
        {
          clave: 'avisos',
          texto: t.avisos,
          icono: 'notifications-outline',
          iconoActivo: 'notifications',
          insignia: sinLeer > 0 ? sinLeer : undefined,
        },
        { clave: 'cuenta', texto: t.cuenta, icono: 'person-outline', iconoActivo: 'person' },
      ]}
    />
  );
}
