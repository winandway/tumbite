import type { ReactNode } from 'react';
import { type Idioma, enIdioma } from '@tumbite/compartido';
import { TEXTOS_SITIO } from './textos';

/** Marco de teléfono para mostrar las pantallas reales de las apps en la landing. */
export function Telefono({
  children,
  etiqueta,
  inclinado,
}: {
  children: ReactNode;
  etiqueta: string;
  inclinado?: 'izq' | 'der';
}) {
  return (
    <figure className={`tel${inclinado ? ` tel-${inclinado}` : ''}`} aria-label={etiqueta}>
      <div className="tel-pantalla">
        <div className="tel-barra">
          <span>9:41</span>
          <span className="tel-isla" />
          <span>●●●</span>
        </div>
        <div className="tel-cabecera">
          <strong>Tumbite</strong>
          <span>🇺🇸 EN ▾</span>
        </div>
        <div className="tel-cuerpo">{children}</div>
      </div>
    </figure>
  );
}

/** Mapa ilustrado: calles, ruta punteada, restaurante, repartidor y casa. */
export function MapaRuta({ alto = 150 }: { alto?: number }) {
  return (
    <svg className="mapa-ruta" viewBox="0 0 260 150" height={alto} role="img" aria-label="Mapa">
      <rect width="260" height="150" fill="#F3EEE6" />
      <path
        d="M0 40 H260 M0 95 H260 M60 0 V150 M150 0 V150 M215 0 V150"
        stroke="#fff"
        strokeWidth="10"
      />
      <path d="M0 125 C80 115 120 140 260 120" stroke="#CFE6F5" strokeWidth="14" fill="none" />
      <rect x="70" y="50" width="70" height="35" rx="4" fill="#E2EBD9" />
      <rect x="160" y="5" width="45" height="28" rx="4" fill="#E2EBD9" />
      <path
        className="ruta"
        d="M40 40 H150 V95 H215"
        stroke="#FF3008"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        strokeDasharray="8 6"
      />
      <g transform="translate(40 40)">
        <circle r="12" fill="#191919" />
        <text y="5" textAnchor="middle" fontSize="12">
          🍕
        </text>
      </g>
      <g className="moto" transform="translate(150 70)">
        <circle r="12" fill="#FF3008" />
        <text y="5" textAnchor="middle" fontSize="12">
          🛵
        </text>
      </g>
      <g transform="translate(215 95)">
        <circle r="12" fill="#FF3008" />
        <text y="5" textAnchor="middle" fontSize="12">
          🏠
        </text>
      </g>
    </svg>
  );
}

function Fila({ izq, der, fuerte }: { izq: string; der: string; fuerte?: boolean }) {
  return (
    <div className={`p-fila${fuerte ? ' p-fuerte' : ''}`}>
      <span>{izq}</span>
      <span>{der}</span>
    </div>
  );
}

export function PantallaLista({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(TEXTOS_SITIO, idioma).pantallas;
  const lista: [string, string, string][] = [
    ['🍕', 'Pizza Brava', '0.8 mi · 20'],
    ['🍕', 'Napoli Express', '1.2 mi · 25'],
    ['🌮', 'Taco Ritmo', '2.1 mi · 30'],
  ];
  return (
    <>
      <p className="p-titulo">{t.cerca}</p>
      {lista.map(([icono, nombre, extra]) => (
        <div className="p-tarjeta" key={nombre}>
          <span className="p-icono">{icono}</span>
          <div>
            <strong>{nombre}</strong>
            <small>
              {extra} {t.min}
            </small>
            <em>{t.abierto}</em>
          </div>
        </div>
      ))}
    </>
  );
}

export function PantallaCarrito({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(TEXTOS_SITIO, idioma).pantallas;
  return (
    <>
      <p className="p-titulo">{t.tuPedido}</p>
      <div className="p-tarjeta p-col">
        <Fila izq="2 × Pepperoni pizza" der="$25.00" />
        <Fila izq={t.envio} der="$2.99" />
        <Fila izq={t.servicio} der="$1.25" />
        <Fila izq={`${t.propina} 20%`} der="$5.00" />
        <Fila izq={t.total} der="$34.24" fuerte />
      </div>
      <div className="p-boton">{t.pagar} $34.24</div>
    </>
  );
}

export function PantallaSeguimiento({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(TEXTOS_SITIO, idioma).pantallas;
  return (
    <>
      <div className="p-oscura">
        <strong>{t.enCamino}</strong>
        <small>{t.llega}</small>
        <div className="p-progreso">
          <i className="lleno" />
          <i className="lleno" />
          <i className="lleno" />
          <i className="lleno" />
          <i />
        </div>
      </div>
      <MapaRuta alto={160} />
    </>
  );
}

export function PantallaOferta({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(TEXTOS_SITIO, idioma).pantallas;
  return (
    <>
      <div className="p-tarjeta p-col p-borde">
        <small className="p-rojo">{t.oferta}</small>
        <strong className="p-grande">{t.ganas} $9.00</strong>
        <small>{t.recoge}: Taco Ritmo · 2.4 mi</small>
      </div>
      <MapaRuta alto={110} />
      <div className="p-boton">{t.aceptar}</div>
      <div className="p-boton p-secundario">{t.noGracias}</div>
    </>
  );
}

export function PantallaAlarma({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(TEXTOS_SITIO, idioma).pantallas;
  return (
    <>
      <div className="p-tarjeta p-col p-borde p-latido">
        <small className="p-rojo">🔔 {t.nuevo} #A7F2</small>
        <strong>2 × Pepperoni pizza</strong>
        <strong>1 × Croquetas</strong>
      </div>
      <div className="p-boton">{t.aceptarMin}</div>
    </>
  );
}

export function PantallaBilletera({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(TEXTOS_SITIO, idioma).pantallas;
  return (
    <>
      <div className="p-oscura">
        <small>{t.saldo}</small>
        <strong className="p-grande p-oro">$186.40</strong>
        <small>🏆 {t.nivel} · 1,640 pts</small>
      </div>
      <div className="p-tarjeta p-col">
        <Fila izq="Taco Ritmo" der="+$9.00" />
        <Fila izq="Napoli Express" der="+$11.50" />
        <Fila izq="Pizza Brava" der="+$7.25" />
      </div>
      <div className="p-boton">{t.retirar}</div>
    </>
  );
}
