import { useEffect, useState } from 'react';
import { type Idioma, enIdioma } from '@tumbite/compartido';
import { TEXTOS_SITIO } from './textos';

type Zona = { id: string; nombre: string; lat: number; lng: number; radioKm: number };

/** Ciudades que vienen después (se muestran como «próximamente»). Cambiar aquí cuando se decida. */
/** Contorno real simplificado de Florida (longitud, latitud), costa por costa. */
const FLORIDA: [number, number][] = [
  [-87.6, 31.0],
  [-85.0, 31.0],
  [-85.0, 30.7],
  [-82.2, 30.6],
  [-81.45, 30.7],
  [-81.4, 30.3],
  [-81.3, 29.9],
  [-81.0, 29.2],
  [-80.6, 28.4],
  [-80.4, 27.6],
  [-80.03, 26.7],
  [-80.1, 26.1],
  [-80.15, 25.76],
  [-80.4, 25.35],
  [-80.9, 25.1],
  [-81.1, 25.15],
  [-81.4, 25.85],
  [-81.8, 26.1],
  [-82.0, 26.6],
  [-82.6, 27.3],
  [-82.75, 27.9],
  [-82.7, 28.9],
  [-83.05, 29.15],
  [-83.6, 29.9],
  [-84.3, 30.05],
  [-85.0, 29.7],
  [-85.7, 30.15],
  [-86.5, 30.4],
  [-87.3, 30.35],
  [-87.6, 30.3],
];

const PROXIMAS = [
  { nombre: 'Orlando', lat: 28.5384, lng: -81.3789 },
  { nombre: 'Tampa', lat: 27.9506, lng: -82.4572 },
  { nombre: 'Ocala', lat: 29.1872, lng: -82.1401 },
];

/** Florida dibujada a mano (contorno simplificado) con las zonas activas y las próximas. */
export function MapaCobertura({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(TEXTOS_SITIO, idioma).mapa;
  const [zonas, setZonas] = useState<Zona[]>([
    { id: 'US-FL-MIAMI', nombre: 'Miami', lat: 25.7617, lng: -80.1918, radioKm: 40 },
  ]);

  useEffect(() => {
    fetch('/datos/zonas')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { zonas?: Zona[] } | null) => {
        if (d?.zonas?.length) setZonas(d.zonas);
      })
      .catch(() => undefined);
  }, []);

  // Proyección simple de Florida a un lienzo de 320 × 300 (lng -87.8…-79.8, lat 24.8…31.2).
  const x = (lng: number) => ((lng + 87.8) / 8) * 300 + 6;
  const y = (lat: number) => ((31.2 - lat) / 6.4) * 290 + 5;
  const contorno =
    FLORIDA.map(
      ([lng, lat], i) => `${i ? 'L' : 'M'}${x(lng).toFixed(1)} ${y(lat).toFixed(1)}`,
    ).join(' ') + ' Z';
  const activos = new Set(zonas.map((z) => z.nombre));

  return (
    <svg className="mapa-florida" viewBox="0 0 320 300" role="img" aria-label="Florida">
      <path d={contorno} fill="#FFFFFF" stroke="#101010" strokeWidth="2" strokeLinejoin="round" />
      {PROXIMAS.filter((p) => !activos.has(p.nombre)).map((p) => (
        <g key={p.nombre} transform={`translate(${x(p.lng)} ${y(p.lat)})`}>
          <circle r="7" fill="none" stroke="#101010" strokeDasharray="3 3" />
          <text x="-11" y="4" fontSize="11" fill="#101010" textAnchor="end">
            {p.nombre} · {t.proxima}
          </text>
        </g>
      ))}
      {zonas.map((z) => (
        <g key={z.id} transform={`translate(${x(z.lng)} ${y(z.lat)})`}>
          <circle r="22" fill="#F20D20" opacity="0.18" className="pulso" />
          <circle r="8" fill="#F20D20" />
          <text x="-14" y="-14" fontSize="12" fontWeight="800" fill="#101010" textAnchor="end">
            {z.nombre} · {t.activa}
          </text>
        </g>
      ))}
    </svg>
  );
}
