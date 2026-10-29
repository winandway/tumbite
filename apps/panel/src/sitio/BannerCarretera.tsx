import { useCiudadesEnVivo } from './ciudadesEnVivo';

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
}: {
  idioma: 'es' | 'en';
  lugar?: string;
  activo?: boolean;
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
  return (
    <div className="ld-banner ld-banner-arriba">
      <BannerCarretera
        lema={lema}
        servicios={idioma === 'en' ? 'Food · Rides · Delivery' : 'Comida · Viajes · Envíos'}
      />
    </div>
  );
}

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
      <div className="ld-carretera-via" aria-hidden="true" />
      <Moto />
      <Carro />
    </div>
  );
}

/** Moto mirando a la izquierda (va hacia allá), con la caja roja de Divoox atrás. */
function Moto() {
  return (
    <svg
      className="ld-vehiculo ld-moto"
      viewBox="0 0 120 80"
      width={112}
      height={75}
      aria-hidden="true"
    >
      <rect x="66" y="12" width="36" height="30" rx="4" fill="#F20D20" />
      <image href="/marca/divoox-isotipo-blanco.svg" x="72" y="16" width="24" height="22" />
      <path d="M20 58 L40 40 L84 40 L98 58 Z" fill="#FFFFFF" />
      <path
        d="M30 46 L22 34 L14 34"
        stroke="#FFFFFF"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M50 40 L56 24 L68 24 L70 40 Z" fill="#101010" stroke="#FFFFFF" strokeWidth="1.5" />
      <circle cx="58" cy="16" r="9" fill="#F20D20" stroke="#FFFFFF" strokeWidth="1.5" />
      <rect x="49" y="13" width="7" height="5" rx="2" fill="#101010" />
      <g className="ld-rueda">
        <circle cx="24" cy="62" r="13" fill="#101010" stroke="#FFFFFF" strokeWidth="3" />
        <path d="M24 51 V73 M13 62 H35" stroke="#666B73" strokeWidth="2" />
      </g>
      <g className="ld-rueda">
        <circle cx="94" cy="62" r="13" fill="#101010" stroke="#FFFFFF" strokeWidth="3" />
        <path d="M94 51 V73 M83 62 H105" stroke="#666B73" strokeWidth="2" />
      </g>
    </svg>
  );
}

/** Carro blanco mirando a la izquierda, con el logo de Divoox en la puerta. */
function Carro() {
  return (
    <svg
      className="ld-vehiculo ld-carro"
      viewBox="0 0 170 70"
      width={150}
      height={62}
      aria-hidden="true"
    >
      <path d="M8 50 L12 34 L44 30 L62 12 L118 12 L140 30 L162 36 L164 50 Z" fill="#FFFFFF" />
      <path d="M50 30 L66 16 L88 16 L88 30 Z M94 30 L94 16 L114 16 L130 30 Z" fill="#101010" />
      <rect x="8" y="40" width="156" height="4" fill="#F20D20" />
      <image href="/marca/divoox-isotipo.svg" x="98" y="30" width="16" height="15" />
      <rect x="6" y="36" width="6" height="5" rx="1" fill="#FFFFFF" stroke="#666B73" />
      <g className="ld-rueda">
        <circle cx="40" cy="52" r="12" fill="#101010" stroke="#666B73" strokeWidth="3" />
        <path d="M40 42 V62 M30 52 H50" stroke="#666B73" strokeWidth="2" />
      </g>
      <g className="ld-rueda">
        <circle cx="134" cy="52" r="12" fill="#101010" stroke="#666B73" strokeWidth="3" />
        <path d="M134 42 V62 M124 52 H144" stroke="#666B73" strokeWidth="2" />
      </g>
    </svg>
  );
}
