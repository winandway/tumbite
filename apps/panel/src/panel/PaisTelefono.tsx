import { useEffect } from 'react';
import { datosPais, nombrePais, type Idioma } from '@tumbite/compartido';

/**
 * C-TELEFONO-E164 (21 nov 2026): el país del celular en el registro del panel, como en las apps.
 * Arranca en el país desde donde se abre la página (lo dice el servidor) y se puede cambiar; con el
 * país puesto, el número se escribe como siempre («0424…») y se guarda con su código («+58…»).
 */
const ORDEN = ['VE', 'CO', 'PE', 'US', 'MX', 'CL'] as const;

const bandera = (iso: string) =>
  iso.toUpperCase().replace(/[A-Z]/g, (l) => String.fromCodePoint(0x1f1e6 + l.charCodeAt(0) - 65));

export function PaisTelefono({
  pais,
  alCambiar,
  idioma,
}: {
  pais: string;
  alCambiar: (pais: string) => void;
  idioma: Idioma;
}) {
  useEffect(() => {
    if (pais) return;
    let vivo = true;
    fetch('/datos/cuentas/pais-sugerido')
      .then((r) => (r.ok ? (r.json() as Promise<{ pais: string | null }>) : { pais: null }))
      .then((d) => {
        if (vivo && d.pais) alCambiar(d.pais);
      })
      .catch(() => {
        // Sin sugerencia: la persona elige el país o escribe el «+».
      });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir el formulario
  }, []);
  // «Código de país»: la etiqueta no repite «Celular» (la casilla del número se busca por ese nombre).
  const etiqueta = idioma === 'en' ? 'Country code' : 'Código de país';
  return (
    <label className="campo">
      <span>{etiqueta}</span>
      <select
        value={pais}
        onChange={(e) => alCambiar(e.target.value)}
        data-testid="pais-telefono"
        aria-label={etiqueta}
      >
        <option value="">{idioma === 'en' ? 'Choose the country' : 'Elige el país'}</option>
        {ORDEN.map((iso) => (
          <option key={iso} value={iso}>
            {bandera(iso)} {nombrePais(iso, idioma)} (+{datosPais(iso)?.prefijo})
          </option>
        ))}
      </select>
    </label>
  );
}
