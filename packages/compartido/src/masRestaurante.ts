import type { Idioma } from './idiomas';

/**
 * C-MAS-RESTAURANTE (30 oct 2026): la pestaña «Más» de la app del restaurante, como la de DoorDash
 * Merchant: primero lo del local (datos y horario, ganancias, reseñas, equipo, ajustes) y después la
 * ayuda (guías, soporte, términos). Cerrar sesión va al final, aparte; borrar la cuenta sigue dentro
 * de Configuración. Antes la pestaña solo tenía «Cerrar sesión» y unos tres puntos sueltos.
 */
export type OpcionMas = {
  id: string;
  titulo: string;
  ayuda: string;
  /** Página del sitio que abre; sin destino, la app decide (soporte por WhatsApp). */
  destino?: string;
};

const T = {
  es: {
    local: 'Tu restaurante',
    ayudaGrupo: 'Ayuda',
    restaurante: ['Datos y horario', 'Nombre, dirección, fotos y horas de atención'],
    ganancias: ['Ganancias', 'Ventas, depósitos y tu cuenta para cobrar'],
    resenas: ['Reseñas', 'Lo que dicen tus clientes y tus respuestas'],
    equipo: ['Equipo', 'Personas que pueden manejar tu restaurante'],
    configuracion: ['Configuración', 'Tu cuenta, contraseña y avisos'],
    guias: ['Guías', 'Cómo usar Divoox paso a paso'],
    soporte: ['Soporte', 'Escríbenos y te ayudamos'],
    legales: ['Términos y privacidad', 'Las reglas y cómo cuidamos tus datos'],
  },
  en: {
    local: 'Your restaurant',
    ayudaGrupo: 'Help',
    restaurante: ['Store info and hours', 'Name, address, photos and opening hours'],
    ganancias: ['Earnings', 'Sales, payouts and your payout account'],
    resenas: ['Reviews', 'What your customers say and your replies'],
    equipo: ['Team', 'People who can manage your restaurant'],
    configuracion: ['Settings', 'Your account, password and notifications'],
    guias: ['Guides', 'How to use Divoox step by step'],
    soporte: ['Support', 'Message us and we’ll help'],
    legales: ['Terms and privacy', 'The rules and how we protect your data'],
  },
} as const;

export function opcionesMasRestaurante(
  idioma: Idioma,
): { titulo: string; opciones: OpcionMas[] }[] {
  const t = idioma === 'en' ? T.en : T.es;
  const pre = idioma === 'en' ? '' : '/es';
  const textos = new Map<string, readonly [string, string]>([
    ['restaurante', t.restaurante],
    ['ganancias', t.ganancias],
    ['resenas', t.resenas],
    ['equipo', t.equipo],
    ['configuracion', t.configuracion],
    ['guias', t.guias],
    ['soporte', t.soporte],
    ['legales', t.legales],
  ]);
  const o = (id: string, destino?: string): OpcionMas => {
    const [titulo, ayuda] = textos.get(id) ?? [id, id];
    return destino ? { id, titulo, ayuda, destino } : { id, titulo, ayuda };
  };
  return [
    {
      titulo: t.local,
      opciones: [
        o('restaurante', '/panel/restaurant'),
        o('ganancias', '/panel/earnings'),
        o('resenas', '/panel/reviews'),
        o('equipo', '/panel/team'),
        o('configuracion', '/panel/settings'),
      ],
    },
    {
      titulo: t.ayudaGrupo,
      opciones: [o('guias', `${pre}/docs`), o('soporte'), o('legales', `${pre}/privacy`)],
    },
  ];
}
