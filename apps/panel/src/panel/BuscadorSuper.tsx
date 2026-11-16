import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import {
  ESTADO_CANCELADA,
  ErrorApi,
  type Idioma,
  NOMBRES_COMERCIO,
  enIdioma,
  formatearMonto,
  textoPlano,
  tramoCoincidente,
} from '@tumbite/compartido';
import { ir } from '../ruta';
import { pedir } from './api';
import { type GrupoMenu, IconoDe } from './armazon/menus';

/**
 * C-BUSCADOR-SERIO (15 nov 2026, pedido de Richard). Todos los países. El buscador fijo arriba de
 * todo el superadmin: pedidos, viajes, clientes, repartidores, restaurantes, vehículos y tickets
 * (y las secciones del menú), agrupados, con lo que coincidió resaltado. Atajos «/» y Ctrl/Cmd+K;
 * flechas, Enter y Escape. Sugiere desde la primera letra, con una pausa de 200 ms entre teclas y
 * cancelando la petición anterior. Lo escrito no se guarda en ningún lado.
 */
export const PAUSA_BUSCAR_MS = 200;

const T = {
  es: {
    buscar: 'Buscar en el superadmin',
    marcador: 'Pedido, cliente, teléfono o placa',
    atajo: 'Atajo: / o Ctrl+K',
    buscando: 'Buscando…',
    sinResultados:
      'No encontramos nada con eso. Prueba con el código del pedido, un teléfono o un correo.',
    avisoMonto: 'Los montos se buscan solo en los últimos 30 días.',
    irDirecto: 'Enter abre la ficha',
    grupos: {
      secciones: 'Ir a',
      pedidos: 'Pedidos',
      viajes: 'Viajes',
      clientes: 'Clientes',
      repartidores: 'Repartidores y conductores',
      restaurantes: 'Restaurantes y tiendas',
      vehiculos: 'Vehículos',
      tickets: 'Tickets',
    } as Record<string, string>,
    estados: {
      pago_pendiente: 'Esperando pago',
      pagado: 'Pagado',
      aceptado: 'En cocina',
      listo: 'Listo para recoger',
      en_camino: 'En camino',
      entregado: 'Entregado',
      cancelado: 'Cancelado',
      buscando: 'Buscando conductor',
      asignado: 'Conductor asignado',
      conductor_llego: 'Conductor llegó',
      en_curso: 'En curso',
      terminado: 'Terminado',
      terminada: 'Terminado',
      cancelada: 'Cancelado',
      no_show: 'No se presentó',
      sin_conductor: 'Sin conductor',
      pendiente: 'En revisión',
      aprobado: 'Aprobado',
      pausado: 'Pausado',
      rechazado: 'No aprobado',
      abierto: 'Abierto',
      respondido: 'Respondido',
      cerrado: 'Cerrado',
      registrado: 'Registrado',
      en_revision: 'En revisión',
      suspendido: 'Suspendido',
      vencido: 'Vencido',
      retirado: 'Retirado',
      eliminada: 'Cuenta eliminada',
    } as Record<string, string>,
    clases: {
      moto: 'Moto',
      carro: 'Carro',
      envios: 'Envío',
      scooter: 'Scooter',
      bicicleta: 'Bicicleta',
      a_pie: 'A pie',
      espera_comensal: 'Espera · cliente',
      espera_restaurante: 'Espera · restaurante',
      espera_repartidor: 'Espera · repartidor',
      franquicia: 'Franquicia',
      queja: 'Queja',
      soporte: 'Soporte',
    } as Record<string, string>,
  },
  en: {
    buscar: 'Search the admin',
    marcador: 'Order, customer, phone, or plate',
    atajo: 'Shortcut: / or Ctrl+K',
    buscando: 'Searching…',
    sinResultados: 'Nothing matches that. Try the order code, a phone number, or an email.',
    avisoMonto: 'Amounts are searched in the last 30 days only.',
    irDirecto: 'Press Enter to open it',
    grupos: {
      secciones: 'Go to',
      pedidos: 'Orders',
      viajes: 'Rides',
      clientes: 'Customers',
      repartidores: 'Drivers',
      restaurantes: 'Restaurants and stores',
      vehiculos: 'Vehicles',
      tickets: 'Tickets',
    } as Record<string, string>,
    estados: {
      pago_pendiente: 'Awaiting payment',
      pagado: 'Paid',
      aceptado: 'Being prepared',
      listo: 'Ready for pickup',
      en_camino: 'On the way',
      entregado: 'Delivered',
      cancelado: 'Canceled',
      buscando: 'Finding a driver',
      asignado: 'Driver assigned',
      conductor_llego: 'Driver arrived',
      en_curso: 'In progress',
      terminado: 'Completed',
      terminada: 'Completed',
      cancelada: 'Canceled',
      no_show: 'No-show',
      sin_conductor: 'No driver found',
      pendiente: 'Under review',
      aprobado: 'Approved',
      pausado: 'Paused',
      rechazado: 'Declined',
      abierto: 'Open',
      respondido: 'Answered',
      cerrado: 'Closed',
      registrado: 'Registered',
      en_revision: 'Under review',
      suspendido: 'Suspended',
      vencido: 'Expired',
      retirado: 'Retired',
      eliminada: 'Deleted account',
    } as Record<string, string>,
    clases: {
      moto: 'Moto',
      carro: 'Car',
      envios: 'Delivery',
      scooter: 'Scooter',
      bicicleta: 'Bicycle',
      a_pie: 'On foot',
      espera_comensal: 'Waitlist · customer',
      espera_restaurante: 'Waitlist · restaurant',
      espera_repartidor: 'Waitlist · driver',
      franquicia: 'Franchise',
      queja: 'Complaint',
      soporte: 'Support',
    } as Record<string, string>,
  },
};

/** El nombre de una clase (tipo de comercio, servicio, vehículo o ticket) en el idioma de la pantalla. */
function nombreClase(clase: string, idioma: Idioma, clases: Record<string, string>): string {
  const comercio = new Map(Object.entries(NOMBRES_COMERCIO)).get(clase);
  if (comercio) return idioma === 'en' ? comercio.en : comercio.es;
  return new Map(Object.entries(clases)).get(clase) ?? clase;
}

const EXITO = new Set(['entregado', 'terminado', 'terminada', 'aprobado', 'respondido']);
const PROBLEMA = new Set([
  'cancelado',
  'cancelada',
  'rechazado',
  'suspendido',
  'vencido',
  'no_show',
  'sin_conductor',
  'eliminada',
]);
const NEUTRO = new Set([
  'pago_pendiente',
  'pendiente',
  'registrado',
  'en_revision',
  'cerrado',
  'pausado',
  'retirado',
]);
/** Verde lo que salió bien, rojo los problemas, gris lo que espera o ya no cuenta. */
export function tonoEstado(
  estado: string | null | undefined,
): 'exito' | 'problema' | 'neutro' | 'vivo' {
  if (!estado) return 'neutro';
  if (EXITO.has(estado)) return 'exito';
  if (PROBLEMA.has(estado)) return 'problema';
  if (NEUTRO.has(estado)) return 'neutro';
  return 'vivo';
}

/** Fecha y hora cortas de una fecha de la base (UTC sin zona), en la hora de esta computadora. */
export function fechaYHora(fecha: string | null | undefined, idioma: Idioma): string {
  if (!fecha) return '';
  const d = new Date(`${fecha.replace(' ', 'T')}${/[zZ]|[+-]\d\d:?\d\d$/.test(fecha) ? '' : 'Z'}`);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleString(idioma === 'es' ? 'es-US' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** El texto con la parte que coincidió en negrita (sin mirar acentos ni mayúsculas). */
export function Resaltado({ texto, buscado }: { texto: string; buscado: string }) {
  const tramo = buscado ? tramoCoincidente(texto, buscado) : null;
  if (!tramo) return <>{texto}</>;
  const [a, b] = tramo;
  return (
    <>
      {texto.slice(0, a)}
      <mark>{texto.slice(a, b)}</mark>
      {texto.slice(b)}
    </>
  );
}

type Resultado = {
  id: string;
  titulo: string;
  detalle: string;
  estado: string | null;
  ciudad: string | null;
  enlace: string;
  coincide: string;
  clase?: string | null;
  fecha?: string | null;
  monto?: number | null;
  moneda?: string | null;
};
type Respuesta = {
  q: string;
  grupos: { tipo: string; resultados: Resultado[] }[];
  salto: string | null;
  avisoMonto: boolean;
};
type Opcion = {
  clave: string;
  grupo: string;
  a: string;
  resultado?: Resultado;
  icono?: string;
  texto?: string;
};

const escribiendoEn = (e: EventTarget | null) => {
  const x = e as HTMLElement | null;
  if (!x) return false;
  return x.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(x.tagName);
};

export function BuscadorSuper({
  base,
  idioma,
  grupos = [],
}: {
  /** La dirección secreta del superadmin (/panel/control-…). */
  base: string;
  idioma: Idioma;
  /** Las secciones del menú, para el grupo «Ir a». */
  grupos?: GrupoMenu[];
}) {
  const t = enIdioma(T, idioma);
  const id = useId();
  const casilla = useRef<HTMLInputElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState('');
  const [marcado, setMarcado] = useState(0);
  const corte = useRef<AbortController | null>(null);

  // Atajos: «/» (fuera de una casilla) y Ctrl/Cmd+K, desde cualquier pantalla del superadmin.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((k === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !escribiendoEn(e.target))) {
        e.preventDefault();
        casilla.current?.focus();
        casilla.current?.select();
        setAbierto(true);
      }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, []);

  // Cerrar al tocar fuera.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);

  // Buscar con una pausa entre teclas; la petición anterior se cancela.
  const q = texto.trim();
  useEffect(() => {
    corte.current?.abort();
    if (!q) {
      corte.current = null;
      return;
    }
    const control = new AbortController();
    corte.current = control;
    const reloj = setTimeout(() => {
      setBuscando(true);
      pedir<Respuesta>('GET', `/datos/admin/buscar?q=${encodeURIComponent(q)}`, undefined, {
        senal: control.signal,
      })
        .then((r) => {
          if (control.signal.aborted) return;
          setRespuesta(r);
          setError('');
          setMarcado(0);
        })
        .catch((e: unknown) => {
          if (control.signal.aborted || (e instanceof ErrorApi && e.estado === ESTADO_CANCELADA))
            return;
          setError(e instanceof ErrorApi ? e.message : String(e));
        })
        .finally(() => {
          if (!control.signal.aborted) setBuscando(false);
        });
    }, PAUSA_BUSCAR_MS);
    return () => {
      clearTimeout(reloj);
      control.abort();
    };
  }, [q]);

  const secciones = useMemo(() => {
    const plano = textoPlano(q);
    if (!plano) return [];
    return grupos
      .flatMap((g) => g.items.map((i) => ({ ...i, grupo: g.titulo })))
      .filter((i) => textoPlano(`${i.texto} ${i.grupo}`).includes(plano))
      .slice(0, 5);
  }, [grupos, q]);

  const vigente = respuesta && respuesta.q === q ? respuesta : null;
  const opciones: Opcion[] = useMemo(
    () => [
      ...secciones.map((s) => ({
        clave: `secciones-${s.clave}`,
        grupo: 'secciones',
        a: s.a,
        icono: s.clave,
        texto: s.texto,
      })),
      ...(vigente?.grupos ?? []).flatMap((g) =>
        g.resultados.map((r) => ({
          clave: `${g.tipo}-${r.id}`,
          grupo: g.tipo,
          a: `${base}${r.enlace}`,
          resultado: r,
        })),
      ),
    ],
    [secciones, vigente, base],
  );

  const elegir = useCallback((a: string) => {
    corte.current?.abort();
    setTexto('');
    setRespuesta(null);
    setAbierto(false);
    casilla.current?.blur();
    ir(a);
  }, []);

  const desplegado = abierto && q !== '';
  const idOpcion = (n: number) => `${id}-op-${n}`;
  return (
    <div className="pd-buscador bs" ref={caja} role="search">
      <Search size={18} aria-hidden="true" className="pd-buscador-lupa" />
      <input
        ref={casilla}
        type="search"
        role="combobox"
        aria-label={t.buscar}
        aria-expanded={desplegado}
        aria-controls={desplegado ? id : undefined}
        aria-autocomplete="list"
        aria-activedescendant={desplegado && opciones.length > 0 ? idOpcion(marcado) : undefined}
        aria-keyshortcuts="/ Control+K Meta+K"
        placeholder={t.marcador}
        title={t.atajo}
        value={texto}
        autoComplete="off"
        spellCheck={false}
        maxLength={80}
        onChange={(e) => {
          setTexto(e.target.value);
          setMarcado(0);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && opciones.length > 0) {
            e.preventDefault();
            setAbierto(true);
            setMarcado((m) => (m + 1) % opciones.length);
          } else if (e.key === 'ArrowUp' && opciones.length > 0) {
            e.preventDefault();
            setMarcado((m) => (m - 1 + opciones.length) % opciones.length);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (vigente?.salto) elegir(`${base}${vigente.salto}`);
            else {
              const o = opciones.at(marcado) ?? opciones[0];
              if (o) elegir(o.a);
            }
          } else if (e.key === 'Escape') {
            setAbierto(false);
            casilla.current?.blur();
          }
        }}
      />
      <kbd className="bs-atajo" aria-hidden="true">
        /
      </kbd>
      {desplegado ? (
        <div className="pd-flotante pd-buscador-caja bs-caja">
          {error ? (
            <p className="pd-flotante-vacio error-general" role="alert">
              {error}
            </p>
          ) : null}
          {vigente?.avisoMonto ? <p className="bs-aviso">{t.avisoMonto}</p> : null}
          {vigente?.salto ? <p className="bs-aviso">{t.irDirecto}</p> : null}
          {opciones.length === 0 && !error ? (
            <p className="pd-flotante-vacio" role="status">
              {buscando || !vigente ? t.buscando : t.sinResultados}
            </p>
          ) : null}
          {opciones.length > 0 ? (
            <ul role="listbox" id={id} aria-label={t.buscar}>
              {opciones.map((o, i) => {
                const titulo = i === 0 || opciones[i - 1]?.grupo !== o.grupo;
                const yo = i;
                const r = o.resultado;
                return (
                  <Fragment key={o.clave}>
                    {titulo ? (
                      <li role="presentation" className="bs-grupo">
                        {t.grupos[o.grupo] ?? o.grupo}
                      </li>
                    ) : null}
                    <li
                      id={idOpcion(yo)}
                      role="option"
                      aria-selected={yo === marcado}
                      className={`bs-opcion${r ? '' : ' bs-seccion'}${yo === marcado ? ' pd-opcion-activa' : ''}`}
                      onMouseEnter={() => setMarcado(yo)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => elegir(o.a)}
                    >
                      {r ? (
                        <>
                          <span className="bs-principal">
                            <strong>
                              <Resaltado texto={r.titulo} buscado={r.coincide} />
                            </strong>
                            <small>
                              {r.clase ? nombreClase(r.clase, idioma, t.clases) : null}
                              {r.clase && r.detalle ? ' · ' : null}
                              {r.detalle ? (
                                <Resaltado texto={r.detalle} buscado={r.coincide} />
                              ) : null}
                            </small>
                          </span>
                          <span className="bs-donde">
                            {r.estado ? (
                              <span className={`bs-estado bs-${tonoEstado(r.estado)}`}>
                                {t.estados[r.estado] ?? r.estado}
                              </span>
                            ) : null}
                            <small>
                              {[
                                r.ciudad,
                                r.monto != null
                                  ? formatearMonto(r.monto, r.moneda ?? 'USD', idioma)
                                  : null,
                                r.fecha ? fechaYHora(r.fecha, idioma) : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </small>
                          </span>
                        </>
                      ) : (
                        <>
                          <IconoDe clave={o.icono ?? ''} tamano={18} />
                          <span>
                            <Resaltado texto={o.texto ?? ''} buscado={q} />
                          </span>
                        </>
                      )}
                    </li>
                  </Fragment>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
