/**
 * C-FORMA-PAGO-TEXTO (14 nov 2026, todos los países): el nombre que ve la persona de cada forma de
 * pago y de cada tipo de cuenta de cobro, en español y en inglés. Nunca se pinta la clave interna
 * («pago_movil», «transferencia_repartidor»): toda pantalla, recibo, correo o reporte pasa por aquí.
 */
const NOMBRES = {
  tarjeta: { es: 'Tarjeta', en: 'Card' },
  efectivo: { es: 'Efectivo', en: 'Cash' },
  efectivo_usd: { es: 'Efectivo en dólares', en: 'Cash in US dollars' },
  pago_movil: { es: 'Pago móvil', en: 'Pago Móvil (mobile payment)' },
  transferencia_repartidor: { es: 'Transferencia', en: 'Bank transfer' },
  transferencia: { es: 'Transferencia', en: 'Bank transfer' },
  banco: { es: 'Cuenta bancaria', en: 'Bank account' },
  nequi: { es: 'Nequi', en: 'Nequi' },
  daviplata: { es: 'Daviplata', en: 'Daviplata' },
  zelle: { es: 'Zelle', en: 'Zelle' },
  saldo: { es: 'Saldo de la app', en: 'App balance' },
  otro: { es: 'Otro medio', en: 'Other method' },
} as const satisfies Record<string, { es: string; en: string }>;

export type ClaveFormaPago = keyof typeof NOMBRES;
export const CLAVES_FORMA_PAGO = Object.keys(NOMBRES) as ClaveFormaPago[];

/** «pago_movil» → «Pago móvil». Una clave desconocida sale legible (sin guiones bajos). */
export function nombreFormaPago(clave: string | null | undefined, idioma: string): string {
  const i = idioma === 'en' ? 'en' : 'es';
  const k = String(clave ?? '').trim();
  if (!k) return '';
  const fijo = new Map<string, { es: string; en: string }>(Object.entries(NOMBRES)).get(k);
  if (fijo) return i === 'en' ? fijo.en : fijo.es;
  const legible = k.replace(/_/g, ' ');
  return legible.charAt(0).toUpperCase() + legible.slice(1);
}
