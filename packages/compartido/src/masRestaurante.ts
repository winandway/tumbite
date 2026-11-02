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
  /** Página del sitio que abre; sin destino ni pantalla, soporte por WhatsApp. */
  destino?: string;
  /** C-APP-RESTAURANTE-PAR: pantalla de la propia app (sin salir al panel web). */
  pantalla?:
    | 'resenas'
    | 'horario'
    | 'restaurante'
    | 'ganancias'
    | 'promociones'
    | 'equipo'
    | 'configuracion';
};

const T = {
  es: {
    local: 'Tu restaurante',
    ayudaGrupo: 'Ayuda',
    restaurante: ['Datos del restaurante', 'Nombre, dirección, fotos y cobros'],
    horario: ['Horario y cierres', 'Horas de cada día, festivos y vacaciones'],
    ganancias: ['Ganancias', 'Ventas, depósitos y tu cuenta para cobrar'],
    resenas: ['Reseñas', 'Lo que dicen tus clientes y tus respuestas'],
    promociones: ['Promociones', 'Descuentos y envío gratis que pagas tú'],
    equipo: ['Equipo', 'Personas que pueden manejar tu restaurante'],
    configuracion: ['Configuración', 'Tu cuenta, contraseña y avisos'],
    guias: ['Guías', 'Cómo usar Divoox paso a paso'],
    soporte: ['Soporte', 'Escríbenos y te ayudamos'],
    legales: ['Términos y privacidad', 'Las reglas y cómo cuidamos tus datos'],
  },
  en: {
    local: 'Your restaurant',
    ayudaGrupo: 'Help',
    restaurante: ['Store info', 'Name, address, photos and payouts'],
    horario: ['Hours and closures', 'Hours for each day, holidays and time off'],
    ganancias: ['Earnings', 'Sales, payouts and your payout account'],
    resenas: ['Reviews', 'What your customers say and your replies'],
    promociones: ['Promotions', 'Discounts and free delivery you fund'],
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
    ['horario', t.horario],
    ['ganancias', t.ganancias],
    ['resenas', t.resenas],
    ['promociones', t.promociones],
    ['equipo', t.equipo],
    ['configuracion', t.configuracion],
    ['guias', t.guias],
    ['soporte', t.soporte],
    ['legales', t.legales],
  ]);
  const o = (id: string, destino?: string, pantalla?: OpcionMas['pantalla']): OpcionMas => {
    const [titulo, ayuda] = textos.get(id) ?? [id, id];
    return {
      id,
      titulo,
      ayuda,
      ...(destino ? { destino } : {}),
      ...(pantalla ? { pantalla } : {}),
    };
  };
  return [
    {
      titulo: t.local,
      opciones: [
        // C-MAS-EN-LA-APP: se abren dentro de la app, como DoorDash Merchant.
        o('restaurante', undefined, 'restaurante'),
        o('horario', undefined, 'horario'),
        o('ganancias', undefined, 'ganancias'),
        o('resenas', undefined, 'resenas'),
        // C-PROMO-RESTAURANTE (BRE-5): como «Promotions» de DoorDash Merchant.
        o('promociones', undefined, 'promociones'),
        o('equipo', undefined, 'equipo'),
        o('configuracion', undefined, 'configuracion'),
      ],
    },
    {
      titulo: t.ayudaGrupo,
      opciones: [o('guias', `${pre}/docs`), o('soporte'), o('legales', `${pre}/privacy`)],
    },
  ];
}
