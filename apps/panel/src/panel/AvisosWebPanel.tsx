import { useEffect, useState } from 'react';
import type { Usuario } from '@tumbite/compartido';
import {
  activarAvisosWeb,
  darDeBajaAvisosWeb,
  entornoActual,
  estadoAvisosWeb,
  guardarLocal,
  leerLocal,
  llaveDescartada,
  suscribirAvisosWeb,
  textoTarjetaAvisosWeb,
  textosAvisosWeb,
  type EstadoAvisosWeb,
} from '@tumbite/compartido/src/avisosWeb';
import { api } from './api';

/**
 * C-AVISOS-WEB (14 nov 2026) — todos los países. Los avisos del navegador también en el panel del
 * restaurante en computadora (/panel/orders), donde muchos restaurantes trabajan: la explicación
 * previa y el permiso solo al tocar el botón. Si el permiso ya estaba dado, la suscripción se renueva
 * sola (sin escribir si no cambió). El trabajador de avisos se sirve en /panel/avisos-sw.js.
 */
const LLAVE_COMPILADA = import.meta.env.VITE_VAPID_PUBLIC_KEY || undefined;

export function AvisosWebPanel({ usuario, idioma }: { usuario: Usuario; idioma: 'es' | 'en' }) {
  const [estado, setEstado] = useState<EstadoAvisosWeb | 'error'>(() =>
    estadoAvisosWeb(entornoActual()),
  );
  const [descartada, setDescartada] = useState(
    () => leerLocal(llaveDescartada(usuario.id, 'panel')) === '1',
  );
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    if (estadoAvisosWeb(entornoActual()) !== 'permitido') return;
    void suscribirAvisosWeb(api, usuario.id, LLAVE_COMPILADA).catch((e: unknown) =>
      console.warn('avisos web: no se pudo renovar la suscripción', e),
    );
  }, [usuario.id]);
  if (descartada || estado === 'no-aplica' || estado === 'sin-soporte' || estado === 'permitido')
    return null;
  const t = textosAvisosWeb(idioma);
  const texto = textoTarjetaAvisosWeb(idioma, 'panel');
  return (
    <div className="tarjeta" data-testid="avisos-web-panel" role="region" aria-label={texto.titulo}>
      <h2>{texto.titulo}</h2>
      <p>
        {estado === 'iphone-sin-inicio'
          ? t.iphone
          : estado === 'bloqueado'
            ? t.bloqueado
            : estado === 'error'
              ? t.fallo
              : texto.cuerpo}
      </p>
      {estado === 'pedir' || estado === 'error' ? (
        <button
          type="button"
          className="boton"
          disabled={ocupado}
          onClick={() => {
            setOcupado(true);
            void activarAvisosWeb(api, usuario.id, LLAVE_COMPILADA).then((r) => {
              setOcupado(false);
              setEstado(r);
            });
          }}
        >
          {t.activar}
        </button>
      ) : null}{' '}
      <button
        type="button"
        className="boton secundario"
        onClick={() => {
          guardarLocal(llaveDescartada(usuario.id, 'panel'), '1');
          setDescartada(true);
        }}
      >
        {t.ahoraNo}
      </button>
    </div>
  );
}

/**
 * Revisión C-AVISOS-WEB: al cerrar sesión en el panel, este navegador deja de recibir los pedidos
 * (computadora compartida). Como mucho 3 segundos: si el servidor no contesta, se sale igual (el
 * servidor de todos modos la borra con la sesión).
 */
export async function darDeBajaAlSalir(): Promise<void> {
  await Promise.race([
    darDeBajaAvisosWeb(api),
    new Promise<void>((listo) => setTimeout(listo, 3000)),
  ]);
}
