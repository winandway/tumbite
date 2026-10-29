import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  NOMBRES_COMERCIO,
  PLANTILLA_PRODUCTOS,
  TIPOS_COMERCIO,
  almacenNavegador,
  enIdioma,
  formatearMonto,
  precioACentavos,
  useBorrador,
} from '@tumbite/compartido';
import { Campo } from './CampoClave';
import { pedir } from './api';

/**
 * Tiendas · Fase 1 en el panel (C-TIENDAS-CATALOGO): el comercio elige su tipo y sube su catálogo,
 * con la planilla estándar (vista previa y errores por fila) o uno por uno. Nunca se borra: se agota.
 * El público todavía no ve las tiendas: se cargan ahora para que estén el día del lanzamiento.
 */
const T = {
  es: {
    titulo: 'Productos de tu tienda',
    ayuda:
      'Sube aquí tu catálogo. Todavía no se muestra al público: así, el día del lanzamiento tus productos ya están en Divoox.',
    tipo: 'Tipo de negocio',
    guardarTipo: 'Guardar el tipo',
    tipoGuardado: 'Tipo de negocio guardado.',
    productos: 'Productos',
    disponibles: 'Disponibles',
    sinFoto: 'Sin foto',
    planilla: 'Subir una planilla',
    planillaAyuda:
      'Usa la plantilla: una fila por producto. El SKU es tu código interno; si el producto ya existe, se actualiza.',
    plantilla: 'Descargar la plantilla',
    archivo: 'Archivo de la planilla (.csv)',
    revisar: 'Revisar la planilla',
    guardarPlanilla: (n: number) => `Guardar ${n} productos`,
    previa: (n: number, a: number, e: number) =>
      `Se van a crear ${n}, actualizar ${a} y hay ${e} filas con error.`,
    guardados: (n: number, a: number) => `Listo: ${n} productos nuevos y ${a} actualizados.`,
    fila: 'Fila',
    buscar: 'Buscar por nombre, marca, SKU o código de barras',
    todas: 'Todas las categorías',
    agotar: 'Agotar hoy',
    reactivar: 'Reactivar',
    agotado: 'Agotado',
    anteriores: 'Anteriores',
    siguientes: 'Siguientes',
    vacio: 'Todavía no hay productos. Sube la planilla o agrega uno abajo.',
    nuevo: 'Agregar un producto',
    sku: 'SKU (tu código interno)',
    codigo: 'Código de barras (opcional)',
    rellenar: 'Rellenar con el código',
    rellenado: 'Listo: revisa los datos y guarda. Datos de Open Food Facts.',
    noEncontrado: 'No encontramos ese código. Escribe los datos a mano.',
    nombre: 'Nombre del producto',
    marca: 'Marca',
    categoria: 'Categoría',
    precio: 'Precio',
    tamano: 'Tamaño (por ejemplo 500)',
    unidad: 'Unidad del tamaño',
    agregar: 'Guardar el producto',
    agregado: 'Producto guardado.',
  },
  en: {
    titulo: 'Your store products',
    ayuda:
      'Upload your catalog here. It isn’t shown to the public yet: this way, on launch day your products are already on Divoox.',
    tipo: 'Business type',
    guardarTipo: 'Save type',
    tipoGuardado: 'Business type saved.',
    productos: 'Products',
    disponibles: 'Available',
    sinFoto: 'Without photo',
    planilla: 'Upload a spreadsheet',
    planillaAyuda:
      'Use the template: one row per product. The SKU is your internal code; if the product exists, it’s updated.',
    plantilla: 'Download the template',
    archivo: 'Spreadsheet file (.csv)',
    revisar: 'Check the spreadsheet',
    guardarPlanilla: (n: number) => `Save ${n} products`,
    previa: (n: number, a: number, e: number) =>
      `${n} will be created, ${a} updated, and ${e} rows have errors.`,
    guardados: (n: number, a: number) => `Done: ${n} new products and ${a} updated.`,
    fila: 'Row',
    buscar: 'Search by name, brand, SKU or barcode',
    todas: 'All categories',
    agotar: 'Out of stock today',
    reactivar: 'Back in stock',
    agotado: 'Out of stock',
    anteriores: 'Previous',
    siguientes: 'Next',
    vacio: 'No products yet. Upload the spreadsheet or add one below.',
    nuevo: 'Add a product',
    sku: 'SKU (your internal code)',
    codigo: 'Barcode (optional)',
    rellenar: 'Fill in from the barcode',
    rellenado: 'Done: check the details and save. Data from Open Food Facts.',
    noEncontrado: 'We couldn’t find that barcode. Type the details in by hand.',
    nombre: 'Product name',
    marca: 'Brand',
    categoria: 'Category',
    precio: 'Price',
    tamano: 'Size (for example 500)',
    unidad: 'Size unit',
    agregar: 'Save product',
    agregado: 'Product saved.',
  },
};

type Producto = {
  id: string;
  sku: string;
  codigoBarras: string;
  nombreEs: string;
  nombreEn: string;
  marca: string;
  tamano: number | null;
  unidadTamano: string;
  categoria1: string;
  precio: number | null;
  disponible: boolean;
  existencias: number | null;
};
type Lista = {
  tipo: string;
  pais: string;
  moneda: string;
  productos: Producto[];
  hayMas: boolean;
  pagina: number;
  totales: { productos: number; disponibles: number; sinFoto: number };
  categorias: { nombre: string; n: number }[];
};
type Previa = {
  nuevos: number;
  actualizados: number;
  errores: { fila: number; error: string }[];
  totalErrores: number;
  guardado: boolean;
};

const mensaje = (e: unknown) => (e instanceof ErrorApi ? e.message : String(e));

function descargarPlantilla() {
  const ejemplo = [
    'SKU-0001',
    '',
    'Producto de ejemplo',
    'Marca',
    '500',
    'g',
    '1',
    'Despensa',
    '',
    '',
    '',
    'each',
    '',
    '',
    '',
    '2.50',
    'yes',
    '10',
    '',
  ];
  const texto = `${PLANTILLA_PRODUCTOS.join(',')}\n${ejemplo.join(',')}\n`;
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'divoox-plantilla-productos.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function Productos({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [datos, setDatos] = useState<Lista | null>(null);
  const [q, setQ] = useState('');
  const [categoria, setCategoria] = useState('');
  const [pagina, setPagina] = useState(1);
  const [tipo, setTipo] = useState('');
  const [csv, setCsv] = useState('');
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const b = useBorrador({
    formulario: 'tienda-producto-nuevo',
    inicial: {
      sku: '',
      codigoBarras: '',
      nombre: '',
      marca: '',
      categoria1: '',
      precio: '',
      tamano: '',
      unidadTamano: 'each',
      imagen: '',
    },
    almacen: almacenNavegador,
  });
  const v = b.valores;

  const cargar = useCallback(() => {
    const p = new URLSearchParams({ q, categoria, pagina: String(pagina) });
    pedir<Lista>('GET', `/datos/mi-restaurante/productos?${p.toString()}`)
      .then((r) => {
        setDatos(r);
        setTipo((x) => x || r.tipo);
      })
      .catch((e: unknown) => setError(mensaje(e)));
  }, [q, categoria, pagina]);
  useEffect(() => {
    const reloj = setTimeout(cargar, 250);
    return () => clearTimeout(reloj);
  }, [cargar]);

  async function hacer(trabajo: () => Promise<void>) {
    setError('');
    setAviso('');
    try {
      await trabajo();
    } catch (e) {
      setError(mensaje(e));
    }
  }

  const guardarTipo = () =>
    hacer(async () => {
      await pedir('PUT', '/datos/mi-restaurante/tipo', { tipo });
      setAviso(t.tipoGuardado);
      cargar();
    });
  const revisar = (confirmar: boolean) =>
    hacer(async () => {
      const r = await pedir<Previa>('POST', '/datos/mi-restaurante/productos/importar', {
        csv,
        confirmar,
      });
      setPrevia(r);
      if (r.guardado) {
        setAviso(t.guardados(r.nuevos, r.actualizados));
        setCsv('');
        cargar();
      }
    });
  const cambiarDisponible = (p: Producto) =>
    hacer(async () => {
      await pedir('PATCH', `/datos/mi-restaurante/productos/${p.id}/disponible`, {
        disponible: !p.disponible,
        hasta: 'hoy',
      });
      cargar();
    });
  const agregar = (e: React.FormEvent) => {
    e.preventDefault();
    void hacer(async () => {
      const ingles = datos?.pais === 'US';
      await pedir('PUT', '/datos/mi-restaurante/productos', {
        sku: v.sku,
        codigoBarras: v.codigoBarras,
        ...(ingles ? { nombreEn: v.nombre } : { nombreEs: v.nombre }),
        marca: v.marca,
        categoria1: v.categoria1,
        precio: precioACentavos(v.precio) ?? -1,
        tamano: v.tamano ? Number(v.tamano.replace(',', '.')) : null,
        unidadTamano: v.unidadTamano,
        imagen: v.imagen,
      });
      await b.limpiar();
      setAviso(t.agregado);
      cargar();
    });
  };

  // C-TIENDAS-CODIGO: con el código de barras se rellena la ficha (la tienda revisa y guarda).
  const rellenar = () =>
    hacer(async () => {
      const r = await pedir<{
        encontrado: boolean;
        nombreEs?: string;
        nombreEn?: string;
        marca?: string;
        tamano?: string;
        unidad?: string;
        imagen?: string;
      }>('GET', `/datos/mi-restaurante/productos/codigo/${encodeURIComponent(v.codigoBarras)}`);
      if (!r.encontrado) return setAviso(t.noEncontrado);
      const ingles = datos?.pais === 'US';
      const nombre = (ingles ? r.nombreEn || r.nombreEs : r.nombreEs || r.nombreEn) ?? '';
      if (nombre && !v.nombre) b.cambiar('nombre', nombre);
      if (r.marca && !v.marca) b.cambiar('marca', r.marca);
      if (r.tamano && !v.tamano) b.cambiar('tamano', r.tamano);
      if (r.unidad) b.cambiar('unidadTamano', r.unidad);
      if (r.imagen) b.cambiar('imagen', r.imagen);
      setAviso(t.rellenado);
    });

  async function leerArchivo(f: File | undefined) {
    if (!f) return;
    setPrevia(null);
    setCsv(await f.text());
  }

  const nombreDe = (p: Producto) =>
    idioma === 'en' ? p.nombreEn || p.nombreEs : p.nombreEs || p.nombreEn;
  return (
    <section className="super" data-testid="productos-tienda">
      <h1>{t.titulo}</h1>
      <p className="pista">{t.ayuda}</p>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {aviso ? <p role="status">{aviso}</p> : null}

      <div className="fila-botones">
        <div className="campo">
          <label htmlFor="tienda-tipo">{t.tipo}</label>
          <select id="tienda-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_COMERCIO.map((x) => (
              <option key={x} value={x}>
                {idioma === 'en'
                  ? NOMBRES_COMERCIO[x as keyof typeof NOMBRES_COMERCIO].en
                  : NOMBRES_COMERCIO[x as keyof typeof NOMBRES_COMERCIO].es}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="boton secundario" onClick={() => void guardarTipo()}>
          {t.guardarTipo}
        </button>
      </div>

      {datos ? (
        <ul className="super-tarjetas">
          <li className="super-tarjeta">
            <span>{t.productos}</span>
            <strong>{datos.totales.productos}</strong>
          </li>
          <li className="super-tarjeta">
            <span>{t.disponibles}</span>
            <strong>{datos.totales.disponibles}</strong>
          </li>
          <li className="super-tarjeta">
            <span>{t.sinFoto}</span>
            <strong>{datos.totales.sinFoto}</strong>
          </li>
        </ul>
      ) : null}

      <h2>{t.planilla}</h2>
      <p className="pista">{t.planillaAyuda}</p>
      <div className="fila-botones">
        <button type="button" className="boton secundario" onClick={descargarPlantilla}>
          {t.plantilla}
        </button>
        <label className="campo">
          <span>{t.archivo}</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void leerArchivo(e.target.files?.[0])}
          />
        </label>
        <button type="button" className="boton" disabled={!csv} onClick={() => void revisar(false)}>
          {t.revisar}
        </button>
      </div>
      {previa && !previa.guardado ? (
        <div className="flex-tarjeta" data-testid="previa-planilla">
          <p>{t.previa(previa.nuevos, previa.actualizados, previa.totalErrores)}</p>
          {previa.errores.length ? (
            <ul className="super-lista">
              {previa.errores.map((e) => (
                <li key={e.fila}>
                  {t.fila} {e.fila}: {e.error}
                </li>
              ))}
            </ul>
          ) : null}
          {previa.nuevos + previa.actualizados > 0 ? (
            <button type="button" className="boton" onClick={() => void revisar(true)}>
              {t.guardarPlanilla(previa.nuevos + previa.actualizados)}
            </button>
          ) : null}
        </div>
      ) : null}

      <h2>{t.productos}</h2>
      <div className="fila-botones">
        <Campo
          etiqueta={t.buscar}
          valor={q}
          cambiar={(x) => {
            setQ(x);
            setPagina(1);
          }}
          placeholder={t.buscar}
        />
        <div className="campo">
          <label htmlFor="tienda-categoria">{t.categoria}</label>
          <select
            id="tienda-categoria"
            value={categoria}
            onChange={(e) => {
              setCategoria(e.target.value);
              setPagina(1);
            }}
          >
            <option value="">{t.todas}</option>
            {datos?.categorias.map((c) => (
              <option key={c.nombre} value={c.nombre}>
                {c.nombre} ({c.n})
              </option>
            ))}
          </select>
        </div>
      </div>
      {datos && !datos.productos.length ? <p className="pista">{t.vacio}</p> : null}
      <ul className="super-lista" data-testid="lista-productos">
        {datos?.productos.map((p) => (
          <li key={p.id}>
            <strong>{nombreDe(p)}</strong> · {p.marca}
            {p.tamano ? ` · ${p.tamano} ${p.unidadTamano}` : ''} · {p.categoria1} ·{' '}
            {p.precio != null ? formatearMonto(p.precio, datos.moneda, idioma) : '—'} · {p.sku}
            {p.disponible ? null : <span className="insignia"> {t.agotado}</span>}{' '}
            <button type="button" className="enlace" onClick={() => void cambiarDisponible(p)}>
              {p.disponible ? t.agotar : t.reactivar}
            </button>
          </li>
        ))}
      </ul>
      <div className="fila-botones">
        {pagina > 1 ? (
          <button type="button" className="boton secundario" onClick={() => setPagina(pagina - 1)}>
            {t.anteriores}
          </button>
        ) : null}
        {datos?.hayMas ? (
          <button type="button" className="boton secundario" onClick={() => setPagina(pagina + 1)}>
            {t.siguientes}
          </button>
        ) : null}
      </div>

      <h2>{t.nuevo}</h2>
      <form className="flex-form" onSubmit={agregar} noValidate>
        <Campo
          etiqueta={t.sku}
          valor={v.sku}
          cambiar={(x) => b.cambiar('sku', x)}
          placeholder="SKU-0001"
        />
        <Campo
          etiqueta={t.codigo}
          valor={v.codigoBarras}
          cambiar={(x) => b.cambiar('codigoBarras', x)}
          placeholder="0000000000000"
        />
        <button
          type="button"
          className="boton secundario"
          disabled={v.codigoBarras.replace(/\D/g, '').length < 8}
          onClick={() => void rellenar()}
        >
          {t.rellenar}
        </button>
        {v.imagen ? (
          <img src={v.imagen} alt={v.nombre || t.nombre} className="foto-producto-previa" />
        ) : null}
        <Campo
          etiqueta={t.nombre}
          valor={v.nombre}
          cambiar={(x) => b.cambiar('nombre', x)}
          placeholder={t.nombre}
        />
        <Campo
          etiqueta={t.marca}
          valor={v.marca}
          cambiar={(x) => b.cambiar('marca', x)}
          placeholder={t.marca}
        />
        <Campo
          etiqueta={t.categoria}
          valor={v.categoria1}
          cambiar={(x) => b.cambiar('categoria1', x)}
          placeholder={t.categoria}
        />
        <Campo
          etiqueta={t.precio}
          valor={v.precio}
          cambiar={(x) => b.cambiar('precio', x)}
          placeholder="0.00"
        />
        <Campo
          etiqueta={t.tamano}
          valor={v.tamano}
          cambiar={(x) => b.cambiar('tamano', x)}
          placeholder="500"
        />
        <div className="campo">
          <label htmlFor="tienda-unidad">{t.unidad}</label>
          <select
            id="tienda-unidad"
            value={v.unidadTamano}
            onChange={(e) => b.cambiar('unidadTamano', e.target.value)}
          >
            {['each', 'g', 'kg', 'oz', 'lb', 'mL', 'L', 'fl oz', 'gal'].map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="boton">
          {t.agregar}
        </button>
      </form>
    </section>
  );
}
