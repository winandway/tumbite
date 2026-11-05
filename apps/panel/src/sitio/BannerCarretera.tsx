import type { CSSProperties } from 'react';
import { useCiudadesEnVivo } from './ciudadesEnVivo';
import { DesfileFlota } from './DesfileFlota';

/**
 * Banner animado de la portada (pedido de Richard, 23 oct 2026): una franja fina, como un juego,
 * donde cruzan de derecha a izquierda una moto con la caja de Divoox y un carro con el logo,
 * mientras el logo de Divoox se mueve en el centro. Todo en código (SVG + CSS), sin fotos.
 * Con «reducir movimiento» activado en el teléfono o la computadora, todo queda quieto.
 */
/**
 * El banner arriba de todo de las páginas públicas (portada, «Cómo funciona», ciudades, países y
 * comidas): una sola pieza para que la web se sienta una sola (25 oct 2026).
 */
export function BannerArriba({
  idioma,
  lugar = 'Miami',
  activo: activoDado,
  estilo = 'desfile',
}: {
  idioma: 'es' | 'en';
  lugar?: string;
  activo?: boolean;
  /**
   * C-DESFILE-FLOTA (4 nov 2026, Richard): la avenida negra queda solo en «Cómo funciona»; en el
   * resto de las páginas va el desfile de la flota sobre la línea roja.
   */
  estilo?: 'avenida' | 'desfile';
}) {
  const estadoCiudad = useCiudadesEnVivo();
  // Sin dato de la página, el banner dice el estado real de Miami (interruptor del superadmin).
  const activo = activoDado ?? estadoCiudad({ slug: 'miami', estado: 'pronto' }) === 'activo';
  const lema = activo
    ? idioma === 'en'
      ? `Now in ${lugar}`
      : `Ya estamos en ${lugar}`
    : idioma === 'en'
      ? `Coming soon to ${lugar}`
      : `Muy pronto en ${lugar}`;
  const servicios = idioma === 'en' ? 'Food · Rides · Delivery' : 'Comida · Viajes · Envíos';
  if (estilo === 'desfile') return <DesfileFlota lema={lema} servicios={servicios} />;
  return (
    <div className="ld-banner ld-banner-arriba">
      <BannerCarretera lema={lema} servicios={servicios} />
    </div>
  );
}

/**
 * C-AVENIDA-DIVOOX (4 nov 2026, Richard: «que ninguna página tenga eso»): la flota real de Divoox
 * (fotos con fondo transparente, apps/panel/public/marca/vehiculos) cruza la avenida en dos carriles.
 * Adelante van a la izquierda; atrás, más chicos por la distancia, a la derecha (con el logo al
 * derecho). Cada carril a su velocidad, con rebote suave y sombra. El texto va arriba de la avenida,
 * para que ningún vehículo lo tape.
 */
const FLOTA: {
  nombre: string;
  sentido: 'izq' | 'der';
  segundos: number;
  retraso: number;
  alto: number;
}[] = [
  // En cada carril, todos a la misma velocidad y separados: nadie se monta sobre otro.
  { nombre: 'sedan', sentido: 'izq', segundos: 13, retraso: 0, alto: 1 },
  { nombre: 'moto', sentido: 'izq', segundos: 13, retraso: -4.4, alto: 1.05 },
  { nombre: 'camioneta', sentido: 'izq', segundos: 13, retraso: -8.8, alto: 1.15 },
  { nombre: 'compacto', sentido: 'der', segundos: 16, retraso: -1, alto: 0.95 },
  { nombre: 'robot', sentido: 'der', segundos: 16, retraso: -6.4, alto: 0.9 },
  { nombre: 'moto2', sentido: 'der', segundos: 16, retraso: -11.8, alto: 1 },
];

export function BannerCarretera({ lema, servicios }: { lema: string; servicios: string }) {
  return (
    <div className="ld-carretera" role="img" aria-label={`${lema}. ${servicios}`}>
      <div className="ld-carretera-ciudad" aria-hidden="true">
        {[46, 70, 38, 84, 56, 64, 42, 78, 50, 66, 40, 72].map((alto, i) => (
          <span key={i} style={{ height: `${alto}%` }} />
        ))}
      </div>
      <div className="ld-carretera-centro" aria-hidden="true">
        <img
          className="ld-carretera-logo"
          src="/marca/divoox-logo-oscuro.svg"
          alt=""
          width={180}
          height={44}
        />
        <span className="ld-carretera-lema">{lema}</span>
        <span className="ld-carretera-servicios">{servicios}</span>
      </div>
      <div className="ld-carretera-via" aria-hidden="true">
        {FLOTA.map((v) => (
          <span
            key={v.nombre}
            className={`ld-auto ld-auto-${v.sentido}`}
            data-vehiculo={v.nombre}
            style={
              {
                animationDuration: `${v.segundos}s`,
                animationDelay: `${v.retraso}s`,
                '--alto': v.alto,
              } as CSSProperties
            }
          >
            <img src={`/marca/vehiculos/${v.nombre}-${v.sentido}.webp`} alt="" />
          </span>
        ))}
      </div>
    </div>
  );
}
