import {
  BadgePercent,
  BookOpen,
  Clock,
  Search,
  Settings,
  Ban,
  Bell,
  Bike,
  Cake,
  ChartColumn,
  ChefHat,
  CircleCheck,
  CircleX,
  Eye,
  EyeOff,
  Gift,
  HandCoins,
  ImagePlus,
  Upload,
  Hand,
  Headset,
  LocateFixed,
  MapPin,
  Music,
  Navigation,
  Pizza,
  Receipt,
  ShieldCheck,
  Star,
  Ticket,
  Trophy,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

/** Íconos de línea de la marca. Nada de emojis en el producto: se ven poco serios. */
const ICONOS = {
  comision: BadgePercent,
  propina: HandCoins,
  factura: Receipt,
  soporte: Headset,
  alarma: Bell,
  agotado: Ban,
  regalo: Gift,
  resumen: ChartColumn,
  ver: Eye,
  ocultar: EyeOff,
  rechazar: CircleX,
  estrella: Star,
  nivel: Trophy,
  billetera: Wallet,
  ruta: Navigation,
  pin: MapPin,
  ubicacion: LocateFixed,
  pizza: Pizza,
  chef: ChefHat,
  moto: Bike,
  cumple: Cake,
  musica: Music,
  listo: CircleCheck,
  sellos: Ticket,
  saludo: Hand,
  proteccion: ShieldCheck,
  foto: ImagePlus,
  libro: BookOpen,
  reloj: Clock,
  buscar: Search,
  ajustes: Settings,
  subir: Upload,
} satisfies Record<string, LucideIcon>;

export type NombreIcono = keyof typeof ICONOS;

export function Icono({
  nombre,
  tamano = 22,
  className,
}: {
  nombre: NombreIcono;
  tamano?: number;
  className?: string;
}) {
  // eslint-disable-next-line security/detect-object-injection -- el nombre viene tipado del propio código
  const Componente = ICONOS[nombre];
  return (
    <Componente
      size={tamano}
      strokeWidth={2}
      aria-hidden="true"
      focusable="false"
      className={className ? `icono ${className}` : 'icono'}
    />
  );
}
