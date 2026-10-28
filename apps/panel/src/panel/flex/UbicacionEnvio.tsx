import { useState } from 'react';
import { type Idioma, enIdioma, perfilFlex } from '@tumbite/compartido';
import { ElegirPunto } from '../../sitio/ElegirPunto';
import { crear, pedir } from '../api';
import { BASE_FLEX, mensajeDe } from './PanelEmpresa';

const T = {
  es: {
    titulo: 'Ubicación de entrega',
    estados: {
      confirmada: 'Confirmada',
      pendiente: 'Falta que el destinatario la confirme',
      sin_coordenadas: 'Solo dirección escrita',
    } as Record<string, string>,
    fuentes: {
      empresa: 'marcada por tu empresa',
      importacion: 'del archivo importado',
      app_cliente: 'confirmada en su app de Divoox',
      enlace_destinatario: 'confirmada por el destinatario con el enlace',
    } as Record<string, string>,
    enDivoox: 'El destinatario tiene la app de Divoox: ve el paquete en «Mis paquetes».',
    obligatoria:
      'En Venezuela la ruta no sale hasta que la ubicación esté confirmada (por el destinatario o con el pin).',
    pedir: 'Pedir la ubicación al destinatario',
    whatsapp: 'Enviar por WhatsApp',
    copiar: 'Copiar el mensaje',
    copiado: 'Mensaje copiado.',
    vence: 'El enlace vence en {n} días.',
    marcar: 'Marcar el punto yo mismo',
    cerrada: 'El paquete ya salió: la ubicación de entrega ya no se puede cambiar.',
    guardar: 'Guardar este punto',
    referencias: 'Punto de referencia',
    plus: 'Código plus',
  },
  en: {
    titulo: 'Delivery location',
    estados: {
      confirmada: 'Confirmed',
      pendiente: 'Waiting for the recipient to confirm it',
      sin_coordenadas: 'Written address only',
    } as Record<string, string>,
    fuentes: {
      empresa: 'marked by your company',
      importacion: 'from the imported file',
      app_cliente: 'confirmed in their Divoox app',
      enlace_destinatario: 'confirmed by the recipient with the link',
    } as Record<string, string>,
    enDivoox: 'The recipient has the Divoox app: they see the package in “My packages”.',
    obligatoria:
      'In Venezuela the route can’t leave until the location is confirmed (by the recipient or with the pin).',
    pedir: 'Ask the recipient for their location',
    whatsapp: 'Send on WhatsApp',
    copiar: 'Copy the message',
    copiado: 'Message copied.',
    vence: 'The link expires in {n} days.',
    marcar: 'Mark the spot myself',
    cerrada: 'The package already left: the delivery location can no longer change.',
    guardar: 'Save this spot',
    referencias: 'Landmark',
    plus: 'Plus code',
  },
};

export type UbicacionDeEnvio = {
  id: string;
  lat?: number | null;
  lng?: number | null;
  referencias?: string;
  ubicacionEstado?: string;
  ubicacionFuente?: string;
  destinatarioEnDivoox?: boolean;
  /** false cuando un paquete ya salió o terminó: el punto ya no cambia. */
  ubicacionEditable?: boolean;
};

/**
 * Divoox Flex · Fase 5 (C-FLEX-UBICACION): en el detalle del envío, cómo está la ubicación exacta,
 * el botón para pedírsela al destinatario por WhatsApp y el pin para marcarla la empresa misma.
 */
export function UbicacionEnvio({
  envio,
  empresaId,
  pais,
  idioma,
  alCambiar,
}: {
  envio: UbicacionDeEnvio;
  empresaId: string;
  pais: string;
  idioma: Idioma;
  alCambiar: () => void;
}) {
  const t = enIdioma(T, idioma);
  const perfil = perfilFlex(pais);
  const estados = new Map(Object.entries(t.estados));
  const fuentes = new Map(Object.entries(t.fuentes));
  const [enlace, setEnlace] = useState<{
    mensaje: string;
    whatsapp: string | null;
    venceEnDias: number;
  } | null>(null);
  const [marcando, setMarcando] = useState(false);
  const [punto, setPunto] = useState<{ lat: number; lng: number } | null>(
    envio.lat != null && envio.lng != null ? { lat: envio.lat, lng: envio.lng } : null,
  );
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const estado = envio.ubicacionEstado ?? 'sin_coordenadas';

  async function pedirEnlace() {
    setError('');
    try {
      setEnlace(
        await crear(`${BASE_FLEX}/empresas/${empresaId}/envios/${envio.id}/enlace-ubicacion`, {}),
      );
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  async function guardarPunto() {
    if (!punto) return;
    setError('');
    try {
      await pedir('PATCH', `${BASE_FLEX}/empresas/${empresaId}/envios/${envio.id}`, punto);
      setMarcando(false);
      alCambiar();
    } catch (x) {
      setError(mensajeDe(x));
    }
  }

  return (
    <div className="flex-tarjeta" data-testid="ubicacion-envio">
      <h2>{t.titulo}</h2>
      <p>
        <span className={`insignia ${estado === 'confirmada' ? 'insignia-aprobado' : ''}`}>
          {estados.get(estado) ?? estado}
        </span>
        {envio.ubicacionFuente ? ` · ${fuentes.get(envio.ubicacionFuente) ?? ''}` : ''}
      </p>
      {envio.referencias ? (
        <p>
          {t.referencias}: {envio.referencias}
        </p>
      ) : null}
      {envio.destinatarioEnDivoox ? <p className="pista">{t.enDivoox}</p> : null}
      {perfil.ubicacion === 'confirmada' && estado !== 'confirmada' ? (
        <p className="pista">{t.obligatoria}</p>
      ) : null}
      {envio.ubicacionEditable === false ? (
        <p className="pista">{t.cerrada}</p>
      ) : (
        <div className="flex-acciones">
          <button type="button" className="boton" onClick={() => void pedirEnlace()}>
            {t.pedir}
          </button>
          <button type="button" className="boton secundario" onClick={() => setMarcando((x) => !x)}>
            {t.marcar}
          </button>
        </div>
      )}
      {enlace ? (
        <div className="flex-tarjeta">
          <p>{enlace.mensaje}</p>
          <div className="flex-acciones">
            {enlace.whatsapp ? (
              <a className="boton" href={enlace.whatsapp} target="_blank" rel="noopener noreferrer">
                {t.whatsapp}
              </a>
            ) : null}
            <button
              type="button"
              className="boton secundario"
              onClick={() =>
                void navigator.clipboard
                  ?.writeText(enlace.mensaje)
                  .then(() => setAviso(t.copiado))
                  .catch(() => undefined)
              }
            >
              {t.copiar}
            </button>
          </div>
          <p className="pista">{t.vence.replace('{n}', String(enlace.venceEnDias))}</p>
        </div>
      ) : null}
      {marcando ? (
        <div>
          <ElegirPunto
            punto={punto}
            cambiar={setPunto}
            centro={perfil.centroMapa}
            pais={perfil.pais}
            idioma={idioma}
          />
          {punto ? (
            <button type="button" className="boton" onClick={() => void guardarPunto()}>
              {t.guardar}
            </button>
          ) : null}
        </div>
      ) : null}
      {aviso && <p role="status">{aviso}</p>}
      {error && (
        <p className="error-general" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
