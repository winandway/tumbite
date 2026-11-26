import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  montoATexto,
  textoAMonto,
  useBorrador,
} from '@tumbite/compartido';
import { api } from './api';
import { AvisoBorrador } from './AvisoBorrador';
import { MenuTresPuntos } from './MenuTresPuntos';
import { CampoDireccion } from '../sitio/CampoDireccion';

/**
 * C-PRECIO-ZONA (24 nov 2026, Richard): «Precios de la zona» (etiquetas de ruta). Una línea por ruta:
 * zona, desde (la zona entera o un punto), hasta (con el buscador de direcciones), servicio, precio y
 * el de ida y vuelta. Agregar, editar y apagar (apagar y editar, en el menú de tres puntos). El
 * pasajero paga el menor entre este precio y el calculado, si la diferencia pasa del umbral.
 *
 * C-TABULADOR-VIGIA (25 nov 2026): las rutas van agrupadas por vía, con buscador y «solo las que hay que
 * revisar». Cada línea dice lo que paga el pasajero, la comisión de Divoox y lo que le queda al
 * conductor (de día y de noche), calculado por el servidor con la comisión real de la ciudad. Las de
 * punto aproximado dicen «Revisar punto en el mapa»: corregir el punto (o «Marcar como revisado») las
 * desmarca.
 */
const T = {
  es: {
    titulo: 'Precios de la zona',
    intro:
      'Rutas con el precio fijo que se acostumbra cobrar entre dos lugares. El pasajero paga el menor entre este precio y el calculado por distancia, si es al menos un 10 % más barato (el porcentaje se cambia en la tarifa de la ciudad). Una ruta va en un sentido: la vuelta es otra línea.',
    sinRutas: 'Todavía no hay precios de la zona.',
    listaIlegible: 'No se pudo leer la lista de precios de la zona.',
    zona: 'Código de la ciudad (por ejemplo US-FL-MIAMI)',
    servicio: 'Servicio',
    carro: 'Carro',
    envios: 'Envíos',
    zonaEntera: 'Desde cualquier punto de la ciudad',
    desde: 'Desde',
    hasta: 'Hasta',
    buscar: 'Escribe la dirección o el lugar',
    nombreLugar: 'Nombre del lugar (lo ve el pasajero)',
    radio: 'Radio alrededor del punto, en km',
    precio: 'Precio de ida',
    idaVuelta: 'Precio de ida y vuelta (vacío = sin ida y vuelta)',
    agregar: 'Agregar ruta',
    guardarCambios: 'Guardar cambios',
    cancelar: 'Cancelar',
    opciones: 'Opciones de la ruta',
    editar: 'Editar',
    apagar: 'Apagar',
    encender: 'Encender',
    seguroApagar: '¿Apagar esta ruta? Las cotizaciones nuevas vuelven al precio calculado.',
    apagada: 'apagada',
    idaYVuelta: 'ida y vuelta',
    toda: 'toda la ciudad',
    faltaPunto: 'Elige el lugar de «Hasta» en la lista de direcciones.',
    faltaDesde: 'Elige el lugar de «Desde» en la lista, o marca «Desde cualquier punto».',
    faltaPrecio: 'Escribe el precio de ida.',
    guardada: 'Ruta guardada. Las cotizaciones nuevas ya la usan.',
    via: 'Vía o grupo (por ejemplo «Vía Mérida»; vacío = sin grupo)',
    sinVia: 'Sin vía',
    buscarRuta: 'Buscar una ruta por lugar o ciudad',
    soloRevisar: 'Solo las que hay que revisar',
    revisarPunto: 'Revisar punto en el mapa',
    marcarRevisado: 'Marcar como revisado',
    verMapa: 'Ver en el mapa',
    punto: 'Punto exacto (latitud, longitud): pégalo desde el mapa si hace falta',
    puntoMal: 'El punto va como «8.6219, -71.6506» (latitud, coma, longitud).',
    pasajero: 'Pasajero paga',
    comision: 'Divoox',
    conductor: 'Le queda al conductor',
    noche: 'De noche',
    rutasEn: (n: number) => (n === 1 ? '1 ruta' : `${n} rutas`),
    porRevisar: (n: number) => (n === 1 ? '1 por revisar' : `${n} por revisar`),
    sinCoincidencias: 'Ninguna ruta coincide con la búsqueda.',
  },
  en: {
    titulo: 'Local fixed prices',
    intro:
      'Routes with the fixed price people usually charge between two places. The rider pays the lower of this price and the distance-based price, if it is at least 10% cheaper (the percentage is set in the city’s pricing). A route goes one way: the return trip is another line.',
    sinRutas: 'No local fixed prices yet.',
    listaIlegible: 'The local fixed price list couldn’t be read.',
    zona: 'City code (for example US-FL-MIAMI)',
    servicio: 'Service',
    carro: 'Car',
    envios: 'Delivery',
    zonaEntera: 'From anywhere in the city',
    desde: 'From',
    hasta: 'To',
    buscar: 'Type the address or place',
    nombreLugar: 'Place name (the rider sees it)',
    radio: 'Radius around the point, in km',
    precio: 'One-way price',
    idaVuelta: 'Round-trip price (empty = no round trip)',
    agregar: 'Add route',
    guardarCambios: 'Save changes',
    cancelar: 'Cancel',
    opciones: 'Route options',
    editar: 'Edit',
    apagar: 'Turn off',
    encender: 'Turn on',
    seguroApagar: 'Turn off this route? New quotes go back to the distance-based price.',
    apagada: 'off',
    idaYVuelta: 'round trip',
    toda: 'the whole city',
    faltaPunto: 'Pick the “To” place from the address list.',
    faltaDesde: 'Pick the “From” place from the list, or check “From anywhere in the city”.',
    faltaPrecio: 'Type the one-way price.',
    guardada: 'Route saved. New quotes use it now.',
    via: 'Road or group (for example “Vía Mérida”; empty = no group)',
    sinVia: 'No road',
    buscarRuta: 'Search a route by place or city',
    soloRevisar: 'Only the ones to review',
    revisarPunto: 'Check the point on the map',
    marcarRevisado: 'Mark as reviewed',
    verMapa: 'View on map',
    punto: 'Exact point (latitude, longitude): paste it from the map if needed',
    puntoMal: 'The point goes like “8.6219, -71.6506” (latitude, comma, longitude).',
    pasajero: 'Rider pays',
    comision: 'Divoox',
    conductor: 'Driver keeps',
    noche: 'At night',
    rutasEn: (n: number) => (n === 1 ? '1 route' : `${n} routes`),
    porRevisar: (n: number) => (n === 1 ? '1 to review' : `${n} to review`),
    sinCoincidencias: 'No route matches the search.',
  },
};

type Lugar = { lat: number; lng: number; radioKm: number; nombre: string };
export type RutaPrecio = {
  id: string;
  zona: string;
  servicio: 'moto' | 'carro' | 'envios';
  moneda: string;
  desde: Lugar | null;
  hasta: Lugar;
  precio: number;
  precioIdaVuelta: number | null;
  activa: boolean;
  /** C-TABULADOR-VIGIA: la vía (null = sin grupo) y si el punto es aproximado. */
  grupo?: string | null;
  revisar?: boolean;
  reparto?: {
    pasajero: number;
    comision: number;
    conductor: number;
    noche: { pasajero: number; comision: number; conductor: number } | null;
  };
};

const VACIO = {
  editando: '',
  zona: '',
  servicio: 'moto',
  zonaEntera: 'si',
  desdeTexto: '',
  desdeLat: '',
  desdeLng: '',
  desdeRadio: '1',
  desdeNombre: '',
  hastaTexto: '',
  hastaLat: '',
  hastaLng: '',
  hastaRadio: '1',
  hastaNombre: '',
  precio: '',
  idaVuelta: '',
  grupo: '',
};

/** «8.6219, -71.6506» → el punto, o null si no se entiende. */
export function leerPunto(x: string): { lat: number; lng: number } | null {
  const partes = x
    .trim()
    .split(/[,;\s]+/)
    .filter(Boolean);
  // Solo dígitos, un punto decimal y un signo menos al principio (nada de exponentes ni letras).
  if (
    partes.length !== 2 ||
    !partes.every((p) => /^-?[\d.]+$/.test(p) && Number.isFinite(Number(p)))
  )
    return null;
  const lat = Number(partes[0]);
  const lng = Number(partes[1]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

const sinAcentos = (x: string) =>
  x
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const enlaceMapa = (l: { lat: number; lng: number }) =>
  `https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}`;

const numero = (x: string) => Number(x.replace(',', '.'));

export function PreciosZona({
  idioma,
  monedaDe,
}: {
  idioma: Idioma;
  /** La moneda de cada ciudad (sale de sus tarifas); sin tarifa, dólares. */
  monedaDe: (zona: string) => string;
}) {
  const t = enIdioma(T, idioma);
  const [rutas, setRutas] = useState<RutaPrecio[]>([]);
  const [falla, setFalla] = useState('');
  const [aviso, setAviso] = useState('');
  const b = useBorrador({ formulario: 'precio-zona', inicial: VACIO, almacen: almacenNavegador });
  const v = b.valores;
  const [busca, setBusca] = useState('');
  const [soloRevisar, setSoloRevisar] = useState(false);
  const grupos = useMemo(() => {
    const q = sinAcentos(busca.trim());
    const visibles = rutas.filter(
      (r) =>
        (!soloRevisar || r.revisar) &&
        (!q ||
          sinAcentos(
            `${r.zona} ${r.grupo ?? ''} ${r.desde?.nombre ?? ''} ${r.hasta.nombre}`,
          ).includes(q)),
    );
    const mapa = new Map<string, RutaPrecio[]>();
    for (const r of visibles) {
      const k = r.grupo ?? '';
      mapa.set(k, [...(mapa.get(k) ?? []), r]);
    }
    return [...mapa.entries()];
  }, [rutas, busca, soloRevisar]);

  const cargar = useCallback(() => {
    api
      .pedir<{ rutas: RutaPrecio[] }>('GET', '/datos/admin/viajes/precios-zona')
      .then((r) => {
        // Una respuesta sin la lista nunca tumba la pantalla de Viajes: se dice y queda vacía.
        if (Array.isArray(r?.rutas)) return setRutas(r.rutas);
        setRutas([]);
        setFalla(t.listaIlegible);
      })
      .catch((x: unknown) => setFalla(x instanceof ErrorApi ? x.message : String(x)));
  }, [t.listaIlegible]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const moneda = (zona: string) => monedaDe(zona.trim().toUpperCase()) || 'USD';

  function editar(r: RutaPrecio) {
    setAviso('');
    b.cargar({
      editando: r.id,
      zona: r.zona,
      servicio: r.servicio,
      zonaEntera: r.desde ? 'no' : 'si',
      desdeTexto: r.desde?.nombre ?? '',
      desdeLat: r.desde ? String(r.desde.lat) : '',
      desdeLng: r.desde ? String(r.desde.lng) : '',
      desdeRadio: r.desde ? String(r.desde.radioKm) : '1',
      desdeNombre: r.desde?.nombre ?? '',
      hastaTexto: r.hasta.nombre,
      hastaLat: String(r.hasta.lat),
      hastaLng: String(r.hasta.lng),
      hastaRadio: String(r.hasta.radioKm),
      hastaNombre: r.hasta.nombre,
      precio: montoATexto(r.precio, r.moneda),
      idaVuelta: r.precioIdaVuelta == null ? '' : montoATexto(r.precioIdaVuelta, r.moneda),
      grupo: r.grupo ?? '',
    });
  }

  /** C-TABULADOR-VIGIA: «el punto ya está bien» sin moverlo. */
  async function marcarRevisada(r: RutaPrecio) {
    setFalla('');
    try {
      await api.pedir('PUT', `/datos/admin/viajes/precios-zona/${r.id}`, {
        zona: r.zona,
        servicio: r.servicio,
        desde: r.desde,
        hasta: r.hasta,
        precio: r.precio,
        precioIdaVuelta: r.precioIdaVuelta,
        grupo: r.grupo ?? null,
        revisado: true,
      });
      cargar();
    } catch (x) {
      setFalla(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function apagarOEncender(r: RutaPrecio) {
    setFalla('');
    try {
      if (r.activa) {
        if (!window.confirm(t.seguroApagar)) return;
        await api.pedir('POST', `/datos/admin/viajes/precios-zona/${r.id}/apagar`, {});
      } else {
        await api.pedir('PUT', `/datos/admin/viajes/precios-zona/${r.id}`, {
          zona: r.zona,
          servicio: r.servicio,
          desde: r.desde,
          hasta: r.hasta,
          precio: r.precio,
          precioIdaVuelta: r.precioIdaVuelta,
          grupo: r.grupo ?? null,
          activa: true,
        });
      }
      cargar();
    } catch (x) {
      setFalla(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setFalla('');
    setAviso('');
    if (!v.hastaLat || !v.hastaLng) return setFalla(t.faltaPunto);
    if (v.zonaEntera !== 'si' && (!v.desdeLat || !v.desdeLng)) return setFalla(t.faltaDesde);
    if (!v.precio.trim()) return setFalla(t.faltaPrecio);
    const m = moneda(v.zona);
    const cuerpo = {
      zona: v.zona.trim().toUpperCase(),
      servicio: v.servicio,
      desde:
        v.zonaEntera === 'si'
          ? null
          : {
              lat: Number(v.desdeLat),
              lng: Number(v.desdeLng),
              radioKm: numero(v.desdeRadio) || 1,
              nombre: (v.desdeNombre || v.desdeTexto).trim(),
            },
      hasta: {
        lat: Number(v.hastaLat),
        lng: Number(v.hastaLng),
        radioKm: numero(v.hastaRadio) || 1,
        nombre: (v.hastaNombre || v.hastaTexto).trim(),
      },
      precio: textoAMonto(v.precio, m),
      precioIdaVuelta:
        v.servicio !== 'envios' && v.idaVuelta.trim() ? textoAMonto(v.idaVuelta, m) : null,
      grupo: v.grupo.trim() || null,
    };
    try {
      if (v.editando)
        await api.pedir('PUT', `/datos/admin/viajes/precios-zona/${v.editando}`, cuerpo);
      else await api.pedir('POST', '/datos/admin/viajes/precios-zona', cuerpo);
      // Solo se borra lo escrito cuando el servidor confirmó que se guardó.
      await b.limpiar();
      setAviso(t.guardada);
      cargar();
    } catch (x) {
      setFalla(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  const servicio = (s: string) => (s === 'carro' ? t.carro : s === 'envios' ? t.envios : 'Moto');
  const pais = v.zona.trim().slice(0, 2).toUpperCase() || null;

  return (
    <section className="tarjeta-form" data-testid="precios-zona">
      <h2>{t.titulo}</h2>
      <p>{t.intro}</p>
      {falla && (
        <p className="error-general" role="alert">
          {falla}
        </p>
      )}
      {aviso && <p role="status">{aviso}</p>}
      {!rutas.length ? (
        <p>{t.sinRutas}</p>
      ) : (
        <>
          <div className="flex-form" style={{ gap: 8 }}>
            <label className="campo">
              <span>{t.buscarRuta}</span>
              <input
                type="search"
                data-testid="precio-zona-buscar"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </label>
            <label className="campo" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                data-testid="precio-zona-solo-revisar"
                checked={soloRevisar}
                onChange={(e) => setSoloRevisar(e.target.checked)}
              />
              <span>{t.soloRevisar}</span>
            </label>
          </div>
          {!grupos.length ? <p>{t.sinCoincidencias}</p> : null}
          {grupos.map(([grupo, lista]) => {
            const revisar = lista.filter((r) => r.revisar).length;
            return (
              <section key={grupo || '-'} data-testid="precio-zona-grupo">
                <h3 style={{ marginBottom: 4 }}>
                  {grupo || t.sinVia}{' '}
                  <small style={{ fontWeight: 400, color: '#666B73' }}>
                    · {t.rutasEn(lista.length)}
                    {revisar ? ` · ${t.porRevisar(revisar)}` : ''}
                  </small>
                </h3>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {lista.map((r) => (
                    <LineaRuta
                      key={r.id}
                      r={r}
                      t={t}
                      servicio={servicio(r.servicio)}
                      editar={() => editar(r)}
                      apagarOEncender={() => void apagarOEncender(r)}
                      marcarRevisada={() => void marcarRevisada(r)}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}

      <form className="flex-form" onSubmit={(e) => void guardar(e)} noValidate>
        <AvisoBorrador
          visible={b.recuperado}
          idioma={idioma}
          empezar={() => void b.empezarDeNuevo()}
        />
        <label className="campo">
          <span>{t.zona}</span>
          <input value={v.zona} onChange={(e) => b.cambiar('zona', e.target.value)} />
        </label>
        <label className="campo">
          <span>{t.servicio}</span>
          <select value={v.servicio} onChange={(e) => b.cambiar('servicio', e.target.value)}>
            <option value="moto">Moto</option>
            <option value="carro">{t.carro}</option>
            <option value="envios">{t.envios}</option>
          </select>
        </label>
        <label className="campo" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={v.zonaEntera === 'si'}
            onChange={(e) => b.cambiar('zonaEntera', e.target.checked ? 'si' : 'no')}
          />
          <span>{t.zonaEntera}</span>
        </label>
        {v.zonaEntera === 'si' ? null : (
          <>
            <CampoDireccion
              etiqueta={t.desde}
              placeholder={t.buscar}
              valor={v.desdeTexto}
              pais={pais}
              cambiar={(x) => b.cambiar('desdeTexto', x)}
              alElegir={(d) =>
                b.setValores((o) => ({
                  ...o,
                  desdeTexto: d.direccion,
                  desdeLat: String(d.punto.lat),
                  desdeLng: String(d.punto.lng),
                  desdeNombre: o.desdeNombre || d.direccion.split(',')[0] || d.direccion,
                }))
              }
            />
            <label className="campo">
              <span>{t.nombreLugar}</span>
              <input
                value={v.desdeNombre}
                onChange={(e) => b.cambiar('desdeNombre', e.target.value)}
              />
            </label>
            <CampoPunto
              etiqueta={t.punto}
              error={t.puntoMal}
              testId="precio-zona-punto-desde"
              lat={v.desdeLat}
              lng={v.desdeLng}
              cambiar={(p) =>
                b.setValores((o) => ({ ...o, desdeLat: String(p.lat), desdeLng: String(p.lng) }))
              }
            />
            <label className="campo">
              <span>{t.radio}</span>
              <input
                inputMode="decimal"
                value={v.desdeRadio}
                onChange={(e) => b.cambiar('desdeRadio', e.target.value)}
              />
            </label>
          </>
        )}
        <CampoDireccion
          etiqueta={t.hasta}
          placeholder={t.buscar}
          valor={v.hastaTexto}
          pais={pais}
          cambiar={(x) => b.cambiar('hastaTexto', x)}
          alElegir={(d) =>
            b.setValores((o) => ({
              ...o,
              hastaTexto: d.direccion,
              hastaLat: String(d.punto.lat),
              hastaLng: String(d.punto.lng),
              hastaNombre: o.hastaNombre || d.direccion.split(',')[0] || d.direccion,
            }))
          }
        />
        <label className="campo">
          <span>{t.nombreLugar}</span>
          <input value={v.hastaNombre} onChange={(e) => b.cambiar('hastaNombre', e.target.value)} />
        </label>
        <CampoPunto
          etiqueta={t.punto}
          error={t.puntoMal}
          testId="precio-zona-punto-hasta"
          lat={v.hastaLat}
          lng={v.hastaLng}
          cambiar={(p) =>
            b.setValores((o) => ({ ...o, hastaLat: String(p.lat), hastaLng: String(p.lng) }))
          }
        />
        <label className="campo">
          <span>{t.radio}</span>
          <input
            inputMode="decimal"
            value={v.hastaRadio}
            onChange={(e) => b.cambiar('hastaRadio', e.target.value)}
          />
        </label>
        <label className="campo">
          <span>
            {t.precio} ({moneda(v.zona)})
          </span>
          <input
            inputMode="decimal"
            data-testid="precio-zona-precio"
            value={v.precio}
            onChange={(e) => b.cambiar('precio', e.target.value)}
          />
        </label>
        <label className="campo">
          <span>{t.via}</span>
          <input
            data-testid="precio-zona-via"
            value={v.grupo}
            onChange={(e) => b.cambiar('grupo', e.target.value)}
          />
        </label>
        {v.servicio === 'envios' ? null : (
          <label className="campo">
            <span>{t.idaVuelta}</span>
            <input
              inputMode="decimal"
              value={v.idaVuelta}
              onChange={(e) => b.cambiar('idaVuelta', e.target.value)}
            />
          </label>
        )}
        <button type="submit" className="boton">
          {v.editando ? t.guardarCambios : t.agregar}
        </button>
        {v.editando ? (
          <button
            type="button"
            className="boton secundario"
            onClick={() => {
              void b.limpiar();
            }}
          >
            {t.cancelar}
          </button>
        ) : null}
      </form>
    </section>
  );
}

type Textos = (typeof T)['es'];

/** Una ruta: lugares, precio y lo que le queda a cada uno (de día y de noche). */
function LineaRuta({
  r,
  t,
  servicio,
  editar,
  apagarOEncender,
  marcarRevisada,
}: {
  r: RutaPrecio;
  t: Textos;
  servicio: string;
  editar: () => void;
  apagarOEncender: () => void;
  marcarRevisada: () => void;
}) {
  const m = (n: number) => montoATexto(n, r.moneda);
  return (
    <li
      data-testid="precio-zona-linea"
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
        padding: '10px 0',
        borderBottom: '1px solid #e3e5e8',
        opacity: r.activa ? 1 : 0.6,
      }}
    >
      <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
        <strong>{r.zona}</strong> · {servicio} · {r.desde ? r.desde.nombre : t.toda} →{' '}
        {r.hasta.nombre} · <strong>{m(r.precio)}</strong> {r.moneda}
        {r.precioIdaVuelta != null ? ` · ${t.idaYVuelta} ${m(r.precioIdaVuelta)}` : ''}
        {r.activa ? '' : ` · ${t.apagada}`}
        {r.reparto ? (
          <span
            data-testid="precio-zona-reparto"
            style={{ display: 'block', color: '#666B73', fontSize: 14 }}
          >
            {t.pasajero} {m(r.reparto.pasajero)} · {t.comision} {m(r.reparto.comision)} ·{' '}
            {t.conductor} <strong>{m(r.reparto.conductor)}</strong>
            {r.reparto.noche
              ? ` · ${t.noche}: ${t.pasajero.toLowerCase()} ${m(r.reparto.noche.pasajero)}, ${t.conductor.toLowerCase()} ${m(r.reparto.noche.conductor)}`
              : ''}
          </span>
        ) : null}
        {r.revisar ? (
          <span data-testid="precio-zona-revisar" style={{ display: 'block', fontSize: 14 }}>
            <strong>{t.revisarPunto}</strong> ·{' '}
            <a href={enlaceMapa(r.hasta)} target="_blank" rel="noopener noreferrer">
              {t.verMapa}
            </a>
          </span>
        ) : null}
      </span>
      <MenuTresPuntos
        etiqueta={t.opciones}
        opciones={[
          { texto: t.editar, alTocar: editar },
          ...(r.revisar ? [{ texto: t.marcarRevisado, alTocar: marcarRevisada }] : []),
          { texto: r.activa ? t.apagar : t.encender, peligro: r.activa, alTocar: apagarOEncender },
        ]}
      />
    </li>
  );
}

/** El punto exacto, escrito o pegado («lat, lng»); se guarda solo si se entiende. */
function CampoPunto({
  etiqueta,
  error,
  testId,
  lat,
  lng,
  cambiar,
}: {
  etiqueta: string;
  error: string;
  testId: string;
  lat: string;
  lng: string;
  cambiar: (p: { lat: number; lng: number }) => void;
}) {
  const actual = lat && lng ? `${lat}, ${lng}` : '';
  // Lo escrito se muestra mientras el punto del formulario sea el que salió de eso; si el formulario
  // cambia por otro lado (editar otra ruta, empezar de nuevo, elegir una dirección), se ve el nuevo.
  const [estado, setEstado] = useState<{ texto: string; para: string } | null>(null);
  const texto = estado && estado.para === actual ? estado.texto : actual;
  const malo = texto.trim() !== '' && !leerPunto(texto);
  return (
    <label className="campo">
      <span>{etiqueta}</span>
      <input
        data-testid={testId}
        inputMode="decimal"
        value={texto}
        aria-invalid={malo}
        onChange={(e) => {
          const p = leerPunto(e.target.value);
          setEstado({ texto: e.target.value, para: p ? `${p.lat}, ${p.lng}` : actual });
          if (p) cambiar(p);
        }}
      />
      {malo ? <small role="alert">{error}</small> : null}
    </label>
  );
}
