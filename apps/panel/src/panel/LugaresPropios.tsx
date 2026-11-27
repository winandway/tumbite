import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  formatearMonto,
  useBorrador,
} from '@tumbite/compartido';
import { api } from './api';
import { AvisoBorrador } from './AvisoBorrador';
import { MenuTresPuntos } from './MenuTresPuntos';
import { ElegirPunto } from '../sitio/ElegirPunto';

/**
 * Lugares propios de tu ciudad: los nombres que la gente de la ciudad usa de verdad («km9», «la
 * plaza») con su punto exacto, y el precio del tabulador al que se atan. Llegan al buscador de las
 * apps, la web y Driver en unos minutos y solo en esa ciudad. Se agregan, se editan y se apagan;
 * no se borran.
 */
const T = {
  es: {
    titulo: 'Lugares propios de tu ciudad',
    intro:
      'Los lugares con el nombre que usa la gente de tu ciudad, con su punto exacto. Aparecen en el buscador de la app de clientes, la web y Driver en unos minutos, y solo en esa ciudad.',
    ciudad: 'Ciudad',
    elegirCiudad: 'Elige una ciudad',
    buscar: 'Buscar un lugar por su nombre',
    sinLugares: 'Esta ciudad todavía no tiene lugares propios.',
    sinCoincidencias: 'Ningún lugar coincide con la búsqueda.',
    listaIlegible: 'No se pudo leer la lista de lugares.',
    sinPrecio: 'Sin precio fijo',
    verMapa: 'Ver en el mapa',
    apagado: 'Apagado',
    opciones: 'Opciones del lugar',
    editar: 'Editar',
    apagar: 'Apagar',
    encender: 'Encender',
    seguroApagar: '¿Apagar este lugar? Deja de salir en el buscador.',
    nuevo: 'Agregar un lugar',
    nombre: 'Nombre',
    otros: 'Otros nombres o formas de escribirlo',
    otrosAyuda: 'Sepáralos con comas. Ejemplo: km9, kilómetro 9, KM-9',
    punto: 'Punto en el mapa: arrastra el mapa hasta el lugar',
    faltaNombre: 'Escribe el nombre del lugar.',
    faltaPunto: 'Marca el punto del lugar en el mapa.',
    precio: 'Precio del tabulador',
    avisoPrecio:
      'Al guardar un lugar atado a un precio, el punto de esa ruta del tabulador se mueve al mismo lugar.',
    sinVia: 'Sin vía',
    guardar: 'Guardar',
    guardarCambios: 'Guardar cambios',
    cancelar: 'Cancelar',
    guardado: 'Lugar guardado. Llega al buscador en unos minutos.',
    lugaresEn: (n: number) => (n === 1 ? '1 lugar' : `${n} lugares`),
  },
  en: {
    titulo: 'Your city’s own places',
    intro:
      'Places under the name people in your city really use, with their exact point. They reach the search in the customer app, the web and Driver within a few minutes, and only in that city.',
    ciudad: 'City',
    elegirCiudad: 'Choose a city',
    buscar: 'Search a place by name',
    sinLugares: 'This city has no places of its own yet.',
    sinCoincidencias: 'No place matches the search.',
    listaIlegible: 'The list of places couldn’t be read.',
    sinPrecio: 'No fixed price',
    verMapa: 'View on map',
    apagado: 'Off',
    opciones: 'Place options',
    editar: 'Edit',
    apagar: 'Turn off',
    encender: 'Turn on',
    seguroApagar: 'Turn off this place? It stops showing in search.',
    nuevo: 'Add a place',
    nombre: 'Name',
    otros: 'Other names or ways to write it',
    otrosAyuda: 'Separate them with commas. Example: km9, kilometer 9, KM-9',
    punto: 'Point on the map: drag the map to the place',
    faltaNombre: 'Type the place name.',
    faltaPunto: 'Mark the place on the map.',
    precio: 'Pricing-table price',
    avisoPrecio:
      'When you save a place tied to a price, the point of that pricing-table route moves to the same place.',
    sinVia: 'No road',
    guardar: 'Save',
    guardarCambios: 'Save changes',
    cancelar: 'Cancel',
    guardado: 'Place saved. It reaches the search in a few minutes.',
    lugaresEn: (n: number) => (n === 1 ? '1 place' : `${n} places`),
  },
};

type Lugar = {
  id: string;
  zona: string;
  nombre: string;
  otrosNombres: string[];
  lat: number;
  lng: number;
  rutaId: string | null;
  activo: boolean;
  actualizadoEn?: string;
};
type Ruta = {
  id: string;
  servicio: string;
  nombre: string;
  precio: number;
  moneda: string;
  grupo: string | null;
  revisar?: boolean;
};
type Respuesta = { ciudad: { id: string; nombre: string }; lugares: Lugar[]; rutas: Ruta[] };

const VACIO = { editando: '', nombre: '', otros: '', lat: '', lng: '', rutaId: '' };

/** Sin acentos ni mayúsculas ni signos: «KM-9» y «km 9» se buscan igual. */
const llano = (x: string) =>
  x
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();

const enlaceMapa = (l: { lat: number; lng: number }) =>
  `https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}`;

/** «km9, , KM-9 ,» → ['km9', 'KM-9'] (sin vacíos ni repetidos). */
const separarOtros = (x: string): string[] => {
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const p of x.split(/[,;\n]/)) {
    const s = p.trim();
    const k = s.toLowerCase();
    if (!s || vistos.has(k)) continue;
    vistos.add(k);
    salida.push(s);
  }
  return salida;
};

export function LugaresPropios({
  idioma,
  zonas,
}: {
  idioma: Idioma;
  /** Las ciudades con tarifa (id y nombre). */
  zonas: { id: string; nombre: string }[];
}) {
  const t = enIdioma(T, idioma);
  const [zona, setZona] = useState('');
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [falla, setFalla] = useState('');
  const [aviso, setAviso] = useState('');
  const [busca, setBusca] = useState('');
  const b = useBorrador({
    formulario: 'lugar-propio',
    inicial: VACIO,
    almacen: almacenNavegador,
  });
  const v = b.valores;

  const cargar = useCallback(() => {
    if (!zona) return;
    api
      .pedir<Respuesta>('GET', `/datos/admin/lugares-propios?zona=${encodeURIComponent(zona)}`)
      .then((r) => {
        if (Array.isArray(r?.lugares)) return setDatos(r);
        setDatos(null);
        setFalla(t.listaIlegible);
      })
      .catch((x: unknown) => setFalla(x instanceof ErrorApi ? x.message : String(x)));
  }, [zona, t.listaIlegible]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const visibles = useMemo(() => {
    const lista = datos?.lugares ?? [];
    const q = llano(busca);
    if (q.length < 2) return lista;
    return lista.filter((l) => llano([l.nombre, ...l.otrosNombres].join(' | ')).includes(q));
  }, [datos, busca]);

  const rutaDe = (id: string | null) => datos?.rutas.find((r) => r.id === id) ?? null;
  const rutasPorGrupo = useMemo(() => {
    const m = new Map<string, Ruta[]>();
    for (const r of datos?.rutas ?? []) m.set(r.grupo ?? '', [...(m.get(r.grupo ?? '') ?? []), r]);
    return [...m.entries()];
  }, [datos]);

  const pais = zona.slice(0, 2).toUpperCase();
  const centro = useMemo(() => {
    const l = datos?.lugares.find((x) => x.activo) ?? datos?.lugares[0];
    return l ? { lat: l.lat, lng: l.lng } : { lat: 0, lng: 0 };
  }, [datos]);
  const punto =
    v.lat && v.lng && Number.isFinite(Number(v.lat))
      ? { lat: Number(v.lat), lng: Number(v.lng) }
      : null;

  function editar(l: Lugar) {
    setAviso('');
    b.cargar({
      editando: l.id,
      nombre: l.nombre,
      otros: l.otrosNombres.join(', '),
      lat: String(l.lat),
      lng: String(l.lng),
      rutaId: l.rutaId ?? '',
    });
  }

  async function apagarOEncender(l: Lugar) {
    setFalla('');
    try {
      if (l.activo && !window.confirm(t.seguroApagar)) return;
      await api.pedir(
        'POST',
        `/datos/admin/lugares-propios/${l.id}/${l.activo ? 'apagar' : 'encender'}`,
        {},
      );
      cargar();
    } catch (x) {
      setFalla(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setFalla('');
    setAviso('');
    if (!zona) return setFalla(t.elegirCiudad);
    if (!v.nombre.trim()) return setFalla(t.faltaNombre);
    if (!punto) return setFalla(t.faltaPunto);
    const cuerpo = {
      zona,
      nombre: v.nombre.trim(),
      otrosNombres: separarOtros(v.otros),
      lat: punto.lat,
      lng: punto.lng,
      rutaId: v.rutaId || null,
    };
    try {
      if (v.editando) await api.pedir('PUT', `/datos/admin/lugares-propios/${v.editando}`, cuerpo);
      else await api.pedir('POST', '/datos/admin/lugares-propios', cuerpo);
      await b.limpiar();
      setAviso(t.guardado);
      cargar();
    } catch (x) {
      setFalla(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  return (
    <section className="tarjeta-form" data-testid="lugares-propios">
      <h2>{t.titulo}</h2>
      <p>{t.intro}</p>
      {falla && (
        <p className="error-general" role="alert">
          {falla}
        </p>
      )}
      {aviso && <p role="status">{aviso}</p>}
      <label className="campo">
        <span>{t.ciudad}</span>
        <select
          data-testid="lugar-propio-ciudad"
          value={zona}
          onChange={(e) => {
            setZona(e.target.value);
            setBusca('');
          }}
        >
          <option value="">{t.elegirCiudad}</option>
          {zonas.map((z) => (
            <option key={z.id} value={z.id}>
              {z.nombre}
            </option>
          ))}
        </select>
      </label>

      {zona && datos && datos.ciudad.id === zona ? (
        <>
          {datos.lugares.length ? (
            <>
              <label className="campo">
                <span>{t.buscar}</span>
                <input
                  type="search"
                  data-testid="lugar-propio-buscar"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </label>
              <p style={{ color: '#666B73', margin: 0 }}>{t.lugaresEn(visibles.length)}</p>
              {!visibles.length ? <p>{t.sinCoincidencias}</p> : null}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {visibles.map((l) => {
                  const ruta = rutaDe(l.rutaId);
                  return (
                    <li
                      key={l.id}
                      data-testid="lugar-propio-linea"
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'flex-start',
                        padding: '10px 0',
                        borderBottom: '1px solid #e3e5e8',
                        opacity: l.activo ? 1 : 0.6,
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                        <strong>{l.nombre}</strong>
                        {l.activo ? '' : ` · ${t.apagado}`}
                        {l.otrosNombres.length ? (
                          <span style={{ display: 'block', color: '#666B73', fontSize: 14 }}>
                            {l.otrosNombres.join(', ')}
                          </span>
                        ) : null}
                        <span style={{ display: 'block', fontSize: 14 }}>
                          {ruta
                            ? `${ruta.nombre} · ${formatearMonto(ruta.precio, ruta.moneda, idioma)}`
                            : t.sinPrecio}
                          {' · '}
                          <a href={enlaceMapa(l)} target="_blank" rel="noopener noreferrer">
                            {t.verMapa}
                          </a>
                        </span>
                      </span>
                      <MenuTresPuntos
                        etiqueta={t.opciones}
                        opciones={[
                          { texto: t.editar, alTocar: () => editar(l) },
                          {
                            texto: l.activo ? t.apagar : t.encender,
                            peligro: l.activo,
                            alTocar: () => void apagarOEncender(l),
                          },
                        ]}
                      />
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p>{t.sinLugares}</p>
          )}

          <form className="flex-form" onSubmit={(e) => void guardar(e)} noValidate>
            <h3 data-testid="lugar-propio-nuevo">{t.nuevo}</h3>
            <AvisoBorrador
              visible={b.recuperado}
              idioma={idioma}
              empezar={() => void b.empezarDeNuevo()}
            />
            <label className="campo">
              <span>{t.nombre}</span>
              <input
                data-testid="lugar-propio-nombre"
                value={v.nombre}
                onChange={(e) => b.cambiar('nombre', e.target.value)}
              />
            </label>
            <label className="campo">
              <span>{t.otros}</span>
              <input
                data-testid="lugar-propio-otros"
                value={v.otros}
                onChange={(e) => b.cambiar('otros', e.target.value)}
              />
              <small style={{ color: '#666B73' }}>{t.otrosAyuda}</small>
            </label>
            <div className="campo">
              <span>{t.punto}</span>
              <ElegirPunto
                punto={punto}
                centro={centro}
                pais={pais}
                idioma={idioma}
                cambiar={(p) =>
                  b.setValores((o) => ({ ...o, lat: String(p.lat), lng: String(p.lng) }))
                }
              />
            </div>
            <label className="campo">
              <span>{t.precio}</span>
              <select
                data-testid="lugar-propio-ruta"
                value={v.rutaId}
                onChange={(e) => b.cambiar('rutaId', e.target.value)}
              >
                <option value="">{t.sinPrecio}</option>
                {rutasPorGrupo.map(([grupo, lista]) => (
                  <optgroup key={grupo || '-'} label={grupo || t.sinVia}>
                    {lista.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre} · {formatearMonto(r.precio, r.moneda, idioma)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <small style={{ color: '#666B73' }}>{t.avisoPrecio}</small>
            </label>
            <button type="submit" className="boton" data-testid="lugar-propio-guardar">
              {v.editando ? t.guardarCambios : t.guardar}
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
        </>
      ) : null}
    </section>
  );
}
