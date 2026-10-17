import { useEffect, useState } from 'react';
import {
  ESTADOS_AREA,
  ErrorApi,
  type EstadoArea,
  type Idioma,
  type Poligono,
  type Usuario,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { EditorArea } from './EditorArea';
import { pedir } from './api';

/** Las áreas de cobertura de una ciudad (C-TERRITORIO): dibujarlas, publicarlas y pausarlas. */
type Area = {
  id: string;
  nombre: string;
  estado: EstadoArea;
  poligono: Poligono;
  prioridad: number;
  aperturaPrevista: string | null;
  franquicia: { id: string; nombre: string } | null;
};

const T = {
  es: {
    titulo: 'Áreas de cobertura',
    explicacion:
      'Mientras la ciudad no tenga áreas publicadas, se atiende su círculo. Apenas publiques una, solo se atiende dentro de las áreas activas.',
    vacio: 'Esta ciudad todavía no tiene áreas.',
    nueva: 'Nueva área',
    nombre: 'Nombre del área',
    estado: 'Estado',
    prioridad: 'Prioridad (si dos áreas comparten borde, gana la mayor)',
    apertura: 'Apertura prevista',
    guardar: 'Guardar área',
    guardada: 'Área guardada',
    editarBorde: 'Editar el borde',
    guardarBorde: 'Guardar el borde',
    cancelar: 'Cancelar',
    sinFranquicia: 'Sin franquicia',
    estados: {
      borrador: 'Borrador',
      proximamente: 'Próximamente',
      activa: 'Activa',
      pausada: 'Pausada',
      cerrada: 'Cerrada',
    } as Record<EstadoArea, string>,
  },
  en: {
    titulo: 'Coverage areas',
    explicacion:
      'Until the city has published areas, its circle is served. As soon as you publish one, only active areas are served.',
    vacio: 'This city has no areas yet.',
    nueva: 'New area',
    nombre: 'Area name',
    estado: 'Status',
    prioridad: 'Priority (when two areas share a border, the higher one wins)',
    apertura: 'Planned opening',
    guardar: 'Save area',
    guardada: 'Area saved',
    editarBorde: 'Edit border',
    guardarBorde: 'Save border',
    cancelar: 'Cancel',
    sinFranquicia: 'No franchise',
    estados: {
      borrador: 'Draft',
      proximamente: 'Coming soon',
      activa: 'Live',
      pausada: 'Paused',
      cerrada: 'Closed',
    } as Record<EstadoArea, string>,
  },
};

const VACIA = {
  nombre: '',
  estado: 'borrador' as EstadoArea,
  prioridad: '0',
  apertura: '',
  poligono: [] as Poligono,
};

export function AreasCiudad({
  zona,
  usuario,
  idioma,
}: {
  zona: { id: string; lat: number; lng: number };
  usuario: Usuario;
  idioma: Idioma;
}) {
  const t = enIdioma(T, idioma);
  const nombreEstado = (e: EstadoArea) => new Map(Object.entries(t.estados)).get(e) ?? e;
  const [areas, setAreas] = useState<Area[]>([]);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [editando, setEditando] = useState<{ id: string; poligono: Poligono } | null>(null);
  const b = useBorrador({
    formulario: `area-nueva-${zona.id}`,
    cuenta: usuario.id,
    inicial: VACIA,
    almacen: almacenNavegador,
  });
  const nueva = b.valores;
  const mensaje = (x: unknown) => (x instanceof ErrorApi ? x.message : String(x));

  const cargar = () =>
    pedir<{ areas: Area[] }>('GET', `/datos/admin/zonas/${zona.id}/areas`)
      .then((r) => setAreas(r.areas))
      .catch((x: unknown) => setError(mensaje(x)));
  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zona.id]);

  async function cambiarArea(id: string, cambio: Record<string, unknown>) {
    setError('');
    try {
      await pedir('PATCH', `/datos/admin/areas/${id}`, cambio);
      setEditando(null);
      await cargar();
    } catch (x) {
      setError(mensaje(x));
    }
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setAviso('');
    try {
      await pedir('POST', `/datos/admin/zonas/${zona.id}/areas`, {
        nombre: nueva.nombre,
        estado: nueva.estado,
        prioridad: Number(nueva.prioridad) || 0,
        aperturaPrevista: nueva.apertura || null,
        poligono: nueva.poligono,
      });
      setAviso(t.guardada);
      await b.limpiar();
      await cargar();
    } catch (x) {
      // Lo dibujado se queda en pantalla: nada se pierde si el servidor dice que no.
      setError(mensaje(x));
    }
  }

  const otras = (salvo: string | null) =>
    areas.filter((a) => a.id !== salvo && a.estado !== 'cerrada');

  return (
    <div className="areas-ciudad">
      <h3>{t.titulo}</h3>
      <p className="pista">{t.explicacion}</p>
      {error && (
        <p className="error-general" role="alert">
          {error}
        </p>
      )}
      {areas.length === 0 && <p>{t.vacio}</p>}
      <ul className="lista">
        {areas.map((a) => (
          <li key={a.id}>
            <div className="lista-texto">
              <strong>{a.nombre}</strong>
              <span>
                {a.franquicia?.nombre ?? t.sinFranquicia}
                {a.aperturaPrevista ? ` · ${t.apertura}: ${a.aperturaPrevista}` : ''}
              </span>
              <span className={`insignia ${a.estado === 'activa' ? 'insignia-aprobado' : ''}`}>
                {nombreEstado(a.estado)}
              </span>
            </div>
            <label className="campo">
              <span>{t.estado}</span>
              <select
                value={a.estado}
                onChange={(e) => void cambiarArea(a.id, { estado: e.target.value })}
              >
                {ESTADOS_AREA.map((s) => (
                  <option key={s} value={s}>
                    {nombreEstado(s)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="boton secundario"
              onClick={() => setEditando({ id: a.id, poligono: a.poligono })}
            >
              {t.editarBorde}
            </button>
          </li>
        ))}
      </ul>
      {editando && (
        <div className="tarjeta-form">
          <EditorArea
            centro={zona}
            poligono={editando.poligono}
            otras={otras(editando.id)}
            cambiar={(p) => setEditando({ ...editando, poligono: p })}
            idioma={idioma}
          />
          <div className="fila-botones">
            <button
              type="button"
              className="boton"
              onClick={() => void cambiarArea(editando.id, { poligono: editando.poligono })}
            >
              {t.guardarBorde}
            </button>
            <button type="button" className="boton secundario" onClick={() => setEditando(null)}>
              {t.cancelar}
            </button>
          </div>
        </div>
      )}
      <form onSubmit={crear} className="formulario tarjeta-form">
        <h3>{t.nueva}</h3>
        <AvisoBorrador
          visible={b.recuperado}
          idioma={idioma}
          empezar={() => void b.empezarDeNuevo()}
        />
        <label className="campo">
          <span>{t.nombre}</span>
          <input value={nueva.nombre} onChange={(e) => b.cambiar('nombre', e.target.value)} />
        </label>
        <label className="campo">
          <span>{t.estado}</span>
          <select
            value={nueva.estado}
            onChange={(e) => b.cambiar('estado', e.target.value as EstadoArea)}
          >
            {ESTADOS_AREA.map((s) => (
              <option key={s} value={s}>
                {nombreEstado(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>{t.prioridad}</span>
          <input
            inputMode="numeric"
            value={nueva.prioridad}
            onChange={(e) => b.cambiar('prioridad', e.target.value)}
          />
        </label>
        <label className="campo">
          <span>{t.apertura}</span>
          <input
            type="date"
            value={nueva.apertura}
            onChange={(e) => b.cambiar('apertura', e.target.value)}
          />
        </label>
        <EditorArea
          centro={zona}
          poligono={nueva.poligono}
          otras={otras(null)}
          cambiar={(p) => b.cambiar('poligono', p)}
          idioma={idioma}
        />
        {aviso && (
          <p className="ok" role="status">
            {aviso}
          </p>
        )}
        <button type="submit" className="boton" disabled={nueva.poligono.length < 3}>
          {t.guardar}
        </button>
      </form>
    </div>
  );
}
