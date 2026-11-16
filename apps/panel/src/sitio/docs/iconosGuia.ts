import {
  Bell,
  Bike,
  CarTaxiFront,
  CalendarClock,
  ChartColumn,
  CircleHelp,
  Clock,
  CreditCard,
  DoorOpen,
  FileText,
  Flag,
  GraduationCap,
  Handshake,
  Heart,
  KeyRound,
  LifeBuoy,
  MapPin,
  MessageCircle,
  Package,
  PlugZap,
  Presentation,
  Printer,
  Receipt,
  Repeat,
  Search,
  Share2,
  ShieldCheck,
  ShoppingBag,
  ShoppingBasket,
  Sparkles,
  Star,
  Store,
  Tag,
  User,
  Users,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

/**
 * Docs más amigable (29 oct 2026, pedido de Richard): cada guía con su propio ícono, como en las
 * ayudas de los grandes. Se elige por el tema que dice su dirección; si no encaja, una hoja.
 */
const REGLAS: [RegExp, LucideIcon][] = [
  // C-SERVICIOS-CONECTADOS: conectarse a varios servicios y agregar uno con el perfil compartido.
  [/^online-for-several-services/, PlugZap],
  [/^add-a-service/, ShieldCheck],
  // C-DOCS-OPERACIONES: las guías del equipo de operaciones, cada una con su dibujo.
  [/^search-orders/, Search],
  [/^monitor-/, ChartColumn],
  [/^read-order/, FileText],
  [/^time-zone/, Clock],
  [/^add-team/, Users],
  [/^link-support/, LifeBuoy],
  // C-AUTORIZACION-VENCIDA: la tarjeta cuya autorización venció.
  [/^resolve-expired-card/, CreditCard],
  [/customers-presentation/, ShoppingBag],
  [/restaurants-presentation/, Store],
  [/salespeople-presentation/, Handshake],
  [/drivers-presentation/, Bike],
  [/presentation|course|training/, Presentation],
  // C-DOCS-SEMANA: el taxi y la moto con su propio dibujo.
  [/ride-car|drive-car/, CarTaxiFront],
  [/ride-moto|drive-moto/, Bike],
  // C-FOTO-PUERTA: la foto de la puerta (cliente y repartidor) con una puerta.
  [/door-photo/, DoorOpen],
  // C-MODERACION: reportar, bloquear y la bandeja de reportes, con una bandera.
  [/^report-|flagged/, Flag],
  [/schedule|shift|hours|holiday/, CalendarClock],
  [/reorder|again/, Repeat],
  [/group/, Users],
  [/share|tracking|track/, Share2],
  [/like/, Sparkles],
  [/favorite/, Heart],
  [/address|location|gps|area|map|pickup-point|route/, MapPin],
  [/coupon|reward|gift|bonus|promo/, Tag],
  [/apple-pay|pay-on|cash|payment/, CreditCard],
  [/wallet|earning|payout|calculator|top-up/, Wallet],
  [/shop|store|catalog|grocery/, ShoppingBasket],
  [/alert|notif/, Bell],
  [/problem|support|help|cant-continue|not-opening|not-receiving/, LifeBuoy],
  [/safety|verify|verification|background|id-check|age|password|confirm/, ShieldCheck],
  [/rate|rating|review|top-driver|levels/, Star],
  [/print/, Printer],
  [/pos-integration|api/, PlugZap],
  [/dashboard|manager|traffic|compare/, ChartColumn],
  [/menu|item|sold-out|out-of-stock|options|dietary|kitchen/, UtensilsCrossed],
  [/chat|call/, MessageCircle],
  [/flex|package|label|import/, Package],
  [/driver|offer|deliver|my-route|journey/, Bike],
  [/order|counter|receipt|cancel/, Receipt],
  [/search/, Search],
  [/franchise|restaurant-app|activation|get-started/, Store],
  [/team|account|create-account|delete/, User],
  [/how-to|faq/, CircleHelp],
  [/key/, KeyRound],
  [/learn|class/, GraduationCap],
];

export function iconoDeGuia(id: string): LucideIcon {
  return REGLAS.find(([r]) => r.test(id))?.[1] ?? FileText;
}

/**
 * C-DOCS-PAGINA-LIVIANA (16 nov 2026): cada página de Docs llevaba ~200 íconos dibujados completos
 * en la barra lateral (95 de sus 129 KB); con 519 páginas el paquete pasó el tope de la plataforma
 * (120 MB) y nada se publicaba. Ahora cada ícono distinto se dibuja UNA vez por página (un
 * «símbolo») y cada guía lo referencia por su nombre: se ve igual y la página pesa la mitad.
 */
export const ICONOS_GUIA: [string, LucideIcon][] = Object.entries({
  Bell,
  Bike,
  CarTaxiFront,
  CalendarClock,
  ChartColumn,
  CircleHelp,
  Clock,
  CreditCard,
  DoorOpen,
  FileText,
  Flag,
  GraduationCap,
  Handshake,
  Heart,
  KeyRound,
  LifeBuoy,
  MapPin,
  MessageCircle,
  Package,
  PlugZap,
  Presentation,
  Printer,
  Receipt,
  Repeat,
  Search,
  Share2,
  ShieldCheck,
  ShoppingBag,
  ShoppingBasket,
  Sparkles,
  Star,
  Store,
  Tag,
  User,
  Users,
  UtensilsCrossed,
  Wallet,
});

export function nombreIconoGuia(id: string): string {
  const icono = iconoDeGuia(id);
  return ICONOS_GUIA.find(([, c]) => c === icono)?.[0] ?? 'FileText';
}
