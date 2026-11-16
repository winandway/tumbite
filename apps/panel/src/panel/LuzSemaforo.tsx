import { type Idioma, duracionEnPalabras, enIdioma, semaforoPedido } from '@tumbite/compartido';

/** C-DURACION-EN-PALABRAS: «hace 31 días» / «31 days ago», nunca «hace 761 h». */
export const haceTanto = (minutos: number, idioma: Idioma): string =>
  idioma === 'en'
    ? `${duracionEnPalabras(minutos * 60, 'en')} ago`
    : `hace ${duracionEnPalabras(minutos * 60, 'es')}`;

const T = {
  es: {
    // C-DURACION-EN-PALABRAS: rojo = pasó lo previsto más unos minutos («Atascado»).
    luces: { verde: 'A tiempo', amarillo: 'Atrasándose', rojo: 'Atascado' },
    motivos: {
      restaurante: 'sin aceptar (se cancela solo a los 6 min)',
      cocina: 'la cocina pasó el tiempo prometido',
      repartidor: 'lista y sin repartidor',
      entrega: 'la entrega está tardando',
    },
  },
  en: {
    luces: { verde: 'On time', amarillo: 'Running late', rojo: 'Stuck' },
    motivos: {
      restaurante: 'not accepted (auto-cancels at 6 min)',
      cocina: 'kitchen is past the promised time',
      repartidor: 'ready with no driver',
      entrega: 'delivery is taking long',
    },
  },
};

type Fechas = Parameters<typeof semaforoPedido>[0];

/** Punto de color del Manager con los minutos y, si no va bien, el porqué. Candado C-MANAGER-1. */
export function LuzSemaforo({ pedido, idioma }: { pedido: Fechas; idioma: Idioma }) {
  const s = semaforoPedido(pedido);
  if (!s) return null;
  const t = enIdioma(T, idioma);
  const luz = new Map(Object.entries(t.luces)).get(s.luz);
  const motivo = new Map(Object.entries(t.motivos)).get(s.motivo);
  return (
    <span className={`semaforo semaforo-${s.luz}`} role="status">
      <span className="semaforo-punto" aria-hidden="true" />
      <span>
        {luz} · {haceTanto(s.minutos, idioma)}
        {s.luz === 'verde' ? '' : ` · ${motivo}`}
      </span>
    </span>
  );
}
