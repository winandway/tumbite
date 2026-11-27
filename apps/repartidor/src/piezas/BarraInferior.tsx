import type { Idioma } from '@tumbite/compartido';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarraPestanas, DK } from '@tumbite/movil';
import { textosDriver } from './textos';

export type Pestana = 'inicio' | 'ganancias' | 'avisos' | 'cuenta';

/**
 * C-REDISENO-DRIVER (24 nov 2026, borrador aprobado por Richard): una sola barra de abajo con cuatro
 * lugares, como Uber Driver y DoorDash Dasher: Inicio, Ganancias, Avisos (con el número de lo que no
 * ha visto; se va a cero al abrirla, C-CAMPANA-SE-VACIA) y Cuenta. Íconos de línea, el elegido en
 * negro. Nada se repite en otra pantalla.
 *
 * C-BOTON-SOBRE-BARRA: la barra deja libre el área segura de abajo (en iPhone, la rayita de inicio;
 * en Android llega en cero porque SobreLosBotones ya la descontó) y avisa su alto, para que la acción
 * principal de cada hoja (AccionFija) quede fija justo arriba de ella y nunca debajo.
 */
export function BarraInferior({
  idioma,
  activa,
  alTocar,
  sinLeer = 0,
  alMedir,
}: {
  idioma: Idioma;
  activa: Pestana;
  alTocar: (p: Pestana) => void;
  /** Lo que la campana todavía no mostró (lo cuenta el servidor). */
  sinLeer?: number;
  /** Alto de la barra sin el área segura (para colocar la acción fija encima). */
  alMedir?: (alto: number) => void;
}) {
  const t = textosDriver(idioma).nav;
  const abajo = useSafeAreaInsets().bottom;
  return (
    <View style={{ backgroundColor: DK.blanco, paddingBottom: abajo }}>
      <View onLayout={(ev) => alMedir?.(Math.round(ev.nativeEvent.layout.height))}>
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
      </View>
    </View>
  );
}
