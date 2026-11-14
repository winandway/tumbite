import { Inbox, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Enlace } from '../../Enlace';
import { IconoDe } from './menus';

/**
 * C-PANEL-ARMAZON: las piezas del tablero de cualquier panel web. Reglas que cumplen todas:
 * solo pintan los datos que reciben (nunca de muestra), sin datos muestran su estado vacío, lo que
 * sale bien va en verde y el rojo queda para los problemas (C-VERDE-EXITO).
 */
export type Tono = 'neutro' | 'exito' | 'problema' | 'espera' | 'marca' | 'logistica' | 'suave';

/** Encabezado de una página del panel: título, una línea de contexto y sus acciones. */
export function EncabezadoPagina({
  titulo,
  detalle,
  children,
}: {
  titulo: string;
  detalle?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="pd-encabezado">
      <div>
        <h1>{titulo}</h1>
        {detalle ? <p className="pd-encabezado-detalle">{detalle}</p> : null}
      </div>
      {children ? <div className="pd-encabezado-acciones">{children}</div> : null}
    </div>
  );
}

/** Tarjeta blanca con título: el contenedor de gráficas, listas y tablas. */
export function Tarjeta({
  titulo,
  accion,
  children,
  className,
}: {
  titulo?: string;
  accion?: { texto: string; a: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className ? `pd-tarjeta ${className}` : 'pd-tarjeta'}>
      {titulo ? (
        <header className="pd-tarjeta-cabeza">
          <h2>{titulo}</h2>
          {accion ? (
            <Enlace a={accion.a} className="pd-tarjeta-accion">
              {accion.texto}
            </Enlace>
          ) : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

/** Rejilla de tarjetas de métrica. */
export function Metricas({ children }: { children: React.ReactNode }) {
  return <ul className="pd-metricas">{children}</ul>;
}

export function TarjetaMetrica({
  etiqueta,
  valor,
  icono,
  detalle,
  variacion,
  a,
  tono = 'neutro',
}: {
  etiqueta: string;
  valor: React.ReactNode;
  /** Clave del ícono (las mismas del menú). */
  icono: string;
  detalle?: React.ReactNode;
  /** Solo cuando hay con qué comparar de verdad. */
  variacion?: { texto: string; sentido: 'sube' | 'baja' | 'igual' };
  a?: string;
  tono?: Tono;
}) {
  const Flecha =
    variacion?.sentido === 'sube'
      ? TrendingUp
      : variacion?.sentido === 'baja'
        ? TrendingDown
        : Minus;
  const cuerpo = (
    <>
      <span className={`pd-metrica-icono pd-tono-${tono}`} aria-hidden="true">
        <IconoDe clave={icono} tamano={22} />
      </span>
      <span className="pd-metrica-texto">
        <span className="pd-metrica-etiqueta">{etiqueta}</span>
        <strong
          className={
            typeof valor === 'string' && valor.length > 12
              ? 'pd-metrica-valor pd-metrica-valor-texto'
              : 'pd-metrica-valor'
          }
        >
          {valor}
        </strong>
        {variacion ? (
          <span className={`pd-variacion pd-${variacion.sentido}`}>
            <Flecha size={15} aria-hidden="true" />
            {variacion.texto}
          </span>
        ) : null}
        {detalle ? <small className="pd-metrica-detalle">{detalle}</small> : null}
      </span>
    </>
  );
  return (
    <li className="pd-metrica">
      {a ? (
        <Enlace a={a} className="pd-metrica-enlace">
          {cuerpo}
        </Enlace>
      ) : (
        <div className="pd-metrica-enlace">{cuerpo}</div>
      )}
    </li>
  );
}

/** Tarjeta con barra de avance. El avance es éxito: va en verde salvo que se pida otro tono. */
export function TarjetaAvance({
  titulo,
  detalle,
  porcentaje,
  tono = 'exito',
  sinPorcentaje = false,
}: {
  titulo: string;
  detalle?: React.ReactNode;
  porcentaje: number;
  tono?: Tono;
  /** La barra compara cantidades (no es un porcentaje): se muestra el detalle en su lugar. */
  sinPorcentaje?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(porcentaje)));
  return (
    <div className="pd-avance">
      <div className="pd-avance-cabeza">
        <strong>{titulo}</strong>
        <span>{sinPorcentaje ? detalle : `${pct} %`}</span>
      </div>
      <div
        className="pd-avance-barra"
        role="progressbar"
        aria-label={titulo}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <span className={`pd-tono-${tono}`} style={{ width: `${pct}%` }} />
      </div>
      {detalle && !sinPorcentaje ? <small>{detalle}</small> : null}
    </div>
  );
}

export function EstadoVacio({
  titulo,
  texto,
  children,
}: {
  titulo: string;
  texto?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="pd-vacio">
      <span className="pd-vacio-icono" aria-hidden="true">
        <Inbox size={26} strokeWidth={1.7} />
      </span>
      <strong>{titulo}</strong>
      {texto ? <p>{texto}</p> : null}
      {children}
    </div>
  );
}

export type ParteDona = { etiqueta: string; valor: number; tono: Tono };

/** Dona (torta con hueco) en SVG propio. El centro dice cuánto pesa la primera parte. */
export function Dona({
  titulo,
  partes,
  vacio,
  centro,
}: {
  titulo: string;
  partes: ParteDona[];
  /** Qué decir cuando todas las partes valen cero. */
  vacio: string;
  /** Texto del centro; si falta, el porcentaje de la primera parte. */
  centro?: string;
}) {
  const total = partes.reduce((s, p) => s + Math.max(0, p.valor), 0);
  if (total <= 0) return <EstadoVacio titulo={vacio} />;
  const R = 54;
  const largo = 2 * Math.PI * R;
  const visibles = partes.filter((p) => p.valor > 0);
  const arcos = visibles.map((p, i) => ({
    ...p,
    tramo: (p.valor / total) * largo,
    inicio: visibles.slice(0, i).reduce((suma, q) => suma + (q.valor / total) * largo, 0),
  }));
  const primera = partes[0];
  const texto = centro ?? `${Math.round(((primera?.valor ?? 0) / total) * 100)} %`;
  return (
    <div className="pd-dona">
      <div className="pd-dona-dibujo">
        <svg
          viewBox="0 0 140 140"
          role="img"
          aria-label={`${titulo}. ${partes.map((p) => `${p.etiqueta}: ${p.valor}`).join(', ')}`}
        >
          <circle cx="70" cy="70" r={R} fill="none" className="pd-dona-fondo" strokeWidth="18" />
          {arcos.map((a) => (
            <circle
              key={a.etiqueta}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              strokeWidth="18"
              className={`pd-trazo-${a.tono}`}
              strokeDasharray={`${a.tramo} ${largo - a.tramo}`}
              strokeDashoffset={-a.inicio}
              transform="rotate(-90 70 70)"
            />
          ))}
        </svg>
        <span className="pd-dona-centro">{texto}</span>
      </div>
      <ul className="pd-leyenda">
        {partes.map((p) => (
          <li key={p.etiqueta}>
            <span className={`pd-punto pd-tono-${p.tono}`} aria-hidden="true" />
            <span>{p.etiqueta}</span>
            <strong>{p.valor}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Gráfica de barras verticales con su escala. Sin valores mayores que cero, estado vacío. */
export function GraficaBarras({
  titulo,
  datos,
  vacio,
  formato = (n: number) => String(n),
  tono = 'neutro',
}: {
  titulo: string;
  datos: { etiqueta: string; valor: number }[];
  vacio: string;
  formato?: (n: number) => string;
  tono?: Tono;
}) {
  const max = Math.max(0, ...datos.map((d) => d.valor));
  if (max <= 0) return <EstadoVacio titulo={vacio} />;
  // Tope redondo de la escala: 1, 2 o 5 por su potencia de diez.
  const potencia = 10 ** Math.floor(Math.log10(max));
  const tope = [1, 2, 5, 10].map((m) => m * potencia).find((m) => m >= max) ?? max;
  // Con un tope de 1 no hay media marca entera: solo el tope y el cero.
  const marcas = Number.isInteger(tope / 2) ? [tope, tope / 2, 0] : [tope, 0];
  return (
    <div
      className="pd-barras"
      role="img"
      aria-label={`${titulo}. ${datos.map((d) => `${d.etiqueta}: ${formato(d.valor)}`).join(', ')}`}
    >
      <div className="pd-barras-escala" aria-hidden="true">
        {marcas.map((m) => (
          <span key={m}>{formato(Math.round(m))}</span>
        ))}
      </div>
      <div className="pd-barras-lienzo" aria-hidden="true">
        {datos.map((d, i) => (
          <div
            key={`${d.etiqueta}-${i}`}
            className="pd-barra"
            title={`${d.etiqueta}: ${formato(d.valor)}`}
          >
            <span
              className={`pd-tono-${tono}`}
              style={{ height: `${d.valor > 0 ? Math.max(3, (d.valor / tope) * 100) : 0}%` }}
            />
            <small>{d.etiqueta}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

export type Actividad = {
  id: string;
  titulo: string;
  detalle?: string;
  hora?: string;
  tono?: Tono;
  a?: string;
};

/** Lista de lo último que pasó: hora, una marca de color y el texto. */
export function ListaActividad({ items, vacio }: { items: Actividad[]; vacio: string }) {
  if (items.length === 0) return <EstadoVacio titulo={vacio} />;
  return (
    <ul className="pd-actividad">
      {items.map((i) => {
        const cuerpo = (
          <>
            {i.hora ? <time>{i.hora}</time> : null}
            <span
              className={`pd-actividad-marca pd-tono-${i.tono ?? 'neutro'}`}
              aria-hidden="true"
            />
            <span className="pd-actividad-texto">
              <strong>{i.titulo}</strong>
              {i.detalle ? <small>{i.detalle}</small> : null}
            </span>
          </>
        );
        return <li key={i.id}>{i.a ? <Enlace a={i.a}>{cuerpo}</Enlace> : <div>{cuerpo}</div>}</li>;
      })}
    </ul>
  );
}

/** Estado en una pastilla. Éxito verde, problema rojo, espera ámbar, lo demás gris. */
export function Pastilla({
  tono = 'neutro',
  children,
}: {
  tono?: Tono;
  children: React.ReactNode;
}) {
  return <span className={`pd-pastilla pd-pastilla-${tono}`}>{children}</span>;
}

export type Columna = { clave: string; titulo: string; numero?: boolean };

/** Tabla con cabecera fija; las celdas pueden traer pastillas o enlaces. */
export function Tabla({
  columnas,
  filas,
  vacio,
}: {
  columnas: Columna[];
  filas: ({ id: string } & Record<string, React.ReactNode>)[];
  vacio: string;
}) {
  if (filas.length === 0) return <EstadoVacio titulo={vacio} />;
  return (
    <div className="pd-tabla-caja tabla-ancha">
      <table className="pd-tabla tabla">
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c.clave} scope="col" className={c.numero ? 'pd-num' : undefined}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const celdas = new Map(Object.entries(f));
            return (
              <tr key={f.id}>
                {columnas.map((c) => (
                  <td key={c.clave} className={c.numero ? 'pd-num' : undefined}>
                    {celdas.get(c.clave)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
