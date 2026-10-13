import { useCallback, useEffect, useId, useState } from 'react';
import { ErrorApi, type Idioma, enIdioma } from '@tumbite/compartido';
import { api, pedir } from './api';
import { reducirFoto } from './SubirFoto';

const T = {
  es: {
    titulo: 'Verificación del dueño y del local',
    ayuda:
      'Para publicar tu restaurante verificamos que el dueño es quien dice ser y que el local existe en la dirección registrada. Toma las fotos con la cámara del celular; solo las ve el equipo de Tumbite.',
    doc: 'Documento del dueño',
    docs: {
      licencia: 'Licencia de conducir',
      identificacion: 'Identificación oficial',
      pasaporte: 'Pasaporte',
    },
    frente: 'Documento (frente)',
    reverso: 'Documento (reverso)',
    selfie: 'Foto de la cara del dueño',
    local:
      'Foto del frente del local, con el letrero (tómala estando allí: usamos la ubicación del celular)',
    tomar: 'Tomar foto',
    otra: 'Tomar otra',
    lista: 'Lista',
    enviar: 'Enviar para revisión',
    sinUbicacion: 'Activa la ubicación del navegador para la foto del local.',
    estados: {
      sin_enviar: 'Sin enviar',
      pendiente: 'En revisión: te avisamos por correo',
      aprobado: 'Verificado',
      rechazado: 'Hay que repetir las fotos',
    },
    revalidar: 'Próxima revisión del local',
  },
  en: {
    titulo: 'Owner and storefront verification',
    ayuda:
      'To publish your restaurant we verify the owner is who they say and that the place exists at the registered address. Take the photos with your phone camera; only the Tumbite team sees them.',
    doc: 'Owner’s document',
    docs: { licencia: 'Driver’s license', identificacion: 'Government ID', pasaporte: 'Passport' },
    frente: 'Document (front)',
    reverso: 'Document (back)',
    selfie: 'Photo of the owner’s face',
    local:
      'Photo of the storefront with the sign (take it while you’re there: we use the phone’s location)',
    tomar: 'Take photo',
    otra: 'Retake',
    lista: 'Done',
    enviar: 'Send for review',
    sinUbicacion: 'Turn on browser location for the storefront photo.',
    estados: {
      sin_enviar: 'Not sent',
      pendiente: 'Under review: we’ll email you',
      aprobado: 'Verified',
      rechazado: 'Please retake the photos',
    },
    revalidar: 'Next storefront check',
  },
};

type Pieza = 'doc_frente' | 'doc_reverso' | 'selfie' | 'local';
type Kyc = {
  estado: 'sin_enviar' | 'pendiente' | 'aprobado' | 'rechazado';
  motivo: string;
  tiene: Record<Pieza, boolean>;
  proximaRevision: string | null;
};

function ubicacion(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((ok) => {
    if (!navigator.geolocation) return ok(null);
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => ok(null),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });
}

/** KYC del restaurante (dueño + local) desde el panel. Candado C-KYC. */
export function VerificacionPanel({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const id = useId();
  const [k, setK] = useState<Kyc | null>(null);
  const [docTipo, setDocTipo] = useState<'licencia' | 'identificacion' | 'pasaporte'>('licencia');
  const [subiendo, setSubiendo] = useState<Pieza | ''>('');
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    pedir<{ kyc: Kyc }>('GET', '/datos/kyc')
      .then((r) => setK(r.kyc))
      .catch(() => {});
  }, []);
  useEffect(cargar, [cargar]);

  async function subir(pieza: Pieza, archivo: File | undefined) {
    if (!archivo) return;
    setError('');
    setSubiendo(pieza);
    try {
      let q = '';
      if (pieza === 'local') {
        const u = await ubicacion();
        if (!u) {
          setError(t.sinUbicacion);
          return;
        }
        q = `?lat=${u.lat}&lng=${u.lng}`;
      }
      await api.subirFoto(await reducirFoto(archivo), `/datos/kyc/foto/${pieza}${q}`);
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setSubiendo('');
    }
  }

  async function enviar() {
    setError('');
    try {
      await pedir('POST', '/datos/kyc/enviar', { docTipo });
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  if (!k) return null;
  const tiene = new Map(Object.entries(k.tiene));
  const abierta = k.estado === 'sin_enviar' || k.estado === 'rechazado';
  const piezas: [Pieza, string, 'user' | 'environment'][] = [
    ['doc_frente', t.frente, 'environment'],
    ...(docTipo === 'pasaporte'
      ? []
      : ([['doc_reverso', t.reverso, 'environment']] as [Pieza, string, 'environment'][])),
    ['selfie', t.selfie, 'user'],
    ['local', t.local, 'environment'],
  ];
  return (
    <section className="tarjeta-form verificacion">
      <h2>{t.titulo}</h2>
      <p>
        <span className={`insignia ${k.estado === 'aprobado' ? 'insignia-aprobado' : ''}`}>
          {new Map(Object.entries(t.estados)).get(k.estado)}
        </span>
        {k.proximaRevision ? ` · ${t.revalidar}: ${k.proximaRevision}` : ''}
      </p>
      {k.estado === 'rechazado' && k.motivo && <p className="error-general">{k.motivo}</p>}
      {abierta && (
        <>
          <p>{t.ayuda}</p>
          <label className="campo">
            <span>{t.doc}</span>
            <select value={docTipo} onChange={(e) => setDocTipo(e.target.value as typeof docTipo)}>
              {Object.entries(t.docs).map(([v, n]) => (
                <option key={v} value={v}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <ul className="verificacion-piezas">
            {piezas.map(([pieza, etiqueta, camara]) => (
              <li key={pieza}>
                <span>
                  {etiqueta} {tiene.get(pieza) ? <strong>· {t.lista}</strong> : null}
                </span>
                {/* Botón propio: el del navegador sale en el idioma de la computadora, no en el de la página. */}
                <label
                  htmlFor={`${id}-${pieza}`}
                  className={`boton boton-secundario verificacion-tomar${subiendo !== '' ? ' deshabilitado' : ''}`}
                >
                  {subiendo === pieza ? '…' : tiene.get(pieza) ? t.otra : t.tomar}
                </label>
                <input
                  id={`${id}-${pieza}`}
                  className="solo-lector"
                  type="file"
                  accept="image/*"
                  capture={camara}
                  disabled={subiendo !== ''}
                  aria-label={etiqueta}
                  onChange={(e) => void subir(pieza, e.target.files?.[0])}
                />
              </li>
            ))}
          </ul>
          {error && (
            <p className="error-general" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            className="boton"
            onClick={() => void enviar()}
            disabled={subiendo !== ''}
          >
            {t.enviar}
          </button>
        </>
      )}
    </section>
  );
}
