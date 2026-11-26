import { Insignia } from './diseno/Insignia';
import { useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  type Usuario,
  almacenNavegador,
  enIdioma,
  useBorrador,
  nombrePais,
  zonaDeFabrica,
} from '@tumbite/compartido';
import { AreasCiudad } from './AreasCiudad';
import { AvisoBorrador } from './AvisoBorrador';
import { CiudadesWeb } from './CiudadesWeb';
import { ResponsableZona } from './ResponsableZona';
import { CampoMunicipio, MunicipioZona, useSugerenciasMunicipio } from './MunicipioZona';
import { AvisoFiltrosGuardados } from './AvisoFiltrosGuardados';
import { AyudaAqui } from './AyudaAqui';
import { usePreferencias } from './usePreferencias';
import { pedir } from './api';
import { AvisoPasaron, PasarEspera } from './PasarEspera';
import { pasaronDeRespuesta } from './esperaCiudad';

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
  fotoPuertaObligatoria: boolean;
  responsableNombre?: string;
  responsableTelefono?: string;
  /** C-TERRITORIO-OFICIAL: el municipio oficial donde cae su centro. */
  municipio?: { pcode: string; nombre: string; entidad: { pcode: string; nombre: string } } | null;
  /** C-ZONA-MUNICIPIO: el que eligió el equipo (o el oficial) y su clave para el filtro. */
  municipioNombre?: string;
  municipioClave?: string;
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
  pais?: string;
  origen?: string;
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
    fotoPuerta: 'Foto de la puerta obligatoria para pedir',
    fotoPuertaAyuda:
      'Apagado: el cliente decide si la sube. Encendido: sin la primera foto no puede pedir a domicilio en esta zona.',
    restaurantes: 'restaurantes',
    repartidores: 'repartidores',
    enEspera: 'en espera',
    municipio: 'Municipio oficial',
    municipioZona: 'Municipio',
    filtroMunicipio: 'Filtrar por municipio',
    todosMunicipios: 'Todos los municipios',
    sinMunicipio: 'Sin municipio',
    ningunaZona: 'Ninguna zona en ese municipio.',
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
    fotoPuerta: 'Door photo required to order',
    fotoPuertaAyuda:
      'Off: the customer chooses whether to add it. On: without the first photo they cannot order delivery in this zone.',
    restaurantes: 'restaurants',
    repartidores: 'drivers',
    enEspera: 'waiting',
    municipio: 'Official municipality',
    municipioZona: 'Municipality',
    filtroMunicipio: 'Filter by municipality',
    todosMunicipios: 'All municipalities',
    sinMunicipio: 'No municipality',
    ningunaZona: 'No zones in that municipality.',
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

const ZONA_VACIA = { id: '', nombre: '', region: '', municipio: '', lat: '', lng: '', radio: '30' };
/** C-ZONA-MUNICIPIO: la clave del filtro para las zonas sin municipio. */
const SIN_MUNICIPIO = 'sin-municipio';

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
  // C-REGISTRO-TODO-EL-PAIS: cuántos de la lista de espera pasaron a la zona al encenderla.
  const [pasaron, setPasaron] = useState<{ zona: string; n: number } | null>(null);
  // C-ZONA-MUNICIPIO: el filtro por municipio, guardado por empleado (C-FILTROS-GUARDADOS).
  const pref = usePreferencias('zonas', { municipio: '' });
  const filtro = pref.valores.municipio ?? '';
  const municipios = [
    ...new Map(
      zonas
        .filter((z) => z.municipioClave)
        .map((z) => [z.municipioClave ?? '', z.municipioNombre ?? ''] as const),
    ),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  const visibles = zonas.filter((z) =>
    !filtro ? true : filtro === SIN_MUNICIPIO ? !z.municipioClave : z.municipioClave === filtro,
  );
  const paisNueva = nueva.id.slice(0, 2).toUpperCase();
  const usadosEn = (pais: string) =>
    zonas.filter((z) => z.pais === pais && z.municipioNombre).map((z) => z.municipioNombre ?? '');
  const sugerenciasNueva = useSugerenciasMunicipio(
    paisNueva,
    nueva.region || (nueva.id.split('-')[1] ?? ''),
    usadosEn(paisNueva),
  );

  const cargar = () =>
    pedir<{ zonas: Zona[] }>('GET', '/datos/admin/zonas')
      .then((r) => setZonas(r.zonas))
      .catch((e: unknown) => setError({ mensaje: e instanceof ErrorApi ? e.message : String(e) }));
  useEffect(() => {
    void cargar();
  }, []);

  async function alternar(z: Zona) {
    setError(null);
    setPasaron(null);
    try {
      const r = await pedir<unknown>('PATCH', `/datos/admin/zonas/${z.id}`, { activa: !z.activa });
      const n = pasaronDeRespuesta(r);
      if (!z.activa && n != null) setPasaron({ zona: z.id, n });
      await cargar();
    } catch (e) {
      setError({ mensaje: e instanceof ErrorApi ? e.message : String(e) });
    }
  }

  // C-FOTO-PUERTA: el interruptor por zona de la primera foto obligatoria (de fábrica apagado).
  async function alternarFotoPuerta(z: Zona) {
    setError(null);
    try {
      await pedir('PATCH', `/datos/admin/zonas/${z.id}`, {
        fotoPuertaObligatoria: !z.fotoPuertaObligatoria,
      });
      await cargar();
    } catch (e) {
      setError({ mensaje: e instanceof ErrorApi ? e.message : String(e) });
    }
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
        // C-ZONA-POR-PAIS: la moneda y la hora de la ciudad salen de su país (nunca dólares fijos).
        ...zonaDeFabrica(nueva.id.slice(0, 2)),
        lat: Number(nueva.lat),
        lng: Number(nueva.lng),
        radioKm: Number(nueva.radio),
        region: nueva.region,
        // C-ZONA-MUNICIPIO: el municipio elegido de la lista o escrito a mano.
        municipio: nueva.municipio,
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
      <CiudadesWeb idioma={idioma} />
      <label className="campo">
        <span>
          {t.filtroMunicipio} <AyudaAqui guia="zone-municipality" parrafo={4} idioma={idioma} />
        </span>
        <select
          value={filtro}
          onChange={(e) => pref.cambiar('municipio', e.target.value)}
          data-testid="filtro-municipio"
        >
          <option value="">{t.todosMunicipios}</option>
          {municipios.map(([clave, nombre]) => (
            <option key={clave} value={clave}>
              {nombre}
            </option>
          ))}
          <option value={SIN_MUNICIPIO}>{t.sinMunicipio}</option>
        </select>
      </label>
      <AvisoFiltrosGuardados
        visible={pref.guardados}
        idioma={idioma}
        restablecer={pref.restablecer}
      />
      {zonas.length > 0 && visibles.length === 0 && <p className="suave">{t.ningunaZona}</p>}
      <ul className="lista">
        {visibles.map((z) => (
          <li key={z.id}>
            <div className="lista-texto">
              <strong>
                {z.nombre} · {z.id}
              </strong>
              <span>
                {z.restaurantes} {t.restaurantes} · {z.repartidores} {t.repartidores} · {z.enEspera}{' '}
                {t.enEspera}
              </span>
              {z.municipioNombre ? (
                <span data-testid={`zona-municipio-${z.id}`}>
                  {t.municipioZona}: {z.municipioNombre}
                  {z.municipio && z.municipio.nombre === z.municipioNombre
                    ? `, ${z.municipio.entidad.nombre} (${z.municipio.pcode})`
                    : ''}
                </span>
              ) : null}
              {z.municipio && z.municipio.nombre !== z.municipioNombre ? (
                <span>
                  {t.municipio}: {z.municipio.nombre}, {z.municipio.entidad.nombre} (
                  {z.municipio.pcode})
                </span>
              ) : null}
              <Insignia estado={z.activa ? 'activa' : 'apagada'}>
                {z.activa ? t.activa : t.apagada}
              </Insignia>
            </div>
            <button
              type="button"
              className="boton secundario chico"
              onClick={() => void alternar(z)}
            >
              {z.activa ? t.apagar : t.activar}
            </button>
            <button
              type="button"
              className="boton secundario chico"
              aria-expanded={conAreas === z.id}
              onClick={() => setConAreas(conAreas === z.id ? null : z.id)}
            >
              {conAreas === z.id ? t.ocultar : t.areas}
            </button>
            <label className="lista-texto" style={{ flexBasis: '100%', cursor: 'pointer' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  role="switch"
                  checked={z.fotoPuertaObligatoria}
                  onChange={() => void alternarFotoPuerta(z)}
                  data-testid={`zona-foto-puerta-${z.id}`}
                />
                <strong>{t.fotoPuerta}</strong>
              </span>
              <span>{t.fotoPuertaAyuda}</span>
            </label>
            {pasaron?.zona === z.id ? <AvisoPasaron n={pasaron.n} idioma={idioma} /> : null}
            {z.activa ? <PasarEspera zonaId={z.id} idioma={idioma} alPasar={cargar} /> : null}
            <MunicipioZona
              zona={z}
              cuenta={usuario.id}
              idioma={idioma}
              yaUsados={usadosEn(z.pais)}
              alGuardar={cargar}
            />
            <ResponsableZona zona={z} cuenta={usuario.id} idioma={idioma} alGuardar={cargar} />
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
        {(['id', 'nombre', 'region'] as const).map((k) => (
          <label className="campo" key={k}>
            <span>{k === 'id' ? t.codigo : k === 'nombre' ? t.nombre : t.region}</span>
            <input
              value={k === 'id' ? nueva.id : k === 'nombre' ? nueva.nombre : nueva.region}
              onChange={(e) => b.cambiar(k, e.target.value)}
            />
          </label>
        ))}
        <CampoMunicipio
          id="nueva"
          valor={nueva.municipio}
          cambiar={(v) => b.cambiar('municipio', v)}
          sugerencias={sugerenciasNueva}
          idioma={idioma}
        />
        {(['lat', 'lng', 'radio'] as const).map((k) => (
          <label className="campo" key={k}>
            <span>{k === 'lat' ? t.lat : k === 'lng' ? t.lng : t.radio}</span>
            <input
              value={k === 'lat' ? nueva.lat : k === 'lng' ? nueva.lng : nueva.radio}
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
    porPais?: Record<string, number>;
  } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    pedir<{
      personas: Persona[];
      totales: Record<string, number>;
      porPais?: Record<string, number>;
    }>('GET', `/datos/admin/lista-espera${tipo ? `?tipo=${tipo}` : ''}`)
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
      {/* C-DISPONIBLE-MUNDO: de qué países nos piden llegar. */}
      {datos?.porPais && Object.keys(datos.porPais).length > 0 && (
        <p className="suave" data-testid="espera-por-pais">
          {Object.entries(datos.porPais)
            .map(([codigo, n]) => `${nombrePais(codigo, idioma)}: ${n}`)
            .join(' · ')}
        </p>
      )}
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
                {nombreTipo(p.tipo)} · {p.ciudad}
                {p.pais ? ` (${nombrePais(p.pais, idioma)})` : ''} · {p.zonaId ?? t.sinZona}
                {p.origen === 'app' ? ' · app' : ''}
                {p.vehiculo ? ` · ${p.vehiculo}` : ''}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
