import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { Icono } from '../sitio/Icono';
import { AvisoBorrador } from './AvisoBorrador';
import { AyudaAqui } from './AyudaAqui';
import { MenuTresPuntos } from './MenuTresPuntos';
import { mensajeDeFoto, reducirFoto } from './SubirFoto';
import { BotonCamara } from './camara';
import { useHora } from './horario';
import { api, pedir } from './api';
import './superBanners.css';

/**
 * C-BANNERS (17 nov 2026, Richard) — todos los países. El administrador de banners del inicio de la
 * app: «cabecera» (uno por apertura, por peso) y «promociones» (el carrusel). Se crea en borrador,
 * se ve la vista previa en el teléfono y NADA sale al público sin «Aprobar y publicar». La imagen se
 * sube (archivos o cámara) o se elige entre 2 o 3 opciones creadas con IA (modelo barato aprobado,
 * con tope diario en el servidor).
 */
type Lugar = 'cabecera' | 'promociones';
type Estado = 'borrador' | 'publicado' | 'pausado';
type TipoDestino = 'servicio' | 'restaurante' | 'tienda' | 'cupon';
export type BannerPanel = {
  id: string;
  lugar: Lugar;
  estado: Estado;
  imagen: string;
  tituloEs: string;
  tituloEn: string;
  textoEs: string;
  textoEn: string;
  destinoTipo: TipoDestino;
  destinoValor: string;
  codigo: string;
  zonas: string[];
  paises: string[];
  inicio: string | null;
  fin: string | null;
  peso: number;
  orden: number;
  idea: string;
  aprobadoEn: string | null;
};
type Opciones = {
  zonas: { id: string; nombre: string; pais: string; activa: boolean }[];
  servicios: string[];
  comercios: { id: string; nombre: string; tipo: 'restaurante' | 'tienda'; zona: string }[];
  cupones: { codigo: string; descripcionEs: string; descripcionEn: string }[];
};
type Respuesta = {
  banners: BannerPanel[];
  opciones: Opciones;
  ia: { disponible: boolean; hoy: number; tope: number };
};

const T = {
  es: {
    titulo: 'Banners de la app',
    ayuda:
      'Los banners del inicio de la app del cliente. La cabecera muestra uno distinto cada vez que se abre la app (sale más el de más peso); promociones es el carrusel de tarjetas rojas. Nada sale al público sin «Aprobar y publicar».',
    nuevo: 'Nuevo banner',
    cabecera: 'Cabecera',
    promociones: 'Promociones',
    vacioLugar: 'Todavía no hay banners en este lugar.',
    estado: { borrador: 'Borrador', publicado: 'Publicado', pausado: 'Pausado' },
    editar: 'Editar',
    aprobar: 'Aprobar y publicar',
    pausar: 'Pausar',
    borrar: 'Borrar banner',
    opciones: 'Más opciones del banner',
    confirmarBorrar: '¿Borrar este banner? No se puede deshacer.',
    siBorrar: 'Sí, borrar',
    cancelar: 'Cancelar',
    todas: 'Todas las ciudades',
    sinFin: 'sin fecha de fin',
    desde: 'Desde',
    hasta: 'hasta',
    siempre: 'Siempre',
    peso: 'Peso',
    orden: 'Orden',
    publicado: 'Publicado. La app lo muestra en menos de un minuto.',
    pausado: 'Pausado. Ya no sale en la app.',
    borrado: 'Banner borrado.',
    guardado: 'Guardado como borrador. Revisa la vista previa y toca «Aprobar y publicar».',
    vuelveBorrador:
      'Este banner está publicado: al guardar cambios vuelve a borrador hasta que lo apruebes otra vez.',
    // Formulario
    formNuevo: 'Nuevo banner',
    formEditar: 'Editar banner',
    lugar: 'Lugar',
    imagen: 'Imagen',
    subir: 'Subir desde archivos',
    cambiarImagen: 'Cambiar imagen',
    subiendo: 'Subiendo…',
    noEsFoto: 'Ese archivo no es una foto. Usa JPG, PNG o WebP.',
    sinImagen: 'Sin imagen todavía',
    ia: 'Generar con IA',
    iaAyuda:
      'Escribe la idea y se crean opciones con el modelo económico aprobado. Elige una; después ajustas los textos.',
    idea: 'Idea de la imagen',
    ideaEjemplo: 'Una moto roja en una calle soleada de la ciudad',
    cantidad: 'Opciones',
    generar: 'Generar opciones',
    generando: 'Creando opciones…',
    hoy: (h: number, t: number) => `Hoy van ${h} de ${t} imágenes.`,
    iaApagada:
      'La creación con IA no está conectada en este sitio. Sube la imagen desde archivos o tómala con la cámara.',
    elegir: 'Elegir esta',
    elegida: 'Elegida',
    opcion: (n: number) => `Opción ${n}`,
    tituloEs: 'Titular en español',
    tituloEn: 'Titular en inglés',
    textoEs: 'Texto en español',
    textoEn: 'Texto en inglés',
    destino: 'Al tocarlo lleva a',
    destinos: {
      servicio: 'Un servicio',
      restaurante: 'Un restaurante',
      tienda: 'Una tienda',
      cupon: 'Una promoción o cupón',
    },
    elegirDestino: 'Elige…',
    servicios: {
      comida: 'Comida',
      moto: 'Moto',
      carro: 'Carro',
      mercado: 'Mercado',
      envios: 'Envíos',
      farmacia: 'Farmacia',
      licores: 'Licores',
    } as Record<string, string>,
    codigo: 'Código que se muestra (opcional)',
    codigoAyuda: 'Sale en la tarjeta de promociones. Solo letras, números y guiones.',
    paises: 'Países',
    ciudades: 'Ciudades',
    alcanceAyuda: 'Sin marcar nada, sale en todas partes. Un país incluye todas sus ciudades.',
    inicio: 'Empieza',
    fin: 'Termina',
    fechasAyuda: 'Vacío = sin límite. Hora de tu computadora.',
    pesoAyuda: 'Del 1 al 100. En la cabecera, más peso = sale más veces.',
    ordenAyuda: 'En el carrusel, el número menor va primero.',
    guardar: 'Guardar borrador',
    guardarYAprobar: 'Guardar y aprobar',
    cerrar: 'Cerrar sin guardar',
    vista: 'Vista previa en el teléfono',
    idiomaVista: 'Idioma de la vista previa',
    tituloVacio: 'Tu titular aquí',
  },
  en: {
    titulo: 'App banners',
    ayuda:
      'The banners on the home screen of the customer app. The header shows a different one each time the app opens (higher weight shows more often); promotions is the carousel of red cards. Nothing goes live without “Approve and publish.”',
    nuevo: 'New banner',
    cabecera: 'Header',
    promociones: 'Promotions',
    vacioLugar: 'There are no banners in this placement yet.',
    estado: { borrador: 'Draft', publicado: 'Published', pausado: 'Paused' },
    editar: 'Edit',
    aprobar: 'Approve and publish',
    pausar: 'Pause',
    borrar: 'Delete banner',
    opciones: 'More banner options',
    confirmarBorrar: 'Delete this banner? This can’t be undone.',
    siBorrar: 'Yes, delete',
    cancelar: 'Cancel',
    todas: 'All cities',
    sinFin: 'no end date',
    desde: 'From',
    hasta: 'to',
    siempre: 'Always',
    peso: 'Weight',
    orden: 'Order',
    publicado: 'Published. The app shows it in less than a minute.',
    pausado: 'Paused. It no longer shows in the app.',
    borrado: 'Banner deleted.',
    guardado: 'Saved as a draft. Check the preview and tap “Approve and publish.”',
    vuelveBorrador:
      'This banner is published: saving changes turns it back into a draft until you approve it again.',
    formNuevo: 'New banner',
    formEditar: 'Edit banner',
    lugar: 'Placement',
    imagen: 'Image',
    subir: 'Upload from files',
    cambiarImagen: 'Change image',
    subiendo: 'Uploading…',
    noEsFoto: 'That file isn’t a photo. Use JPG, PNG, or WebP.',
    sinImagen: 'No image yet',
    ia: 'Generate with AI',
    iaAyuda:
      'Write the idea and options are created with the approved low-cost model. Pick one; then adjust the text.',
    idea: 'Image idea',
    ideaEjemplo: 'A red motorcycle on a sunny city street',
    cantidad: 'Options',
    generar: 'Generate options',
    generando: 'Creating options…',
    hoy: (h: number, t: number) => `${h} of ${t} images used today.`,
    iaApagada:
      'AI creation isn’t connected on this site. Upload the image from your files or take it with the camera.',
    elegir: 'Pick this one',
    elegida: 'Picked',
    opcion: (n: number) => `Option ${n}`,
    tituloEs: 'Headline in Spanish',
    tituloEn: 'Headline in English',
    textoEs: 'Text in Spanish',
    textoEn: 'Text in English',
    destino: 'Tapping it opens',
    destinos: {
      servicio: 'A service',
      restaurante: 'A restaurant',
      tienda: 'A store',
      cupon: 'A promotion or coupon',
    },
    elegirDestino: 'Choose…',
    servicios: {
      comida: 'Food',
      moto: 'Moto',
      carro: 'Car',
      mercado: 'Grocery',
      envios: 'Delivery',
      farmacia: 'Pharmacy',
      licores: 'Liquor',
    } as Record<string, string>,
    codigo: 'Code shown (optional)',
    codigoAyuda: 'Shows on the promotion card. Letters, numbers, and dashes only.',
    paises: 'Countries',
    ciudades: 'Cities',
    alcanceAyuda: 'With nothing checked, it shows everywhere. A country includes all its cities.',
    inicio: 'Starts',
    fin: 'Ends',
    fechasAyuda: 'Empty = no limit. Your computer’s time.',
    pesoAyuda: 'From 1 to 100. In the header, more weight = shows more often.',
    ordenAyuda: 'In the carousel, the lower number goes first.',
    guardar: 'Save draft',
    guardarYAprobar: 'Save and approve',
    cerrar: 'Close without saving',
    vista: 'Phone preview',
    idiomaVista: 'Preview language',
    tituloVacio: 'Your headline here',
  },
};

const VACIO = {
  editando: '',
  lugar: 'cabecera' as Lugar,
  imagen: '',
  tituloEs: '',
  tituloEn: '',
  textoEs: '',
  textoEn: '',
  destinoTipo: 'servicio' as TipoDestino,
  destinoValor: '',
  codigo: '',
  zonas: [] as string[],
  paises: [] as string[],
  inicio: '',
  fin: '',
  peso: '1',
  orden: '0',
  idea: '',
};
type Valores = typeof VACIO;

/** ISO → «AAAA-MM-DDTHH:mm» en la hora de la computadora (lo que pide la casilla). */
export function aCasilla(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
/** «AAAA-MM-DDTHH:mm» (hora local) → ISO en UTC, o null si está vacía. */
export function deCasilla(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const mensaje = (x: unknown) => (x instanceof ErrorApi ? x.message : String(x));

/** La vista previa: así se ve en el teléfono del cliente. */
export function VistaTelefono({
  lugar,
  titulo,
  texto,
  imagen,
  codigo,
  vacio,
}: {
  lugar: Lugar;
  titulo: string;
  texto: string;
  imagen: string;
  codigo: string;
  vacio: string;
}) {
  return (
    <div className="banners-telefono" aria-hidden="true">
      <div className="banners-telefono-barra" />
      {lugar === 'cabecera' ? (
        <div className="banners-cabecera" data-testid="vista-cabecera">
          <div className="banners-cabecera-texto">
            <strong>{titulo || vacio}</strong>
            {texto ? <span>{texto}</span> : null}
          </div>
          {imagen ? <img src={imagen} alt="" /> : <div className="banners-sin-imagen" />}
        </div>
      ) : (
        <div className="banners-promo" data-testid="vista-promo">
          <div className="banners-promo-texto">
            <strong>{titulo || vacio}</strong>
            {texto ? <span>{texto}</span> : null}
            {codigo ? <em>{codigo.toUpperCase()}</em> : null}
          </div>
          {imagen ? <img src={imagen} alt="" /> : <div className="banners-sin-imagen" />}
        </div>
      )}
      <div className="banners-telefono-relleno">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

export function SuperBanners({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  // C-HORARIO-EMPLEADO: las fechas con la zona y el reloj del empleado (pieza única).
  const hora = useHora(idioma);
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [abiertoAMano, setAbierto] = useState(false);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [cantidad, setCantidad] = useState(3);
  const [opcionesIa, setOpcionesIa] = useState<string[]>([]);
  const [elegida, setElegida] = useState('');
  const [idiomaVista, setIdiomaVista] = useState<Idioma>(idioma);
  const [enviando, setEnviando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  const b = useBorrador<Valores>({
    formulario: 'banners',
    cuenta: 'superadmin',
    inicial: VACIO,
    almacen: almacenNavegador,
  });
  const v = b.valores;

  const cargar = useCallback(() => {
    pedir<Respuesta>('GET', '/datos/admin/banners')
      .then(setDatos)
      .catch((x: unknown) => setError(mensaje(x)));
  }, []);
  useEffect(cargar, [cargar]);
  // Si había algo a medio escribir, el formulario se abre solo con lo recuperado.
  const abierto = abiertoAMano || b.recuperado;

  const zonasPorPais = useMemo(() => {
    const m = new Map<string, Opciones['zonas']>();
    for (const z of datos?.opciones.zonas ?? []) m.set(z.pais, [...(m.get(z.pais) ?? []), z]);
    return [...m.entries()];
  }, [datos]);
  const nombreZona = useMemo(
    () => new Map((datos?.opciones.zonas ?? []).map((z) => [z.id, z.nombre])),
    [datos],
  );
  const editandoPublicado = datos?.banners.find((x) => x.id === v.editando)?.estado === 'publicado';

  function nuevo() {
    b.cargar(VACIO);
    setOpcionesIa([]);
    setElegida('');
    setOk('');
    setError('');
    setAbierto(true);
  }

  function editar(x: BannerPanel) {
    b.cargar({
      editando: x.id,
      lugar: x.lugar,
      imagen: x.imagen,
      tituloEs: x.tituloEs,
      tituloEn: x.tituloEn,
      textoEs: x.textoEs,
      textoEn: x.textoEn,
      destinoTipo: x.destinoTipo,
      destinoValor: x.destinoValor,
      codigo: x.codigo,
      zonas: x.zonas,
      paises: x.paises,
      inicio: aCasilla(x.inicio),
      fin: aCasilla(x.fin),
      peso: String(x.peso),
      orden: String(x.orden),
      idea: x.idea,
    });
    setOpcionesIa([]);
    setElegida('');
    setOk('');
    setError('');
    setAbierto(true);
  }

  async function cerrar() {
    await b.limpiar();
    setAbierto(false);
    setOpcionesIa([]);
  }

  /** La foto llega de los archivos, de la cámara o de una opción con IA: misma reducción a WebP. */
  async function recibir(archivo: File) {
    setError('');
    if (!archivo.type.startsWith('image/')) return setError(t.noEsFoto);
    setSubiendo(true);
    try {
      const reducida = await reducirFoto(archivo);
      const { url } = await api.subirFoto(reducida, '/datos/admin/banners/imagen');
      b.cambiar('imagen', url);
    } catch (x) {
      setError(mensajeDeFoto(x, idioma));
    } finally {
      setSubiendo(false);
    }
  }

  async function generar() {
    setError('');
    setGenerando(true);
    try {
      const r = await pedir<{ opciones: string[]; hoy: number; tope: number }>(
        'POST',
        '/datos/admin/banners/generar',
        { idea: v.idea, lugar: v.lugar, cantidad },
      );
      setOpcionesIa(r.opciones);
      setElegida('');
      setDatos((d) => (d ? { ...d, ia: { ...d.ia, hoy: r.hoy, tope: r.tope } } : d));
    } catch (x) {
      setError(mensaje(x));
    } finally {
      setGenerando(false);
    }
  }

  async function elegirOpcion(url: string) {
    setError('');
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(String(r.status));
      const blob = await r.blob();
      await recibir(new File([blob], 'opcion.png', { type: blob.type || 'image/png' }));
      setElegida(url);
    } catch (x) {
      setError(mensajeDeFoto(x, idioma));
    }
  }

  const cuerpo = () => ({
    lugar: v.lugar,
    imagen: v.imagen,
    tituloEs: v.tituloEs,
    tituloEn: v.tituloEn,
    textoEs: v.textoEs,
    textoEn: v.textoEn,
    destinoTipo: v.destinoTipo,
    destinoValor: v.destinoValor,
    codigo: v.codigo,
    zonas: v.zonas,
    paises: v.paises,
    inicio: deCasilla(v.inicio),
    fin: deCasilla(v.fin),
    peso: Math.min(100, Math.max(1, Math.round(Number(v.peso) || 1))),
    orden: Math.min(1000, Math.max(0, Math.round(Number(v.orden) || 0))),
    idea: v.idea,
  });

  async function guardar(aprobar: boolean) {
    setError('');
    setOk('');
    setEnviando(true);
    try {
      const r = v.editando
        ? await pedir<{ banner: BannerPanel }>(
            'PUT',
            `/datos/admin/banners/${v.editando}`,
            cuerpo(),
          )
        : await pedir<{ banner: BannerPanel }>('POST', '/datos/admin/banners', cuerpo());
      // Ya quedó guardado: si la aprobación falla, se edita ese mismo banner (no se crea otro).
      b.cambiar('editando', r.banner.id);
      if (aprobar) await pedir('POST', `/datos/admin/banners/${r.banner.id}/publicar`, {});
      await b.limpiar();
      setAbierto(false);
      setOpcionesIa([]);
      setOk(aprobar ? t.publicado : t.guardado);
      cargar();
    } catch (x) {
      // Lo escrito se queda en pantalla para corregirlo.
      setError(mensaje(x));
      cargar();
    } finally {
      setEnviando(false);
    }
  }

  async function accion(id: string, que: 'publicar' | 'pausar') {
    setError('');
    setOk('');
    try {
      await pedir('POST', `/datos/admin/banners/${id}/${que}`, {});
      setOk(que === 'publicar' ? t.publicado : t.pausado);
      cargar();
    } catch (x) {
      setError(mensaje(x));
    }
  }

  async function borrar(id: string) {
    setError('');
    try {
      await pedir('DELETE', `/datos/admin/banners/${id}`);
      setBorrando(null);
      setOk(t.borrado);
      cargar();
    } catch (x) {
      setError(mensaje(x));
    }
  }

  const alterna = (campo: 'zonas' | 'paises', valor: string) => {
    const actual = campo === 'zonas' ? v.zonas : v.paises;
    b.cambiar(
      campo,
      actual.includes(valor) ? actual.filter((x) => x !== valor) : [...actual, valor],
    );
  };

  const vigencia = (x: BannerPanel) => {
    if (!x.inicio && !x.fin) return t.siempre;
    return `${x.inicio ? `${t.desde} ${hora.fecha(x.inicio)} ` : ''}${x.fin ? `${t.hasta} ${hora.fecha(x.fin)}` : t.sinFin}`;
  };
  const alcance = (x: BannerPanel) =>
    !x.zonas.length && !x.paises.length
      ? t.todas
      : [...x.paises, ...x.zonas.map((z) => nombreZona.get(z) ?? z)].join(' · ');

  const nombreDestino = (d: TipoDestino) =>
    d === 'servicio'
      ? t.destinos.servicio
      : d === 'restaurante'
        ? t.destinos.restaurante
        : d === 'tienda'
          ? t.destinos.tienda
          : t.destinos.cupon;
  const comercios = (datos?.opciones.comercios ?? []).filter(
    (c) => c.tipo === (v.destinoTipo === 'tienda' ? 'tienda' : 'restaurante'),
  );
  const vistaTitulo = idiomaVista === 'en' ? v.tituloEn || v.tituloEs : v.tituloEs || v.tituloEn;
  const vistaTexto = idiomaVista === 'en' ? v.textoEn || v.textoEs : v.textoEs || v.textoEn;

  return (
    <div data-testid="super-banners" className="super-banners">
      <div className="banners-encabezado">
        <div>
          <h2>
            {t.titulo}
            {/* C-AYUDA-AQUI: el «?» abre la guía interna de los banners (nunca Docs públicos). */}
            <AyudaAqui guia="app-banners" idioma={idioma} />
          </h2>
          <p className="pista">{t.ayuda}</p>
        </div>
        {!abierto && (
          <button type="button" className="boton" onClick={nuevo}>
            {t.nuevo}
          </button>
        )}
      </div>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="texto-exito" role="status">
          {ok}
        </p>
      ) : null}

      {abierto && datos && (
        <section className="banners-editor" aria-label={v.editando ? t.formEditar : t.formNuevo}>
          <AvisoBorrador
            visible={b.recuperado}
            idioma={idioma}
            empezar={() => void b.empezarDeNuevo()}
          />
          <h3>{v.editando ? t.formEditar : t.formNuevo}</h3>
          {editandoPublicado ? <p className="pista">{t.vuelveBorrador}</p> : null}
          <div className="banners-editor-cuerpo">
            <form
              className="formulario banners-form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void guardar(false);
              }}
            >
              <fieldset className="banners-grupo">
                <legend>{t.lugar}</legend>
                <div className="banners-radios">
                  {(['cabecera', 'promociones'] as const).map((l) => (
                    <label key={l} className="banners-radio">
                      <input
                        type="radio"
                        name="lugar"
                        checked={v.lugar === l}
                        onChange={() => b.cambiar('lugar', l)}
                      />
                      {l === 'cabecera' ? t.cabecera : t.promociones}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="banners-grupo">
                <legend>{t.imagen}</legend>
                <div className="banners-imagen">
                  {v.imagen ? (
                    <img src={v.imagen} alt={t.imagen} />
                  ) : (
                    <div className="banners-imagen-vacia">
                      <Icono nombre="foto" tamano={28} />
                      <span>{t.sinImagen}</span>
                    </div>
                  )}
                </div>
                <div className="fila-botones">
                  <button
                    type="button"
                    className="boton secundario"
                    disabled={subiendo}
                    onClick={() => entrada.current?.click()}
                  >
                    <Icono nombre="subir" tamano={18} />
                    {subiendo ? t.subiendo : v.imagen ? t.cambiarImagen : t.subir}
                  </button>
                  {/* C-CAMARA-EN-TODA-SUBIDA: toda casilla de imagen ofrece «Tomar foto». */}
                  <BotonCamara
                    idioma={idioma}
                    alTomar={(archivo) => void recibir(archivo)}
                    alFallar={setError}
                    deshabilitado={subiendo}
                  />
                </div>
                <input
                  ref={entrada}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="oculto"
                  aria-label={t.subir}
                  onChange={(e) => {
                    const a = e.target.files?.[0];
                    e.target.value = '';
                    if (a) void recibir(a);
                  }}
                />

                <div className="banners-ia">
                  <strong>{t.ia}</strong>
                  {datos.ia.disponible ? (
                    <>
                      <small>{t.iaAyuda}</small>
                      <label className="campo">
                        {t.idea}
                        <textarea
                          rows={2}
                          maxLength={500}
                          placeholder={t.ideaEjemplo}
                          value={v.idea}
                          onChange={(e) => b.cambiar('idea', e.target.value)}
                        />
                      </label>
                      <div className="banners-ia-fila">
                        <label className="campo-compacto">
                          {t.cantidad}
                          <select
                            value={cantidad}
                            onChange={(e) => setCantidad(Number(e.target.value))}
                          >
                            <option value={2}>2</option>
                            <option value={3}>3</option>
                          </select>
                        </label>
                        <button
                          type="button"
                          className="boton secundario"
                          disabled={generando || v.idea.trim().length < 8}
                          onClick={() => void generar()}
                        >
                          {generando ? t.generando : t.generar}
                        </button>
                        <small>{t.hoy(datos.ia.hoy, datos.ia.tope)}</small>
                      </div>
                      {opcionesIa.length > 0 && (
                        <ul className="banners-ia-opciones">
                          {opcionesIa.map((u, i) => (
                            <li key={u} className={elegida === u ? 'elegida' : undefined}>
                              <img src={u} alt={t.opcion(i + 1)} />
                              <button
                                type="button"
                                className="boton secundario"
                                disabled={subiendo}
                                onClick={() => void elegirOpcion(u)}
                              >
                                {elegida === u ? t.elegida : t.elegir}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <small>{t.iaApagada}</small>
                  )}
                </div>
              </fieldset>

              <div className="banners-dos">
                <label className="campo">
                  {t.tituloEs}
                  <input
                    maxLength={80}
                    value={v.tituloEs}
                    onChange={(e) => b.cambiar('tituloEs', e.target.value)}
                  />
                </label>
                <label className="campo">
                  {t.tituloEn}
                  <input
                    maxLength={80}
                    value={v.tituloEn}
                    onChange={(e) => b.cambiar('tituloEn', e.target.value)}
                  />
                </label>
                <label className="campo">
                  {t.textoEs}
                  <input
                    maxLength={140}
                    value={v.textoEs}
                    onChange={(e) => b.cambiar('textoEs', e.target.value)}
                  />
                </label>
                <label className="campo">
                  {t.textoEn}
                  <input
                    maxLength={140}
                    value={v.textoEn}
                    onChange={(e) => b.cambiar('textoEn', e.target.value)}
                  />
                </label>
              </div>

              <div className="banners-dos">
                <label className="campo">
                  {t.destino}
                  <select
                    value={v.destinoTipo}
                    onChange={(e) => {
                      b.cambiar('destinoTipo', e.target.value as TipoDestino);
                      b.cambiar('destinoValor', '');
                    }}
                  >
                    {(['servicio', 'restaurante', 'tienda', 'cupon'] as const).map((d) => (
                      <option key={d} value={d}>
                        {nombreDestino(d)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="campo">
                  {nombreDestino(v.destinoTipo)}
                  <select
                    value={v.destinoValor}
                    onChange={(e) => b.cambiar('destinoValor', e.target.value)}
                  >
                    <option value="">{t.elegirDestino}</option>
                    {v.destinoTipo === 'servicio' &&
                      datos.opciones.servicios.map((s) => (
                        <option key={s} value={s}>
                          {new Map(Object.entries(t.servicios)).get(s) ?? s}
                        </option>
                      ))}
                    {(v.destinoTipo === 'restaurante' || v.destinoTipo === 'tienda') &&
                      comercios.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre} · {nombreZona.get(c.zona) ?? c.zona}
                        </option>
                      ))}
                    {v.destinoTipo === 'cupon' &&
                      datos.opciones.cupones.map((c) => (
                        <option key={c.codigo} value={c.codigo}>
                          {c.codigo}
                          {(idioma === 'en' ? c.descripcionEn : c.descripcionEs)
                            ? ` · ${idioma === 'en' ? c.descripcionEn : c.descripcionEs}`
                            : ''}
                        </option>
                      ))}
                  </select>
                </label>
              </div>

              {v.lugar === 'promociones' && (
                <label className="campo">
                  {t.codigo}
                  <input
                    maxLength={30}
                    value={v.codigo}
                    onChange={(e) =>
                      b.cambiar('codigo', e.target.value.replace(/[^A-Za-z0-9_-]/g, ''))
                    }
                  />
                  <small>{t.codigoAyuda}</small>
                </label>
              )}

              <fieldset className="banners-grupo">
                <legend>
                  {t.paises} · {t.ciudades}
                </legend>
                <small>{t.alcanceAyuda}</small>
                {zonasPorPais.map(([pais, zonas]) => (
                  <div key={pais} className="banners-pais">
                    <label className="banners-check banners-check-pais">
                      <input
                        type="checkbox"
                        checked={v.paises.includes(pais)}
                        onChange={() => alterna('paises', pais)}
                      />
                      {pais}
                    </label>
                    <div className="banners-ciudades">
                      {zonas.map((z) => (
                        <label key={z.id} className="banners-check">
                          <input
                            type="checkbox"
                            checked={v.zonas.includes(z.id)}
                            disabled={v.paises.includes(pais)}
                            onChange={() => alterna('zonas', z.id)}
                          />
                          {z.nombre}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </fieldset>

              <div className="banners-dos">
                <label className="campo">
                  {t.inicio}
                  <input
                    type="datetime-local"
                    value={v.inicio}
                    onChange={(e) => b.cambiar('inicio', e.target.value)}
                  />
                </label>
                <label className="campo">
                  {t.fin}
                  <input
                    type="datetime-local"
                    value={v.fin}
                    onChange={(e) => b.cambiar('fin', e.target.value)}
                  />
                </label>
              </div>
              <small>{t.fechasAyuda}</small>

              <div className="banners-dos">
                <label className="campo">
                  {t.peso}
                  <input
                    type="number"
                    min={1}
                    max={100}
                    inputMode="numeric"
                    value={v.peso}
                    onChange={(e) => b.cambiar('peso', e.target.value)}
                  />
                  <small>{t.pesoAyuda}</small>
                </label>
                <label className="campo">
                  {t.orden}
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    inputMode="numeric"
                    value={v.orden}
                    onChange={(e) => b.cambiar('orden', e.target.value)}
                  />
                  <small>{t.ordenAyuda}</small>
                </label>
              </div>

              <div className="fila-botones">
                <button type="submit" className="boton secundario" disabled={enviando}>
                  {t.guardar}
                </button>
                <button
                  type="button"
                  className="boton"
                  disabled={enviando}
                  onClick={() => void guardar(true)}
                >
                  {t.guardarYAprobar}
                </button>
                <button type="button" className="boton-texto" onClick={() => void cerrar()}>
                  {t.cerrar}
                </button>
              </div>
            </form>

            <aside className="banners-vista">
              <div className="banners-vista-cabeza">
                <strong>{t.vista}</strong>
                <div role="group" aria-label={t.idiomaVista} className="banners-idiomas">
                  {(['es', 'en'] as const).map((i) => (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={idiomaVista === i}
                      onClick={() => setIdiomaVista(i)}
                    >
                      {i.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <VistaTelefono
                lugar={v.lugar}
                titulo={vistaTitulo}
                texto={vistaTexto}
                imagen={v.imagen}
                codigo={v.codigo}
                vacio={t.tituloVacio}
              />
            </aside>
          </div>
        </section>
      )}

      {datos &&
        (['cabecera', 'promociones'] as const).map((l) => {
          const lista = datos.banners.filter((x) => x.lugar === l);
          return (
            <section
              key={l}
              className="banners-lugar"
              aria-label={l === 'cabecera' ? t.cabecera : t.promociones}
            >
              <h3>
                {l === 'cabecera' ? t.cabecera : t.promociones}{' '}
                <span className="banners-cuenta">{lista.length}</span>
              </h3>
              {lista.length === 0 ? (
                <p className="pista">{t.vacioLugar}</p>
              ) : (
                <ul className="banners-lista">
                  {lista.map((x) => (
                    <li key={x.id} className="banners-fila">
                      {x.imagen ? (
                        <img className="banners-mini" src={x.imagen} alt="" />
                      ) : (
                        <div className="banners-mini banners-sin-imagen" />
                      )}
                      <div className="banners-fila-datos">
                        <strong>{(idioma === 'en' ? x.tituloEn : x.tituloEs) || x.tituloEs}</strong>
                        <span
                          className={`insignia${x.estado === 'publicado' ? ' insignia-aprobado' : ''}`}
                        >
                          {t.estado[x.estado]}
                        </span>
                        <small>
                          {alcance(x)} · {vigencia(x)} · {t.peso} {x.peso} · {t.orden} {x.orden}
                        </small>
                        {borrando === x.id && (
                          <div
                            className="banners-confirmar"
                            role="alertdialog"
                            aria-label={t.borrar}
                          >
                            <span>{t.confirmarBorrar}</span>
                            <button
                              type="button"
                              className="boton peligro"
                              onClick={() => void borrar(x.id)}
                            >
                              {t.siBorrar}
                            </button>
                            <button
                              type="button"
                              className="boton secundario"
                              onClick={() => setBorrando(null)}
                            >
                              {t.cancelar}
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="banners-fila-acciones">
                        <button
                          type="button"
                          className="boton secundario"
                          onClick={() => editar(x)}
                        >
                          {t.editar}
                        </button>
                        {x.estado === 'publicado' ? (
                          <button
                            type="button"
                            className="boton secundario"
                            onClick={() => void accion(x.id, 'pausar')}
                          >
                            {t.pausar}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="boton"
                            onClick={() => void accion(x.id, 'publicar')}
                          >
                            {t.aprobar}
                          </button>
                        )}
                        <MenuTresPuntos
                          etiqueta={t.opciones}
                          opciones={[
                            { texto: t.borrar, peligro: true, alTocar: () => setBorrando(x.id) },
                          ]}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
    </div>
  );
}
