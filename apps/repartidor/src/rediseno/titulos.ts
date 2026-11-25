import type { Idioma } from '@tumbite/compartido';

/**
 * C-REDISENO-DRIVER: el título de la cabecera blanca de cada pantalla de Driver. `null` = la pantalla
 * no lleva cabecera (el inicio va con el mapa a pantalla completa; la cuenta, con su propia cabecera
 * de perfil).
 */
const TITULOS: Record<string, { es: string; en: string } | null> = {
  inicio: null,
  cuenta: null,
  billetera: { es: 'Ganancias', en: 'Earnings' },
  avisos: { es: 'Avisos', en: 'Inbox' },
  datos: { es: 'Mis datos y vehículo', en: 'My details and vehicle' },
  pedidos: { es: 'Mis entregas', en: 'My deliveries' },
  calificaciones: { es: 'Mis calificaciones', en: 'My ratings' },
  miEquipo: { es: 'Mi equipo', en: 'My team' },
  miLinea: { es: 'Mi línea', en: 'My line' },
  asiTeVen: { es: 'Así te ven', en: 'How riders see you' },
  turnos: { es: 'Mis turnos', en: 'My shifts' },
  clientesFijos: { es: 'Clientes fijos', en: 'Regular riders' },
  seguridad: { es: 'Seguridad', en: 'Safety' },
  ayuda: { es: 'Ayuda', en: 'Help' },
  alta: { es: 'Activa tu cuenta', en: 'Activate your account' },
  vehiculo: { es: 'Vehículo', en: 'Vehicle' },
  agregar: { es: 'Agregar un servicio', en: 'Add a service' },
};

export function tituloDeVista(vista: string, idioma: Idioma): string | null {
  const t = new Map(Object.entries(TITULOS)).get(vista);
  if (!t) return null;
  return idioma === 'en' ? t.en : t.es;
}
