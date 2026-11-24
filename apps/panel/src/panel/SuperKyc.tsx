import { useCallback, useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { type Idioma, enIdioma, tramoCoincidente } from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { AvisoFiltrosGuardados } from './AvisoFiltrosGuardados';
import { EtiquetaPrueba, FiltroCuentas } from './CuentasPrueba';
import { EncabezadoPagina } from './armazon/Piezas';
import { pedir } from './api';
import { HORAS_URGENTE, horasDesde } from './diseno/estados';
import { Insignia } from './diseno/Insignia';
import { fechaSuper } from './horario';
import {
  type Comprobacion,
  FotoGrande,
  InsigniasComprobacion,
  type ResumenCara,
  T_VERIFICACIONES,
  deTabla,
  enlaceFicha,
} from './KycPiezas';
import { RevisarKyc, aprobarIdentidad } from './SuperKycFicha';
import { usePreferencias } from './usePreferencias';
import './verificaciones.css';

/** Las iniciales de un nombre («María José Pérez» → «MP»), para el círculo sin foto. */
export function inicialesDe(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const primera = partes[0]?.charAt(0) ?? '';
  const ultima = partes.length > 1 ? (partes.at(-1)?.charAt(0) ?? '') : '';
  return `${primera}${ultima}`.toUpperCase() || '?';
}

const enPalabras = (tabla: Record<string, string>, clave: string) =>
  new Map(Object.entries(tabla)).get(clave) ?? clave;

/**
 * C-VERIFICACIONES-BANDEJA (22 nov 2026, Gerencia: «está mal organizada… un arreglo serio,
 * profesional») — todos los países. Verificaciones del superadmin:
 * - ARRIBA, lo primero, la lista de personas por verificar: miniatura (se abre en grande), nombre,
 *   ID, zona, cuánto lleva esperando y lo que dijo la comprobación automática de CADA foto.
 * - Pestañas Pendientes / Aprobadas / Rechazadas / Sin enviar (quien se registró y no mandó sus
 *   fotos, C-VERIFICACIONES-SIN-ENVIAR), buscador por todo desde la primera letra y filtros
 *   de zona y de cuentas reales o de prueba (se recuerdan por empleado).
 * - Las reglas y el gasto de la comprobación automática viven en «Configuración de verificaciones».
 * La comprobación automática nunca aprueba ni rechaza aquí: decide una persona.
 */

type Solicitud = {
  id: string;
  estado: string;
  nombre: string;
  correo: string;
  telefono: string;
  rol: string;
  codigo: string | null;
  restaurante: string | null;
  restauranteId?: string | null;
  enviado: string;
  revisado: string | null;
  motivo: string;
  lejos: boolean;
  zonaId: string;
  zona: string;
  esPrueba: boolean;
  miniatura: 'mini' | 'selfie' | null;
  comprobaciones: Comprobacion[];
  cara: ResumenCara;
  /** Solo en «Sin enviar»: cuándo creó la cuenta y qué le falta. */
  creado?: string;
  correoConfirmado?: boolean;
  fotosSubidas?: number;
  /** C-LLEGA-SOLO-A-REVISION: lo que le falta («Sin enviar»), con la misma lista del servidor. */
  falta?: string[];
  /** C-VERIFICACION-UNICA: lo que espera una decisión de esa persona y si está toda en verde. */
  porDecidir?: string[];
  enVerde?: boolean;
};
type Respuesta = {
  solicitudes: Solicitud[];
  siguiente: string | null;
  totales: Record<string, number> | null;
};
type Ciudad = { id: string; nombre: string; pais: string };

// C-VERIFICACIONES-SIN-ENVIAR: la cuarta pestaña son las cuentas que todavía no mandan sus fotos.
const ESTADOS = ['pendiente', 'aprobado', 'rechazado', 'sin_enviar'] as const;
/** El contador de «Sin enviar» se detiene en 100 en el servidor: se muestra «99+». */
const TOPE_SIN_ENVIAR = 100;
type Estado = (typeof ESTADOS)[number];
const leerEstado = (v: string | undefined): Estado =>
  (ESTADOS as readonly string[]).includes(v ?? '') ? (v as Estado) : 'pendiente';

/** El nombre con lo que coincidió con la búsqueda resaltado. */
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

/** Lo que tarda la búsqueda en salir mientras se escribe (sugiere desde la primera letra). */
export const ESPERA_BUSQUEDA_MS = 250;

/** Verificaciones: la bandeja y, con id, la ficha de una persona. */
export function SuperKyc({
  base,
  idioma,
  id,
}: {
  base: string;
  idioma: Idioma;
  id: string | null;
}) {
  if (id) return <RevisarKyc base={base} idioma={idioma} id={id} />;
  return <Bandeja base={base} idioma={idioma} />;
}

function Bandeja({ base, idioma }: { base: string; idioma: Idioma }) {
  const t = enIdioma(T_VERIFICACIONES, idioma);
  const pref = usePreferencias('verificaciones', {
    estado: 'pendiente',
    zona: '',
    cuentas: 'reales',
    orden: 'llegada',
  });
  const orden = pref.valores.orden === 'cerca' ? 'cerca' : 'llegada';
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [aprobando, setAprobando] = useState(false);
  const [avisoVerde, setAvisoVerde] = useState<{ ok: boolean; texto: string } | null>(null);
  const estado = leerEstado(pref.valores.estado);
  const zona = pref.valores.zona ?? '';
  const cuentas = pref.valores.cuentas || 'reales';
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  const [resultado, setResultado] = useState<{
    clave: string;
    r: Respuesta | null;
    error: boolean;
  } | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const [grande, setGrande] = useState<{ src: string; titulo: string } | null>(null);
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);

  // La búsqueda sale mientras se escribe, con un respiro corto (desde la primera letra).
  useEffect(() => {
    const reloj = setTimeout(() => setQ(texto.trim()), ESPERA_BUSQUEDA_MS);
    return () => clearTimeout(reloj);
  }, [texto]);

  useEffect(() => {
    pedir<{ ciudades: Ciudad[] }>('GET', '/datos/admin/horario/ciudades')
      .then((x) => setCiudades(Array.isArray(x?.ciudades) ? x.ciudades : []))
      .catch(() => setCiudades([]));
  }, []);

  const parametros = useCallback(
    (despues?: string) => {
      const p = new URLSearchParams({ estado, cuentas });
      if (estado === 'pendiente' && orden === 'cerca') p.set('orden', 'cerca');
      if (zona) p.set('zona', zona);
      if (q) p.set('q', q);
      if (despues) p.set('despues', despues);
      return p.toString();
    },
    [estado, cuentas, zona, q, orden],
  );

  const consulta = parametros();
  const clave = `${consulta}#${vuelta}`;
  useEffect(() => {
    let vivo = true; // una respuesta vieja (otra búsqueda) no pisa la última
    pedir<Respuesta>('GET', `/datos/admin/kyc?${consulta}`)
      .then((x) => {
        if (!vivo) return;
        setResultado({
          clave,
          error: false,
          r: {
            solicitudes: Array.isArray(x?.solicitudes) ? x.solicitudes : [],
            siguiente: x?.siguiente ?? null,
            totales: x?.totales ?? null,
          },
        });
      })
      .catch(() => {
        if (vivo) setResultado((ant) => ({ clave, error: true, r: ant?.r ?? null }));
      });
    return () => {
      vivo = false;
    };
  }, [consulta, clave]);
  const r = resultado?.r ?? null;
  const cargando = resultado?.clave !== clave;
  const error = resultado?.clave === clave && resultado.error;

  const verMas = () => {
    if (!r?.siguiente) return;
    pedir<Respuesta>('GET', `/datos/admin/kyc?${parametros(r.siguiente)}`)
      .then((x) =>
        setResultado((ant) =>
          ant?.r
            ? {
                ...ant,
                r: {
                  ...ant.r,
                  solicitudes: [...ant.r.solicitudes, ...(x?.solicitudes ?? [])],
                  siguiente: x?.siguiente ?? null,
                },
              }
            : ant,
        ),
      )
      .catch(() => setResultado((ant) => (ant ? { ...ant, error: true } : ant)));
  };

  const nombreDe = (e: Estado) =>
    e === 'pendiente'
      ? t.pendientes
      : e === 'aprobado'
        ? t.aprobadas
        : e === 'rechazado'
          ? t.rechazadas
          : t.sinEnviar;
  const cuantas = (e: Estado) => {
    const n = totales.get(e) ?? 0;
    return e === 'sin_enviar' && n >= TOPE_SIN_ENVIAR ? `${TOPE_SIN_ENVIAR - 1}+` : String(n);
  };
  const totales = new Map(Object.entries(r?.totales ?? {}));
  const lista = r?.solicitudes ?? [];
  const verdes = lista.filter((s) => s.enVerde && elegidos.has(s.id));
  // C-VERIFICACION-UNICA: aprobar varias identidades en verde sin entrar una por una (decide una
  // persona, con su confirmación; la IA nunca aprueba). Lo que falla se dice y lo demás queda.
  async function aprobarVerdes() {
    if (!verdes.length || aprobando) return;
    if (!window.confirm(t.confirmarVerdes(verdes.length))) return;
    setAprobando(true);
    setAvisoVerde(null);
    let hechas = 0;
    try {
      for (const s of verdes) {
        await aprobarIdentidad(s.id);
        hechas += 1;
      }
      setAvisoVerde({ ok: true, texto: t.verdesHechas(hechas) });
    } catch (x) {
      setAvisoVerde({
        ok: false,
        texto: t.verdesFallo(hechas, x instanceof Error ? x.message : String(x)),
      });
    } finally {
      setAprobando(false);
      setElegidos(new Set());
      setVuelta((v) => v + 1);
    }
  }
  const otras = ESTADOS.filter((e) => e !== estado && (totales.get(e) ?? 0) > 0);

  return (
    <section className="super kyc-bandeja-pantalla">
      <EncabezadoPagina titulo={t.titulo} detalle={t.detalle}>
        <Enlace a={`${base}/verifications/settings`} className="boton secundario chico">
          <Settings size={16} aria-hidden="true" /> {t.configuracion}
        </Enlace>
      </EncabezadoPagina>

      <div className="super-filtros" role="tablist" aria-label={t.titulo}>
        {ESTADOS.map((e) => (
          <button
            key={e}
            type="button"
            role="tab"
            aria-selected={estado === e}
            className={estado === e ? 'activa' : undefined}
            onClick={() => pref.cambiar('estado', e)}
          >
            {nombreDe(e)}
            {totales.has(e) ? ` (${cuantas(e)})` : ''}
          </button>
        ))}
      </div>

      {estado === 'sin_enviar' ? <p className="suave">{t.sinEnviarDetalle}</p> : null}

      <div className="super-busqueda kyc-busqueda" role="search">
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={t.buscar}
          aria-label={t.buscar}
          autoComplete="off"
        />
        <select
          value={zona}
          onChange={(e) => pref.cambiar('zona', e.target.value)}
          aria-label={t.zona}
          data-testid="filtro-zona"
        >
          <option value="">{t.todasZonas}</option>
          {ciudades.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} ({c.pais})
            </option>
          ))}
        </select>
        <FiltroCuentas
          valor={cuentas}
          cambiar={(v) => pref.cambiar('cuentas', v)}
          idioma={idioma}
        />
      </div>
      {estado === 'pendiente' ? (
        <div className="fila-botones kyc-verdes">
          <label>
            {t.orden}{' '}
            <select
              value={orden}
              onChange={(e) => pref.cambiar('orden', e.target.value)}
              data-testid="orden-bandeja"
            >
              <option value="llegada">{t.ordenLlegada}</option>
              <option value="cerca">{t.ordenCerca}</option>
            </select>
          </label>
          <button
            type="button"
            className="boton exito chico"
            disabled={!verdes.length || aprobando}
            onClick={() => void aprobarVerdes()}
            data-testid="aprobar-verdes"
          >
            {t.aprobarVerdes(verdes.length)}
          </button>
        </div>
      ) : null}
      {estado === 'pendiente' && lista.some((s) => s.enVerde) ? (
        <p className="pista">{t.aprobarVerdesAyuda}</p>
      ) : null}
      {avisoVerde ? (
        <p className={avisoVerde.ok ? 'texto-exito' : 'error-general'} role="status">
          {avisoVerde.texto}
        </p>
      ) : null}
      <AvisoFiltrosGuardados
        visible={pref.guardados}
        idioma={idioma}
        restablecer={pref.restablecer}
      />

      {error ? (
        <p className="error-general" role="alert">
          {t.error}{' '}
          <button type="button" className="enlace" onClick={() => setVuelta((v) => v + 1)}>
            {t.reintentar}
          </button>
        </p>
      ) : null}
      {!r && cargando ? <p role="status">{t.cargando}</p> : null}
      {r && q ? (
        <p className="suave" role="status" aria-live="polite">
          {t.resultados(lista.length, Boolean(r.siguiente))}
        </p>
      ) : null}
      {r && lista.length === 0 ? (
        <div className="kyc-vacio">
          <p>{q ? t.sinResultados : deTabla(t.vacio, estado)}</p>
          {otras.map((e) => (
            <p key={e}>
              {t.enOtra(totales.get(e) ?? 0, nombreDe(e))}{' '}
              <button type="button" className="enlace" onClick={() => pref.cambiar('estado', e)}>
                {t.verEn(nombreDe(e))}
              </button>
            </p>
          ))}
        </div>
      ) : null}

      <ul className="kyc-lista" data-testid="kyc-lista">
        {lista.map((s) => {
          const ficha = enlaceFicha(base, s);
          const sinEnviar = s.estado === 'sin_enviar';
          const horas = horasDesde(sinEnviar ? (s.creado ?? '') : s.enviado);
          // Quien no ha enviado no tiene fotos que revisar: su nombre lleva a su ficha completa.
          const destino = sinEnviar && ficha ? ficha : `${base}/verifications/${s.id}`;
          const src =
            s.miniatura === 'mini'
              ? `/datos/admin/kyc/${s.id}/foto/selfie?mini=1`
              : s.miniatura === 'selfie'
                ? `/datos/admin/kyc/${s.id}/foto/selfie`
                : null;
          return (
            <li key={s.id} className="kyc-fila" data-testid="kyc-fila">
              {estado === 'pendiente' && s.enVerde ? (
                <input
                  type="checkbox"
                  className="kyc-elegir"
                  checked={elegidos.has(s.id)}
                  aria-label={t.elegir(s.nombre)}
                  onChange={(e) => {
                    const marcado = e.target.checked;
                    setElegidos((antes) => {
                      const nuevo = new Set(antes);
                      if (marcado) nuevo.add(s.id);
                      else nuevo.delete(s.id);
                      return nuevo;
                    });
                  }}
                />
              ) : null}
              {src ? (
                <button
                  type="button"
                  className="kyc-mini"
                  aria-label={t.verFoto(s.nombre)}
                  onClick={() =>
                    setGrande({ src: `/datos/admin/kyc/${s.id}/foto/selfie`, titulo: s.nombre })
                  }
                >
                  <img src={src} alt="" loading="lazy" />
                </button>
              ) : (
                // C-MINIATURA-SIEMPRE: sin foto (o sin permiso para verla), sus iniciales; nunca vacío.
                <span
                  className="kyc-mini kyc-mini-vacia"
                  aria-label={t.sinFoto}
                  role="img"
                  data-testid="kyc-iniciales"
                >
                  {inicialesDe(s.nombre)}
                </span>
              )}
              <div className="kyc-fila-cuerpo">
                <p className="kyc-fila-nombre">
                  <Enlace a={destino}>
                    <strong>
                      <Resaltado texto={s.nombre} q={q} />
                    </strong>
                  </Enlace>{' '}
                  <EtiquetaPrueba si={s.esPrueba} idioma={idioma} />
                </p>
                <p className="kyc-fila-datos">
                  {s.codigo ? (
                    <span className="super-id">
                      <Resaltado texto={s.codigo} q={q} />
                    </span>
                  ) : null}
                  <span>{s.rol === 'restaurante' ? t.restaurante : t.repartidor}</span>
                  <span>{s.zona || s.zonaId || t.sinZona}</span>
                  {s.restaurante ? <span>{s.restaurante}</span> : null}
                  <span className="kyc-fila-correo">{s.correo}</span>
                </p>
                <InsigniasComprobacion
                  comprobaciones={s.comprobaciones ?? []}
                  cara={s.cara ?? null}
                  idioma={idioma}
                />
                {estado === 'pendiente' && s.porDecidir?.length ? (
                  <ul className="kyc-comprobaciones" aria-label={t.porDecidir}>
                    {s.porDecidir.map((x) => (
                      <li key={x}>
                        <Insignia tono="pendiente">
                          {t.porDecidir}: {enPalabras(t.decidir, x)}
                        </Insignia>
                      </li>
                    ))}
                    {s.enVerde ? (
                      <li>
                        <Insignia tono="hecho">{t.enVerde}</Insignia>
                      </li>
                    ) : null}
                  </ul>
                ) : null}
                {sinEnviar ? (
                  <ul className="kyc-comprobaciones">
                    {s.falta?.length ? (
                      s.falta.map((f) => (
                        <li key={f}>
                          <Insignia tono="pendiente">{enPalabras(t.falta, f)}</Insignia>
                        </li>
                      ))
                    ) : (
                      <li>
                        <Insignia tono="pendiente">
                          {s.fotosSubidas ? t.fotosSinEnviar(s.fotosSubidas) : t.sinFotos}
                        </Insignia>
                      </li>
                    )}
                    {s.correoConfirmado === false ? (
                      <li>
                        <Insignia tono="apagado">{t.correoSinConfirmar}</Insignia>
                      </li>
                    ) : null}
                  </ul>
                ) : null}
                {s.estado === 'rechazado' && s.motivo ? (
                  <p className="suave">
                    {t.motivoRechazo}: {s.motivo}
                  </p>
                ) : null}
              </div>
              <div className="kyc-fila-lado">
                {sinEnviar ? (
                  <Insignia tono="apagado" testId="kyc-registro">
                    {t.registro(horas)}
                  </Insignia>
                ) : s.estado === 'pendiente' || estado === 'pendiente' ? (
                  <Insignia
                    tono={horas >= HORAS_URGENTE ? 'problema' : 'pendiente'}
                    testId="kyc-espera"
                  >
                    {t.espera(horas)}
                  </Insignia>
                ) : (
                  <Insignia estado={s.estado}>
                    {(s.estado === 'aprobado' ? t.aprobadaEl : t.rechazadaEl)(
                      fechaSuper(s.revisado ?? s.enviado, idioma, { estilo: 'fecha' }),
                    )}
                  </Insignia>
                )}
                <div className="kyc-fila-acciones">
                  {sinEnviar ? null : (
                    <Enlace a={`${base}/verifications/${s.id}`} className="boton secundario chico">
                      {t.revisar}
                    </Enlace>
                  )}
                  {ficha ? (
                    <Enlace
                      a={ficha}
                      className={sinEnviar ? 'boton secundario chico' : 'boton terciario chico'}
                    >
                      {t.ficha}
                    </Enlace>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {r?.siguiente ? (
        <button type="button" className="boton secundario" onClick={verMas}>
          {t.verMas}
        </button>
      ) : null}
      <FotoGrande foto={grande} cerrar={() => setGrande(null)} idioma={idioma} />
    </section>
  );
}
