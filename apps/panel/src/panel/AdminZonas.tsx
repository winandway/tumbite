import { useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  type Usuario,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { AreasCiudad } from './AreasCiudad';
import { AvisoBorrador } from './AvisoBorrador';
import { pedir } from './api';

type Zona = {
  id: string;
  nombre: string;
  pais: string;
  lat: number;
  lng: number;
  radioKm: number;
  activa: boolean;
  restaurantes: number;
  repartidores: number;
  enEspera: number;
};
type Persona = {
  id: string;
  tipo: string;
  zonaId: string | null;
  nombre: string;
  correo: string;
  telefono: string;
  ciudad: string;
  negocio: string;
  vehiculo: string;
  fecha: string;
};

const T = {
  es: {
    zonas: 'Zonas',
    espera: 'Lista de espera',
    activa: 'Activa',
    apagada: 'Apagada',
    activar: 'Activar',
    apagar: 'Apagar',
    restaurantes: 'restaurantes',
    repartidores: 'repartidores',
    enEspera: 'en espera',
    nueva: 'Nueva zona',
    codigo: 'Código (ej. US-FL-OCALA)',
    nombre: 'Nombre',
    lat: 'Latitud del centro',
    lng: 'Longitud del centro',
    radio: 'Radio (km)',
    guardar: 'Guardar zona',
    guardada: 'Zona guardada',
    tipos: {
      comensal: 'Comensales',
      restaurante: 'Restaurantes',
      repartidor: 'Repartidores',
    } as Record<string, string>,
    todos: 'Todos',
    vacio: 'Nadie anotado todavía.',
    sinZona: 'Sin zona',
    areas: 'Áreas',
    ocultar: 'Ocultar áreas',
    region: 'Estado o provincia (ej. FL)',
  },
  en: {
    zonas: 'Zones',
    espera: 'Waitlist',
    activa: 'Live',
    apagada: 'Off',
    activar: 'Turn on',
    apagar: 'Turn off',
    restaurantes: 'restaurants',
    repartidores: 'drivers',
    enEspera: 'waiting',
    nueva: 'New zone',
    codigo: 'Code (e.g. US-FL-OCALA)',
    nombre: 'Name',
    lat: 'Center latitude',
    lng: 'Center longitude',
    radio: 'Radius (km)',
    guardar: 'Save zone',
    guardada: 'Zone saved',
    tipos: { comensal: 'Customers', restaurante: 'Restaurants', repartidor: 'Drivers' } as Record<
      string,
      string
    >,
    todos: 'All',
    vacio: 'No one signed up yet.',
    sinZona: 'No zone',
    areas: 'Areas',
    ocultar: 'Hide areas',
    region: 'State or province (e.g. FL)',
  },
};

const ZONA_VACIA = { id: '', nombre: '', region: '', lat: '', lng: '', radio: '30' };

export function AdminZonas({ usuario, idioma }: { usuario: Usuario; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const b = useBorrador({
    formulario: 'zona-nueva',
    cuenta: usuario.id,
    inicial: ZONA_VACIA,
    almacen: almacenNavegador,
  });
  const nueva = b.valores;
  const [error, setError] = useState<{ mensaje: string; campo?: string } | null>(null);
  const [aviso, setAviso] = useState('');
  const [conAreas, setConAreas] = useState<string | null>(null);

  const cargar = () =>
    pedir<{ zonas: Zona[] }>('GET', '/datos/admin/zonas')
      .then((r) => setZonas(r.zonas))
      .catch((e: unknown) => setError({ mensaje: e instanceof ErrorApi ? e.message : String(e) }));
  useEffect(() => {
    void cargar();
  }, []);

  async function alternar(z: Zona) {
    await pedir('PATCH', `/datos/admin/zonas/${z.id}`, { activa: !z.activa });
    await cargar();
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso('');
    try {
      await pedir('PUT', '/datos/admin/zonas', {
        id: nueva.id.toUpperCase(),
        nombre: nueva.nombre,
        pais: nueva.id.slice(0, 2).toUpperCase(),
        lat: Number(nueva.lat),
        lng: Number(nueva.lng),
        radioKm: Number(nueva.radio),
        region: nueva.region,
        // Una ciudad nueva nace apagada: se enciende a mano cuando esté lista.
        activa: false,
      });
      setAviso(t.guardada);
      await b.limpiar();
      await cargar();
    } catch (x) {
      setError(
        x instanceof ErrorApi ? { mensaje: x.message, campo: x.campo } : { mensaje: String(x) },
      );
    }
  }

  return (
    <section>
      <h1>{t.zonas}</h1>
      <ul className="lista">
        {zonas.map((z) => (
          <li key={z.id}>
            <div className="lista-texto">
              <strong>
                {z.nombre} · {z.id}
              </strong>
              <span>
                {z.restaurantes} {t.restaurantes} · {z.repartidores} {t.repartidores} · {z.enEspera}{' '}
                {t.enEspera}
              </span>
              <span className={`insignia ${z.activa ? 'insignia-aprobado' : ''}`}>
                {z.activa ? t.activa : t.apagada}
              </span>
            </div>
            <button
              type="button"
              className={z.activa ? 'boton secundario' : 'boton'}
              onClick={() => void alternar(z)}
            >
              {z.activa ? t.apagar : t.activar}
            </button>
            <button
              type="button"
              className="boton secundario"
              aria-expanded={conAreas === z.id}
              onClick={() => setConAreas(conAreas === z.id ? null : z.id)}
            >
              {conAreas === z.id ? t.ocultar : t.areas}
            </button>
            {conAreas === z.id && <AreasCiudad zona={z} usuario={usuario} idioma={idioma} />}
          </li>
        ))}
      </ul>
      <form onSubmit={guardar} className="formulario tarjeta-form">
        <h2>{t.nueva}</h2>
        <AvisoBorrador
          visible={b.recuperado}
          idioma={idioma}
          empezar={() => void b.empezarDeNuevo()}
        />
        {(['id', 'nombre', 'region', 'lat', 'lng', 'radio'] as const).map((k) => (
          <label className="campo" key={k}>
            <span>
              {k === 'id'
                ? t.codigo
                : k === 'nombre'
                  ? t.nombre
                  : k === 'region'
                    ? t.region
                    : k === 'lat'
                      ? t.lat
                      : k === 'lng'
                        ? t.lng
                        : t.radio}
            </span>
            <input
              value={
                k === 'id'
                  ? nueva.id
                  : k === 'nombre'
                    ? nueva.nombre
                    : k === 'region'
                      ? nueva.region
                      : k === 'lat'
                        ? nueva.lat
                        : k === 'lng'
                          ? nueva.lng
                          : nueva.radio
              }
              onChange={(e) => b.cambiar(k, e.target.value)}
            />
          </label>
        ))}
        {error && (
          <p className="error-general" role="alert">
            {error.mensaje}
          </p>
        )}
        {aviso && (
          <p className="ok" role="status">
            {aviso}
          </p>
        )}
        <button type="submit" className="boton">
          {t.guardar}
        </button>
      </form>
    </section>
  );
}

export function AdminEspera({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const tipos = new Map(Object.entries(t.tipos));
  const nombreTipo = (k: string) => tipos.get(k) ?? k;
  const [tipo, setTipo] = useState('');
  const [datos, setDatos] = useState<{
    personas: Persona[];
    totales: Record<string, number>;
  } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    pedir<{ personas: Persona[]; totales: Record<string, number> }>(
      'GET',
      `/datos/admin/lista-espera${tipo ? `?tipo=${tipo}` : ''}`,
    )
      .then(setDatos)
      .catch((e: unknown) => setError(e instanceof ErrorApi ? e.message : String(e)));
  }, [tipo]);

  const total = (k: string) => new Map(Object.entries(datos?.totales ?? {})).get(k) ?? 0;
  return (
    <section>
      <h1>{t.espera}</h1>
      {error && <p className="error-general">{error}</p>}
      <div className="metricas">
        {['comensal', 'restaurante', 'repartidor'].map((k) => (
          <div key={k}>
            <span>{nombreTipo(k)}</span>
            <strong>{total(k)}</strong>
          </div>
        ))}
      </div>
      <div className="fila-botones">
        {['', 'comensal', 'restaurante', 'repartidor'].map((k) => (
          <button
            key={k || 'todos'}
            type="button"
            className={tipo === k ? 'boton' : 'boton secundario'}
            onClick={() => setTipo(k)}
          >
            {k ? nombreTipo(k) : t.todos}
          </button>
        ))}
      </div>
      {datos && datos.personas.length === 0 && <p>{t.vacio}</p>}
      <ul className="lista">
        {datos?.personas.map((p) => (
          <li key={p.id}>
            <div className="lista-texto">
              <strong>
                {p.negocio ? `${p.negocio} · ` : ''}
                {p.nombre}
              </strong>
              <span>
                {p.correo}
                {p.telefono ? ` · ${p.telefono}` : ''}
              </span>
              <span>
                {nombreTipo(p.tipo)} · {p.ciudad} · {p.zonaId ?? t.sinZona}
                {p.vehiculo ? ` · ${p.vehiculo}` : ''}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
