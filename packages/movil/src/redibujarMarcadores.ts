/**
 * C-MARCADOR-ANDROID (segunda vuelta, 19 nov 2026) — todos los países. La parte pura (sin React
 * Native) de la foto de los marcadores del mapa de Google en Android.
 *
 * Causa real del círculo blanco vacío (leída en el código de react-native-maps 1.27.2,
 * `MapMarker.java` y `ViewChangesTracker.java`): con `tracksViewChanges` el mapa NO sigue la vista
 * mientras la propiedad esté encendida; toma UNA foto después de la primera medida y se apaga solo
 * (`updateCustomForTracking` devuelve `false` en cuanto `updated` llega a 0). El isotipo es una
 * imagen DENTRO del disco blanco (nieta del marcador): cuando termina de cargar no cambia ninguna
 * medida, así que nadie vuelve a tomar la foto. Volver a encender `tracksViewChanges` tampoco sirve:
 * el seguidor ve `updated == 0`, se apaga sin dibujar, y al apagarlo de nuevo la propiedad ya
 * coincide y no se dibuja nada. Lo único que vuelve a pintar el marcador es su método `redraw()`
 * (`updateMarkerIcon`). Esta pieza lo llama, en varios momentos, para todos los marcadores con vista
 * propia de un mapa: al aparecer, cuando el mapa termina de cargar, cuando la imagen carga y cuando
 * cambia lo que dicen.
 */
export type Redibujable = { redraw?: () => void };

/** Los momentos (en milisegundos) en que se vuelve a tomar la foto después de cada aviso. */
export const MOMENTOS_REDIBUJO = [0, 250, 700, 1500] as const;

export function crearRedibujador(
  temporizador: {
    poner: (f: () => void, ms: number) => unknown;
    quitar: (id: unknown) => void;
  } = {
    poner: (f, ms) => setTimeout(f, ms),
    quitar: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  },
) {
  const marcadores = new Set<Redibujable>();
  const relojes = new Set<unknown>();
  const dibujar = () => {
    for (const m of marcadores) m.redraw?.();
  };
  return {
    /** Ref de cada `<Marker>` con vista propia. Devuelve la limpieza (React 19). */
    registrar(m: Redibujable | null): (() => void) | undefined {
      if (!m) return undefined;
      marcadores.add(m);
      return () => {
        marcadores.delete(m);
      };
    },
    /** Vuelve a tomar la foto de todos los marcadores ahora y en los momentos de arriba. */
    programar() {
      for (const ms of MOMENTOS_REDIBUJO) {
        const id = temporizador.poner(() => {
          relojes.delete(id);
          dibujar();
        }, ms);
        relojes.add(id);
      }
    },
    /** Al desmontar el mapa: ningún reloj queda vivo. */
    limpiar() {
      for (const id of relojes) temporizador.quitar(id);
      relojes.clear();
      marcadores.clear();
    },
    cuantos: () => marcadores.size,
  };
}
