import { useState } from 'react';
import { type Idioma, enIdioma } from '@tumbite/compartido';

const T = {
  es: {
    placeholder: 'Ingresa tu dirección o código postal',
    ubicacion: 'Usar mi ubicación',
    buscar: 'Buscar',
    buscando: 'Buscando…',
    dentro: '¡Tumbite llega a tu zona! Anótate abajo y te avisamos el día del lanzamiento.',
    fuera:
      'Todavía no llegamos a tu zona. Anótate abajo: cuando haya suficientes vecinos, llegamos.',
    escrito: 'Anótate abajo con tu ciudad y te avisamos cuando lleguemos.',
    sinPermiso: 'No pudimos ver tu ubicación. Escribe tu ciudad abajo y listo.',
    vacio: 'Escribe tu dirección o toca «Usar mi ubicación».',
  },
  en: {
    placeholder: 'Enter your address or ZIP code',
    ubicacion: 'Use my location',
    buscar: 'Search',
    buscando: 'Searching…',
    dentro: 'Tumbite is coming to your area! Sign up below and we’ll let you know on launch day.',
    fuera: 'We’re not in your area yet. Sign up below: once enough neighbors join, we’ll be there.',
    escrito: 'Sign up below with your city and we’ll let you know when we arrive.',
    sinPermiso: 'We couldn’t get your location. Just type your city below.',
    vacio: 'Enter your address or tap “Use my location”.',
  },
};

/** Buscador de dirección estilo Uber Eats: dice si Tumbite llega a tu zona y te lleva a anotarte. */
export function Buscador({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [texto, setTexto] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [buscando, setBuscando] = useState(false);

  const irAlFormulario = () =>
    document.getElementById('comensales')?.scrollIntoView({ behavior: 'smooth' });

  function usarUbicacion() {
    if (!navigator.geolocation) return setMensaje(t.sinPermiso);
    setBuscando(true);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        try {
          const r = await fetch(
            `/datos/restaurantes?lat=${p.coords.latitude}&lng=${p.coords.longitude}`,
          );
          const d = (await r.json()) as { fueraDeZona?: boolean };
          setMensaje(d.fueraDeZona ? t.fuera : t.dentro);
        } catch {
          setMensaje(t.escrito);
        } finally {
          setBuscando(false);
          irAlFormulario();
        }
      },
      () => {
        setBuscando(false);
        setMensaje(t.sinPermiso);
      },
      { timeout: 10_000 },
    );
  }

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return setMensaje(t.vacio);
    setMensaje(t.escrito);
    irAlFormulario();
  }

  return (
    <div className="ld-buscador">
      <form onSubmit={buscar} role="search">
        <label className="ld-direccion">
          <span aria-hidden="true">📍</span>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={t.placeholder}
            aria-label={t.placeholder}
            autoComplete="street-address"
          />
        </label>
        <button type="submit" className="ld-buscar">
          {t.buscar}
        </button>
      </form>
      <button type="button" className="ld-ubicacion" onClick={usarUbicacion} disabled={buscando}>
        ➤ {buscando ? t.buscando : t.ubicacion}
      </button>
      {mensaje && (
        <p className="ld-mensaje" role="status">
          {mensaje}
        </p>
      )}
    </div>
  );
}
