import { useCallback, useEffect, useId, useState } from 'react';
import { ErrorApi, type Idioma } from '@tumbite/compartido';
import { pedir } from '../api';
import { EstadoVacio } from '../armazon/Piezas';
import { usePermisos } from '../permisosPanel';
import { accionEnPalabras, fechaHora, objetoEnPalabras, textosEquipo } from './textos';

type Fila = {
  id: number;
  usuarioId: string;
  nombre: string | null;
  que: string;
  detalle: string | number;
  creadoEn: string;
};
type Tipo = 'acciones' | 'permisos' | 'accesos';

/**
 * Registro del equipo (C-PERMISOS-FINOS): cambios, altas y permisos, y lo que se vio, con filtros
 * por persona, tipo y fecha; «Cargar más» por clave y exportación CSV (el servidor escapa las
 * celdas que una hoja de cálculo leería como fórmula). Nunca muestra teléfonos, correos ni fotos.
 */
export function Registro({ idioma }: { idioma: Idioma }) {
  const t = textosEquipo(idioma);
  const id = useId();
  const { puedeVer } = usePermisos();
  const tipos: Tipo[] = [
    'acciones',
    'permisos',
    ...(puedeVer('auditoria.accesos') ? (['accesos'] as const) : []),
  ];
  const [tipo, setTipo] = useState<Tipo>('acciones');
  const [persona, setPersona] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [filas, setFilas] = useState<Fila[]>([]);
  const [siguiente, setSiguiente] = useState<string | null>(null);
  const [personas, setPersonas] = useState<{ id: string; nombre: string }[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    pedir<{ miembros: { id: string; nombre: string }[] }>('GET', '/datos/admin/equipo/miembros')
      .then((r) => setPersonas(r.miembros))
      .catch(() => setPersonas([]));
  }, []);

  const consulta = useCallback(
    (extra: Record<string, string> = {}) => {
      const p = new URLSearchParams({ tipo });
      if (persona) p.set('usuario', persona);
      if (desde) p.set('desde', desde);
      if (hasta) p.set('hasta', hasta);
      for (const [k, v] of Object.entries(extra)) p.set(k, v);
      return `/datos/admin/equipo/registro?${p.toString()}`;
    },
    [tipo, persona, desde, hasta],
  );
  const cargar = useCallback(
    (despues: string | null = null) => {
      pedir<{ registro: Fila[]; siguiente: string | null }>(
        'GET',
        consulta(despues ? { despues } : {}),
      )
        .then((r) => {
          setFilas((antes) => (despues ? [...antes, ...r.registro] : r.registro));
          setSiguiente(r.siguiente);
          setError('');
        })
        .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
    },
    [consulta],
  );
  useEffect(() => cargar(), [cargar]);

  async function exportar() {
    setError('');
    try {
      const r = await fetch(consulta({ formato: 'csv' }), { credentials: 'same-origin' });
      if (!r.ok) throw new Error(String(r.status));
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `divoox-team-log-${tipo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (x) {
      setError(String(x));
    }
  }

  const que = (f: Fila) =>
    tipo === 'accesos'
      ? (new Map(Object.entries(t.tiposAcceso)).get(f.que) ?? f.que)
      : tipo === 'acciones'
        ? f.que.replace('/datos/admin', '')
        : accionEnPalabras(f.que, t);
  const detalle = (f: Fila) =>
    tipo === 'accesos'
      ? objetoEnPalabras(String(f.detalle).split(' · ')[0] ?? '', t)
      : tipo === 'acciones'
        ? Number(f.detalle) >= 400
          ? `${t.rechazado} (${String(f.detalle)})`
          : String(f.detalle)
        : String(f.detalle).replace(/^equipo:/, '');

  return (
    <section className="pd-tarjeta">
      <div className="eq-filtros">
        <div className="campo">
          <label htmlFor={`${id}-tipo`}>{t.tipoRegistro}</label>
          <select id={`${id}-tipo`} value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
            {tipos.map((x) => (
              <option key={x} value={x}>
                {new Map(Object.entries(t.tiposRegistro)).get(x)}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor={`${id}-persona`}>{t.persona}</label>
          <select id={`${id}-persona`} value={persona} onChange={(e) => setPersona(e.target.value)}>
            <option value="">{t.todas}</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor={`${id}-desde`}>{t.desde}</label>
          <input
            id={`${id}-desde`}
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </div>
        <div className="campo">
          <label htmlFor={`${id}-hasta`}>{t.hasta}</label>
          <input
            id={`${id}-hasta`}
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>
        <button type="button" className="boton secundario" onClick={() => void exportar()}>
          {t.exportar}
        </button>
      </div>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {filas.length === 0 ? <EstadoVacio titulo={t.sinRegistro} /> : null}
      {filas.length ? (
        <div className="pd-tabla-caja tabla-ancha">
          <table className="pd-tabla tabla">
            <thead>
              <tr>
                <th scope="col">{t.columnasRegistro.fecha}</th>
                <th scope="col">{t.columnasRegistro.persona}</th>
                <th scope="col">{t.columnasRegistro.que}</th>
                <th scope="col">{t.columnasRegistro.detalle}</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id}>
                  <td>{fechaHora(f.creadoEn, idioma)}</td>
                  <td>{f.nombre ?? f.usuarioId}</td>
                  <td>{que(f)}</td>
                  <td>{detalle(f)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {siguiente ? (
        <button type="button" className="boton secundario" onClick={() => cargar(siguiente)}>
          {t.cargarMas}
        </button>
      ) : null}
    </section>
  );
}
