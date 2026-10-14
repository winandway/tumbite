import { type Idioma, enIdioma, semaforoPedido } from '@tumbite/compartido';

const T = {
  es: {
    hace: 'hace',
    min: 'min',
    h: 'h',
    luces: { verde: 'A tiempo', amarillo: 'Atrasándose', rojo: 'En problemas' },
    motivos: {
      restaurante: 'sin aceptar (se cancela solo a los 6 min)',
      cocina: 'la cocina pasó el tiempo prometido',
      repartidor: 'lista y sin repartidor',
      entrega: 'la entrega está tardando',
    },
  },
  en: {
    hace: '',
    min: 'min ago',
    h: 'h ago',
    luces: { verde: 'On time', amarillo: 'Running late', rojo: 'In trouble' },
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
        {luz} · {t.hace}{' '}
        {s.minutos >= 120 ? `${Math.floor(s.minutos / 60)} ${t.h}` : `${s.minutos} ${t.min}`}
        {s.luz === 'verde' ? '' : ` · ${motivo}`}
      </span>
    </span>
  );
}
