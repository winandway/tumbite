import { useCallback, useEffect, useState } from 'react';
import { type Idioma, enIdioma, tramoCoincidente } from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { pedir } from './api';
import { EtiquetaPrueba } from './CuentasPrueba';
import { HORAS_URGENTE, horasDesde } from './diseno/estados';
import { Insignia } from './diseno/Insignia';
import { FilaMoto, type Moto, T_MOTO } from './SuperMoto';
import { avisarDecision } from './sonarEvento';
import { MiniaturasVehiculo, VehiculoSinEnviar } from './VehiculoSinEnviar';
import './verificaciones.css';

/**
 * C-VERIFICACIONES-VEHICULOS (25 nov 2026, Richard: «Verificaciones verifica TODO… no hay dónde ver ni
 * aprobar vehículos, sus fotos, placa, papeles de la moto») — todos los países. La pestaña «Vehículos»
 * de Verificaciones, con dos listas:
 * - «Esperan revisión»: cada vehículo con su conductor, sus fotos y papeles en miniatura, y aprobar o
 *   rechazar ahí mismo (las rutas de siempre del equipo, con su auditoría). «Revisar todo» abre la
 *   ficha del conductor en Verificaciones: identidad, vehículo, papeles, casco y edad juntos.
 * - «Sin enviar»: quien registró su vehículo y no lo mandó a revisión. Le toca a él; Camila se lo
 *   recuerda sola (C-VEHICULO-SIN-ENVIAR).
 * Al decidir, el número del menú y el de la pestaña bajan enseguida.
 */

export const T_VEHICULOS = {
  es: {
    pestana: 'Vehículos',
    esperan: 'Esperan revisión',
    sinEnviar: 'Sin enviar',
    detalleEsperan:
      'Motos y carros que el conductor ya envió. Mira las fotos y los papeles y aprueba o rechaza aquí mismo.',
    detalleSinEnviar:
      'Lo registraron y no lo han enviado a revisión: todavía no hay nada que aprobar. Camila les recuerda enviarlo.',
    vacioEsperan: 'No hay vehículos esperando revisión.',
    vacioSinEnviar: 'No hay vehículos registrados sin enviar.',
    sinResultados: 'Ningún vehículo coincide con la búsqueda.',
    cargando: 'Cargando los vehículos…',
    error: 'No pudimos traer los vehículos. Revisa tu conexión.',
    reintentar: 'Reintentar',
    revisarTodo: 'Revisar todo del conductor',
    ficha: 'Ficha',
    espera: (h: number) =>
      h < 1
        ? 'Espera desde hace menos de 1 h'
        : h < 48
          ? `Espera hace ${h} h`
          : `Espera hace ${Math.floor(h / 24)} días`,
    registrado: (h: number) =>
      h < 24
        ? `Lo registró hace ${Math.max(1, h)} h`
        : `Lo registró hace ${Math.floor(h / 24)} días`,
    camila: 'Camila le recuerda enviarlo',
    papelesSubidos: (n: number) =>
      n === 0
        ? 'Sin fotos ni papeles subidos'
        : n === 1
          ? '1 foto o papel subido'
          : `${n} fotos o papeles subidos`,
    sinZona: 'Sin ciudad',
    placa: 'Placa',
  },
  en: {
    pestana: 'Vehicles',
    esperan: 'Waiting for review',
    sinEnviar: 'Not sent',
    detalleEsperan:
      'Motorcycles and cars the driver already sent. Look at the photos and documents and approve or reject right here.',
    detalleSinEnviar:
      'They registered it and haven’t sent it for review: there is nothing to approve yet. Camila reminds them to send it.',
    vacioEsperan: 'No vehicles waiting for review.',
    vacioSinEnviar: 'No registered vehicles left unsent.',
    sinResultados: 'No vehicle matches the search.',
    cargando: 'Loading vehicles…',
    error: 'We couldn’t load the vehicles. Check your connection.',
    reintentar: 'Try again',
    revisarTodo: 'Review everything for this driver',
    ficha: 'Profile',
    espera: (h: number) =>
      h < 1
        ? 'Waiting less than 1 h'
        : h < 48
          ? `Waiting ${h} h`
          : `Waiting ${Math.floor(h / 24)} days`,
    registrado: (h: number) =>
      h < 24 ? `Registered ${Math.max(1, h)} h ago` : `Registered ${Math.floor(h / 24)} days ago`,
    camila: 'Camila reminds them to send it',
    papelesSubidos: (n: number) =>
      n === 0
        ? 'No photos or documents uploaded'
        : n === 1
          ? '1 photo or document uploaded'
          : `${n} photos or documents uploaded`,
    sinZona: 'No city',
    placa: 'Plate',
  },
};

export type ListaVehiculos = 'en_revision' | 'registrado';
type Vehiculo = Moto & {
  conductor_id: string;
  codigo?: string | null;
  zona?: string | null;
  es_prueba?: number;
  creado_en?: string;
  actualizado_en?: string;
};
type Respuesta = {
  vehiculos: Vehiculo[];
  totales: { en_revision: number; registrado: number } | null;
};

/** Los filtros de la bandeja (los mismos de las otras pestañas) en la consulta de vehículos. */
export function consultaVehiculos(f: {
  estado: ListaVehiculos;
  cuentas: string;
  zona: string;
  q: string;
}): string {
  const p = new URLSearchParams({ estado: f.estado, cuentas: f.cuentas || 'reales' });
  if (f.zona) p.set('zona', f.zona);
  if (f.q) p.set('q', f.q);
  return p.toString();
}

/** El total de vehículos que esperan revisión, para el título de la pestaña. */
export function useTotalVehiculos(cuentas: string, zona: string, vuelta: number) {
  const [total, setTotal] = useState<number | null>(null);
  useEffect(() => {
    let vivo = true;
    pedir<Respuesta>(
      'GET',
      `/datos/admin/vehiculos?${consultaVehiculos({ estado: 'en_revision', cuentas, zona, q: '' })}`,
    )
      .then((r) => vivo && setTotal(r?.totales?.en_revision ?? null))
      .catch(() => vivo && setTotal(null));
    return () => {
      vivo = false;
    };
  }, [cuentas, zona, vuelta]);
  return total;
}

function Resaltado({ texto, q }: { texto: string; q: string }) {
  const tramo = q ? tramoCoincidente(texto, q) : null;
  if (!tramo) return <>{texto}</>;
  return (
    <>
      {texto.slice(0, tramo[0])}
      <mark>{texto.slice(tramo[0], tramo[1])}</mark>
      {texto.slice(tramo[1])}
    </>
  );
}

export function VerificacionesVehiculos({
  base,
  idioma,
  q,
  zona,
  cuentas,
  lista: listaElegida,
  cambiarLista,
  alCambiar,
}: {
  base: string;
  idioma: Idioma;
  q: string;
  zona: string;
  cuentas: string;
  /** La lista elegida (se recuerda con las demás preferencias de Verificaciones). */
  lista: string;
  cambiarLista: (l: ListaVehiculos) => void;
  /** Algo se decidió: la bandeja vuelve a contar su pestaña. */
  alCambiar?: () => void;
}) {
  const t = enIdioma(T_VEHICULOS, idioma);
  const tm = enIdioma(T_MOTO, idioma);
  const lista: ListaVehiculos = listaElegida === 'registrado' ? 'registrado' : 'en_revision';
  const [vuelta, setVuelta] = useState(0);
  const [r, setR] = useState<{ clave: string; datos: Respuesta | null; error: boolean } | null>(
    null,
  );
  const consulta = consultaVehiculos({ estado: lista, cuentas, zona, q });
  const clave = `${consulta}#${vuelta}`;
  useEffect(() => {
    let vivo = true;
    pedir<Respuesta>('GET', `/datos/admin/vehiculos?${consulta}`)
      .then((x) => {
        if (!vivo) return;
        setR({
          clave,
          error: false,
          datos: {
            vehiculos: Array.isArray(x?.vehiculos)
              ? x.vehiculos.filter((v) => Array.isArray(v?.documentos))
              : [],
            totales: x?.totales ?? null,
          },
        });
      })
      .catch(() => vivo && setR((a) => ({ clave, error: true, datos: a?.datos ?? null })));
    return () => {
      vivo = false;
    };
  }, [consulta, clave]);
  const decidido = useCallback(() => {
    setVuelta((v) => v + 1);
    avisarDecision();
    alCambiar?.();
  }, [alCambiar]);

  const datos = r?.datos ?? null;
  const vehiculos = datos?.vehiculos ?? [];
  const totales = datos?.totales;
  const cargando = r?.clave !== clave;
  return (
    <div className="kyc-vehiculos" data-testid="verificaciones-vehiculos">
      <div className="super-filtros kyc-sub" role="tablist" aria-label={t.pestana}>
        {(['en_revision', 'registrado'] as const).map((l) => (
          <button
            key={l}
            type="button"
            role="tab"
            aria-selected={lista === l}
            className={lista === l ? 'activa' : undefined}
            onClick={() => cambiarLista(l)}
            data-testid={`vehiculos-${l}`}
          >
            {l === 'en_revision' ? t.esperan : t.sinEnviar}
            {totales ? ` (${l === 'en_revision' ? totales.en_revision : totales.registrado})` : ''}
          </button>
        ))}
      </div>
      <p className="suave">{lista === 'en_revision' ? t.detalleEsperan : t.detalleSinEnviar}</p>
      {r?.error && r.clave === clave ? (
        <p className="error-general" role="alert">
          {t.error}{' '}
          <button type="button" className="enlace" onClick={() => setVuelta((v) => v + 1)}>
            {t.reintentar}
          </button>
        </p>
      ) : null}
      {!datos && cargando ? <p role="status">{t.cargando}</p> : null}
      {datos && vehiculos.length === 0 ? (
        <div className="kyc-vacio">
          <p>{q ? t.sinResultados : lista === 'en_revision' ? t.vacioEsperan : t.vacioSinEnviar}</p>
        </div>
      ) : null}
      <ul className="kyc-lista" data-testid="vehiculos-lista">
        {vehiculos.map((v) => {
          const horas = horasDesde(
            lista === 'registrado' ? (v.creado_en ?? '') : (v.actualizado_en ?? ''),
          );
          return (
            <li key={v.id} className="kyc-vehiculo" data-testid="vehiculo-fila">
              <div className="kyc-vehiculo-cabeza">
                <p className="kyc-fila-nombre">
                  <Enlace a={`${base}/verifications/${v.conductor_id}`}>
                    <strong>
                      <Resaltado texto={v.conductor} q={q} />
                    </strong>
                  </Enlace>{' '}
                  <EtiquetaPrueba si={Boolean(v.es_prueba)} idioma={idioma} />
                </p>
                <p className="kyc-fila-datos">
                  {v.codigo ? (
                    <span className="super-id">
                      <Resaltado texto={v.codigo} q={q} />
                    </span>
                  ) : null}
                  <span>{v.zona || t.sinZona}</span>
                  <span>
                    {t.placa}: <Resaltado texto={v.placa || '—'} q={q} />
                  </span>
                </p>
                <div className="kyc-fila-lado">
                  {lista === 'registrado' ? (
                    <Insignia tono="apagado">{t.registrado(horas)}</Insignia>
                  ) : (
                    <Insignia tono={horas >= HORAS_URGENTE ? 'problema' : 'pendiente'}>
                      {t.espera(horas)}
                    </Insignia>
                  )}
                  <div className="kyc-fila-acciones">
                    <Enlace
                      a={`${base}/verifications/${v.conductor_id}`}
                      className="boton secundario chico"
                    >
                      {t.revisarTodo}
                    </Enlace>
                    <Enlace
                      a={`${base}/drivers/${v.conductor_id}`}
                      className="boton terciario chico"
                    >
                      {t.ficha}
                    </Enlace>
                  </div>
                </div>
              </div>
              <MiniaturasVehiculo v={v} idioma={idioma} />
              {lista === 'en_revision' ? (
                <ul className="lista">
                  <FilaMoto
                    key={`${v.id}-${v.estado}-${v.documentos.map((d) => d.estado).join('')}`}
                    m={v}
                    idioma={idioma}
                    t={tm}
                    alCambiar={decidido}
                  />
                </ul>
              ) : (
                <VehiculoSinEnviar
                  key={`${v.id}-${v.documentos.map((d) => d.estado).join('')}`}
                  v={v}
                  idioma={idioma}
                  alCambiar={decidido}
                  conMiniaturas={false}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
