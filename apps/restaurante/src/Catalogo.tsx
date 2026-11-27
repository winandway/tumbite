import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, Switch, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { File, Paths } from 'expo-file-system';
import {
  ErrorApi,
  codigoBarrasValido,
  enIdioma,
  formatearMonto,
  montoATexto,
  palabrasComercio,
  useBorrador,
} from '@tumbite/compartido';
import { ExcelIlegible, type MotivoExcel, xlsxACsv } from '@tumbite/compartido/src/excel';
import {
  AvisoBorrador,
  C,
  Campo,
  Modal,
  Text,
  alSalirTelefono,
  almacenTelefono,
  e,
  fotoConCamara,
  subirFotoLivianaApp,
  urlFoto,
  useSesion,
} from '@tumbite/movil';
import { BotonGrande, Insignia, Pildora, Tarjeta } from './piezas/ui';
import {
  FORM_VACIO,
  type FormProducto,
  type ListaCat,
  type ProductoCat,
  type RespuestaImportacion,
  cuerpoProducto,
  digitosCodigo,
  estadoExistencias,
  formDeProducto,
  fotoDeProducto,
  idiomaDelPais,
  nombreDeProducto,
  plantillaCsv,
  puedeBuscarCodigo,
  resumenImportacion,
  rutaLista,
  skuNuevo,
  tipoDeArchivo,
} from './catalogoLogica';

/**
 * Catálogo de Divoox Merchant (C-MERCHANT-CATALOGO, 27 nov 2026). Todos los países.
 *
 * La pantalla de los comercios que NO son restaurante (mercado, farmacia, licorería, ferretería,
 * tienda, otro): lista con buscador, agotar «solo por hoy» o hasta reactivar (como DoorDash),
 * producto con código de barras, foto, inventario y carga masiva con Excel o CSV (vista previa con
 * errores por fila; las filas malas no se guardan y las buenas sí). Las mismas rutas del panel.
 */
const T = {
  es: {
    buscar: 'Buscar por nombre, marca, SKU o código',
    anadir: 'Agregar',
    subir: 'Subir Excel o CSV',
    sinResultados: 'No encontramos nada con esa búsqueda.',
    vacio: 'Todavía no tienes productos. Agrega uno o sube tu Excel.',
    totales: (n: number, d: number) => `${n} en total · ${d} disponibles`,
    todas: 'Todas',
    existencias: (n: number) => `${n} en inventario`,
    pocas: (n: number) => `Quedan ${n}`,
    disponible: 'Disponible',
    agotado: 'Agotado',
    anteriores: 'Anteriores',
    siguientes: 'Siguientes',
    editar: 'Editar',
    cargando: 'Cargando…',
    pregunta: '¿Solo por hoy o hasta que lo reactives?',
    soloHoy: 'Solo por hoy',
    hastaReactivar: 'Hasta que lo reactive',
    cancelar: 'Cancelar',
    volver: 'Volver',
    guardar: 'Guardar',
    guardando: 'Guardando…',
    nombre: 'Nombre del producto',
    precio: 'Precio',
    precioMoneda: 'Precio ({m})',
    categoria: 'Categoría',
    codigo: 'Código de barras (opcional)',
    escanear: 'Escanear',
    buscandoCodigo: 'Buscando la ficha…',
    rellenado: 'Rellenamos lo que faltaba con la ficha del código. Revisa y guarda.',
    noEncontrado: 'No encontramos ese código. Escribe los datos a mano.',
    existenciasCampo: 'Cantidad en inventario (opcional)',
    marca: 'Marca (opcional)',
    foto: 'Foto del producto',
    anadirFoto: 'Añadir foto',
    cambiarFoto: 'Cambiar foto',
    subiendo: 'Subiendo…',
    escaneaTitulo: 'Apunta al código de barras',
    permisoCamara: 'Activa la cámara para escanear el código de barras.',
    darPermiso: 'Permitir la cámara',
    cerrar: 'Cerrar',
    err: {
      nombre: 'Escribe el nombre del producto.',
      precio: 'Escribe un precio válido, por ejemplo {ej}.',
      categoria: 'Escribe la categoría.',
      codigo: 'Ese código de barras no es válido. Revisa el último dígito.',
      existencias: 'Escribe un número entero, o déjalo vacío.',
      tamano: 'El tamaño debe ser un número mayor que cero.',
      repetido: 'Ya tienes un producto con ese código. Búscalo en la lista y edítalo.',
    },
    guardado: 'Producto guardado.',
    // Carga masiva
    importarTitulo: 'Carga masiva',
    importarAyuda:
      'Descarga la plantilla, llénala con una fila por producto y súbela. El SKU es tu código interno: si el producto ya existe, se actualiza.',
    plantilla: 'Descargar la plantilla',
    plantillaTitulo: 'Plantilla de productos',
    plantillaMal: 'No pudimos preparar la plantilla. Intenta de nuevo.',
    elegirArchivo: 'Elegir archivo (.xlsx o .csv)',
    otroArchivo: 'Elegir otro archivo',
    leyendo: 'Revisando tu archivo…',
    archivoMalo: 'Ese archivo no es un Excel (.xlsx) ni un CSV.',
    excel: {
      invalido: 'Ese archivo no es un Excel (.xlsx) válido.',
      grande: 'El archivo pesa demasiado (máximo 5 MB).',
      filas: 'El Excel tiene demasiadas filas. Divídelo en partes.',
      celdas: 'El Excel tiene demasiadas celdas. Divídelo en partes.',
      vacio: 'La primera hoja del Excel está vacía.',
    } as Record<MotivoExcel, string>,
    previa: 'Esto pasará con tu archivo',
    nuevos: (n: number) => `${n} productos nuevos`,
    actualizados: (n: number) => `${n} productos se actualizan`,
    conError: (n: number) => `${n} filas con error: esas NO se guardan`,
    sinErrores: 'Ninguna fila con error.',
    fila: 'Fila',
    masErrores: (n: number) => `…y ${n} filas con error más. Corrígelas en tu archivo.`,
    guardarN: (n: number) => `Guardar ${n} productos`,
    nadaQueGuardar: 'No hay filas válidas para guardar. Corrige tu archivo y vuelve a subirlo.',
    listoImportar: (n: number, a: number, x: number) =>
      x > 0
        ? `Listo: ${n} nuevos y ${a} actualizados. ${x} filas con error no se guardaron.`
        : `Listo: ${n} nuevos y ${a} actualizados.`,
    verCatalogo: 'Ver el catálogo',
  },
  en: {
    buscar: 'Search by name, brand, SKU or barcode',
    anadir: 'Add',
    subir: 'Upload Excel or CSV',
    sinResultados: 'We couldn’t find anything for that search.',
    vacio: 'You don’t have products yet. Add one or upload your spreadsheet.',
    totales: (n: number, d: number) => `${n} in total · ${d} available`,
    todas: 'All',
    existencias: (n: number) => `${n} in stock`,
    pocas: (n: number) => `${n} left`,
    disponible: 'Available',
    agotado: 'Out of stock',
    anteriores: 'Previous',
    siguientes: 'Next',
    editar: 'Edit',
    cargando: 'Loading…',
    pregunta: 'Just for today, or until you turn it back on?',
    soloHoy: 'Just for today',
    hastaReactivar: 'Until I turn it back on',
    cancelar: 'Cancel',
    volver: 'Back',
    guardar: 'Save',
    guardando: 'Saving…',
    nombre: 'Product name',
    precio: 'Price',
    precioMoneda: 'Price ({m})',
    categoria: 'Category',
    codigo: 'Barcode (optional)',
    escanear: 'Scan',
    buscandoCodigo: 'Looking up the product…',
    rellenado: 'We filled in what was missing from the barcode. Review and save.',
    noEncontrado: 'We couldn’t find that barcode. Type the details in by hand.',
    existenciasCampo: 'Quantity in stock (optional)',
    marca: 'Brand (optional)',
    foto: 'Product photo',
    anadirFoto: 'Add photo',
    cambiarFoto: 'Change photo',
    subiendo: 'Uploading…',
    escaneaTitulo: 'Point at the barcode',
    permisoCamara: 'Turn on the camera to scan the barcode.',
    darPermiso: 'Allow the camera',
    cerrar: 'Close',
    err: {
      nombre: 'Enter the product name.',
      precio: 'Enter a valid price, for example {ej}.',
      categoria: 'Enter the category.',
      codigo: 'That barcode isn’t valid. Check the last digit.',
      existencias: 'Enter a whole number, or leave it empty.',
      tamano: 'The size must be a number greater than zero.',
      repetido: 'You already have a product with that barcode. Find it in the list and edit it.',
    },
    guardado: 'Product saved.',
    importarTitulo: 'Bulk upload',
    importarAyuda:
      'Download the template, fill it in with one row per product, and upload it. The SKU is your internal code: if the product already exists, it’s updated.',
    plantilla: 'Download the template',
    plantillaTitulo: 'Products template',
    plantillaMal: 'We couldn’t prepare the template. Try again.',
    elegirArchivo: 'Choose a file (.xlsx or .csv)',
    otroArchivo: 'Choose another file',
    leyendo: 'Checking your file…',
    archivoMalo: 'That file isn’t an Excel (.xlsx) or a CSV.',
    excel: {
      invalido: 'That isn’t a valid Excel (.xlsx) file.',
      grande: 'The file is too large (5 MB maximum).',
      filas: 'The Excel has too many rows. Split it into parts.',
      celdas: 'The Excel has too many cells. Split it into parts.',
      vacio: 'The first sheet of the Excel is empty.',
    } as Record<MotivoExcel, string>,
    previa: 'This is what will happen with your file',
    nuevos: (n: number) => `${n} new products`,
    actualizados: (n: number) => `${n} products will be updated`,
    conError: (n: number) => `${n} rows with errors: those will NOT be saved`,
    sinErrores: 'No rows with errors.',
    fila: 'Row',
    masErrores: (n: number) => `…and ${n} more rows with errors. Fix them in your file.`,
    guardarN: (n: number) => `Save ${n} products`,
    nadaQueGuardar: 'There are no valid rows to save. Fix your file and upload it again.',
    listoImportar: (n: number, a: number, x: number) =>
      x > 0
        ? `Done: ${n} new and ${a} updated. ${x} rows with errors weren’t saved.`
        : `Done: ${n} new and ${a} updated.`,
    verCatalogo: 'View the catalog',
  },
};

/** C-CAMARA-EN-TODA-SUBIDA: la cámara del teléfono, para la pieza común «Tomar foto». */
const CAMARA = {
  pedirPermiso: () => ImagePicker.requestCameraPermissionsAsync(),
  tomar: () =>
    ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: true,
      aspect: [1, 1],
    }),
};

const mensajeDe = (x: unknown) => (x instanceof ErrorApi ? x.message : String(x));

type Vista =
  { tipo: 'lista' } | { tipo: 'producto'; producto: ProductoCat | null } | { tipo: 'excel' };

export function Catalogo({ moneda }: { moneda: string }) {
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' });
  // Se sube la cuenta de la lista para que la pantalla de producto la pida al volver.
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  if (vista.tipo === 'producto')
    return (
      <FormProducto
        key={vista.producto?.id ?? 'nuevo'}
        producto={vista.producto}
        moneda={moneda}
        cerrar={() => setVista({ tipo: 'lista' })}
        recargar={recargar}
      />
    );
  if (vista.tipo === 'excel')
    return <CargaMasiva cerrar={() => setVista({ tipo: 'lista' })} recargar={recargar} />;
  return (
    <ListaProductos
      moneda={moneda}
      version={version}
      editar={(p) => setVista({ tipo: 'producto', producto: p })}
      importar={() => setVista({ tipo: 'excel' })}
    />
  );
}

// ───────────────────────── Lista ─────────────────────────

function ListaProductos({
  moneda,
  version,
  editar,
  importar,
}: {
  moneda: string;
  version: number;
  editar: (p: ProductoCat | null) => void;
  importar: () => void;
}) {
  const { api, idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const [q, setQ] = useState('');
  const [categoria, setCategoria] = useState('');
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<ListaCat | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [local, setLocal] = useState(0);
  const [preguntando, setPreguntando] = useState<ProductoCat | null>(null);
  const palabras = palabrasComercio(datos?.tipo ?? 'tienda', idioma);
  const idiomaNombres = idioma;

  useEffect(() => {
    let vivo = true;
    const reloj = setTimeout(() => {
      setCargando(true);
      api
        .pedir<ListaCat>('GET', rutaLista(q, pagina, categoria))
        .then((r) => {
          if (!vivo) return;
          setDatos(r);
          setError('');
        })
        .catch((x: unknown) => vivo && setError(mensajeDe(x)))
        .finally(() => vivo && setCargando(false));
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(reloj);
    };
  }, [api, q, pagina, categoria, version, local]);

  async function cambiarDisponible(
    p: ProductoCat,
    disponible: boolean,
    hasta: 'hoy' | 'reactivar',
  ) {
    setError('');
    setPreguntando(null);
    try {
      await api.pedir('PATCH', `/datos/mi-restaurante/productos/${p.id}/disponible`, {
        disponible,
        hasta,
      });
      setLocal((n) => n + 1);
    } catch (x) {
      setError(mensajeDe(x));
    }
  }

  const productos = datos?.productos ?? [];
  const categorias = datos?.categorias ?? [];
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 22, fontWeight: '800', color: C.secundario }}
        >
          {palabras.miMenu}
        </Text>
        <Pressable
          onPress={() => editar(null)}
          accessibilityRole="button"
          accessibilityLabel={palabras.agregarArticulo}
          style={{
            backgroundColor: C.primario,
            borderRadius: 999,
            paddingHorizontal: 16,
            paddingVertical: 9,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>+ {t.anadir}</Text>
        </Pressable>
      </View>
      {datos ? (
        <Text style={{ color: '#666B73', marginTop: 4 }}>
          {t.totales(datos.totales.productos, datos.totales.disponibles)}
        </Text>
      ) : null}
      <BotonGrande texto={t.subir} alTocar={importar} tipo="borde" />
      <View style={{ height: 8 }} />
      <Campo
        etiqueta={t.buscar}
        value={q}
        onChangeText={(x) => {
          setQ(x);
          setPagina(1);
        }}
        placeholder={t.buscar}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {categorias.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <Pildora
            texto={t.todas}
            activa={categoria === ''}
            alTocar={() => {
              setCategoria('');
              setPagina(1);
            }}
          />
          {categorias.map((c) => (
            <Pildora
              key={c.nombre}
              texto={`${c.nombre} (${c.n})`}
              activa={categoria === c.nombre}
              alTocar={() => {
                setCategoria(c.nombre);
                setPagina(1);
              }}
            />
          ))}
        </View>
      ) : null}
      {error ? <Text style={e.error}>{error}</Text> : null}
      {cargando && !datos ? <Text style={e.tarjeta}>{t.cargando}</Text> : null}
      {datos && !productos.length ? (
        <Text style={e.tarjeta}>{q || categoria ? t.sinResultados : t.vacio}</Text>
      ) : null}
      {productos.map((p) => {
        const foto = fotoDeProducto(p.imagen, (r) => urlFoto(r, 'miniatura'));
        const estado = estadoExistencias(p);
        const agotado = estado === 'agotado';
        return (
          <Tarjeta
            key={p.id}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 }}
          >
            <Pressable
              onPress={() => editar(p)}
              accessibilityRole="button"
              accessibilityLabel={`${t.editar}: ${nombreDeProducto(p, idiomaNombres)}`}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              {foto ? (
                <Image
                  source={{ uri: foto }}
                  style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: '#EEEFF1' }}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View
                  style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: '#F6F6F6' }}
                />
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  numberOfLines={2}
                  style={{ fontWeight: '800', fontSize: 16, color: C.secundario }}
                >
                  {nombreDeProducto(p, idiomaNombres)}
                </Text>
                <Text numberOfLines={1} style={{ color: '#666B73', fontSize: 13 }}>
                  {[p.marca, p.sku].filter(Boolean).join(' · ')}
                </Text>
                <Text style={{ fontWeight: '700', color: C.secundario }}>
                  {p.precio != null ? formatearMonto(p.precio, moneda, idioma) : '—'}
                </Text>
                {agotado ? (
                  <Insignia estado="agotado" texto={t.agotado} />
                ) : estado === 'pocas' && p.existencias !== null ? (
                  <Text style={{ color: '#B3261E', fontWeight: '700', fontSize: 12 }}>
                    {t.pocas(p.existencias)}
                  </Text>
                ) : p.existencias !== null ? (
                  <Text style={{ color: '#666B73', fontSize: 12 }}>
                    {t.existencias(p.existencias)}
                  </Text>
                ) : null}
              </View>
            </Pressable>
            <View style={{ alignItems: 'center', gap: 2 }}>
              <Switch
                value={p.disponible}
                onValueChange={(x) =>
                  x ? void cambiarDisponible(p, true, 'reactivar') : setPreguntando(p)
                }
                trackColor={{ true: C.exito }}
                accessibilityLabel={`${p.disponible ? t.disponible : t.agotado}: ${nombreDeProducto(p, idiomaNombres)}`}
              />
              <Text style={{ fontSize: 11, color: '#666B73' }}>
                {p.disponible ? t.disponible : t.agotado}
              </Text>
            </View>
          </Tarjeta>
        );
      })}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {pagina > 1 ? (
          <BotonGrande
            texto={t.anteriores}
            tipo="claro"
            flex={1}
            alTocar={() => setPagina(pagina - 1)}
          />
        ) : null}
        {datos?.hayMas ? (
          <BotonGrande
            texto={t.siguientes}
            tipo="claro"
            flex={1}
            alTocar={() => setPagina(pagina + 1)}
          />
        ) : null}
      </View>

      <Modal
        transparent
        visible={preguntando !== null}
        animationType="fade"
        onRequestClose={() => setPreguntando(null)}
        testID="hoja-agotar"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.cancelar}
          onPress={() => setPreguntando(null)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            accessible={false}
            style={{
              backgroundColor: '#fff',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
              paddingBottom: 32,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '800', color: C.secundario }}>
              {preguntando ? nombreDeProducto(preguntando, idiomaNombres) : ''}
            </Text>
            <Text style={{ color: '#666B73', marginTop: 4 }}>{t.pregunta}</Text>
            <BotonGrande
              texto={t.soloHoy}
              alTocar={() => preguntando && void cambiarDisponible(preguntando, false, 'hoy')}
            />
            <BotonGrande
              texto={t.hastaReactivar}
              tipo="borde"
              alTocar={() => preguntando && void cambiarDisponible(preguntando, false, 'reactivar')}
            />
            <BotonGrande texto={t.cancelar} tipo="claro" alTocar={() => setPreguntando(null)} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ───────────────────────── Escáner ─────────────────────────

function Escaner({ alLeer, cerrar }: { alLeer: (codigo: string) => void; cerrar: () => void }) {
  const { idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const [permiso, pedirPermiso] = useCameraPermissions();
  const leido = useRef(false);
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={cerrar}
      testID="escaner-codigo"
    >
      <View style={{ flex: 1, backgroundColor: '#101010', paddingTop: 48 }}>
        <Text
          accessibilityRole="header"
          style={{ color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' }}
        >
          {t.escaneaTitulo}
        </Text>
        <View style={{ flex: 1, margin: 16, borderRadius: 16, overflow: 'hidden' }}>
          {permiso?.granted ? (
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
              onBarcodeScanned={({ data }) => {
                if (leido.current) return;
                leido.current = true;
                alLeer(digitosCodigo(data));
              }}
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <Text style={{ color: '#fff', textAlign: 'center' }}>{t.permisoCamara}</Text>
              <BotonGrande texto={t.darPermiso} alTocar={() => void pedirPermiso()} />
            </View>
          )}
        </View>
        <View style={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          <BotonGrande texto={t.cerrar} tipo="claro" alTocar={cerrar} />
        </View>
      </View>
    </Modal>
  );
}

// ───────────────────────── Producto ─────────────────────────

type Errores = Partial<
  Record<
    | 'nombre'
    | 'precio'
    | 'categoria'
    | 'codigoBarras'
    | 'existencias'
    | 'tamano'
    | 'imagen'
    | 'general',
    string
  >
>;

/** El campo que nombra el servidor, llevado a la casilla de la pantalla. */
function casillaDe(campo: string | undefined): keyof Errores {
  if (campo === 'nombreEs' || campo === 'nombreEn') return 'nombre';
  if (campo === 'categoria1') return 'categoria';
  if (
    campo === 'precio' ||
    campo === 'codigoBarras' ||
    campo === 'existencias' ||
    campo === 'imagen' ||
    campo === 'tamano'
  )
    return campo;
  return 'general';
}

function FormProducto({
  producto,
  moneda,
  cerrar,
  recargar,
}: {
  producto: ProductoCat | null;
  moneda: string;
  cerrar: () => void;
  recargar: () => void;
}) {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(T, idioma);
  const [pais, setPais] = useState(idioma === 'en' ? 'US' : 'XX');
  const [tipo, setTipo] = useState('tienda');
  const palabras = palabrasComercio(tipo, idioma);
  const b = useBorrador({
    formulario: `app-catalogo-${producto?.id ?? 'nuevo'}`,
    cuenta: usuario?.id,
    inicial: FORM_VACIO,
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const v: FormProducto = b.valores;
  const { cargarBase, cambiar } = b;
  const [errores, setErrores] = useState<Errores>({});
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [escaneando, setEscaneando] = useState(false);
  const ultimoCodigo = useRef('');
  const valoresRef = useRef(v);
  valoresRef.current = v;

  // El país y el tipo del comercio (para el idioma del nombre y las palabras) salen de la lista.
  useEffect(() => {
    let vivo = true;
    api
      .pedir<ListaCat>('GET', rutaLista('', 1))
      .then((r) => {
        if (!vivo) return;
        setPais(r.pais);
        setTipo(r.tipo);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [api]);

  useEffect(() => {
    if (!producto) return;
    cargarBase(formDeProducto(producto, pais, (c) => montoATexto(c, moneda)));
  }, [producto, pais, moneda, cargarBase]);

  const ejemplo = montoATexto(moneda === 'USD' ? 250 : 35000, moneda);
  const mensajeDeClave = (clave: string) =>
    clave === 'precio'
      ? t.err.precio.replace('{ej}', ejemplo)
      : (new Map(Object.entries(t.err)).get(clave) ?? '');

  // El código de barras (8 o más dígitos) rellena lo que esté vacío con la ficha de Open Food Facts.
  useEffect(() => {
    const codigo = digitosCodigo(v.codigoBarras);
    if (!puedeBuscarCodigo(codigo) || !codigoBarrasValido(codigo)) return;
    if (ultimoCodigo.current === codigo || producto?.codigoBarras === codigo) return;
    let vivo = true;
    const reloj = setTimeout(() => {
      ultimoCodigo.current = codigo;
      api
        .pedir<{
          encontrado: boolean;
          nombreEs?: string;
          nombreEn?: string;
          marca?: string;
          tamano?: string;
          unidad?: string;
          imagen?: string;
        }>('GET', `/datos/mi-restaurante/productos/codigo/${encodeURIComponent(codigo)}`)
        .then((r) => {
          if (!vivo) return;
          if (!r.encontrado) return setAviso(t.noEncontrado);
          const actual = valoresRef.current;
          const ingles = idiomaDelPais(pais) === 'en';
          const nombre = (ingles ? r.nombreEn || r.nombreEs : r.nombreEs || r.nombreEn) ?? '';
          if (nombre && !actual.nombre) cambiar('nombre', nombre);
          if (r.marca && !actual.marca) cambiar('marca', r.marca);
          if (r.tamano && !actual.tamano) cambiar('tamano', r.tamano);
          if (r.unidad) cambiar('unidadTamano', r.unidad);
          if (r.imagen && !actual.imagen) cambiar('imagen', r.imagen);
          setAviso(t.rellenado);
        })
        .catch((x: unknown) => {
          if (vivo) setErrores((p) => ({ ...p, codigoBarras: mensajeDe(x) }));
        });
    }, 500);
    return () => {
      vivo = false;
      clearTimeout(reloj);
    };
  }, [v.codigoBarras, api, pais, producto, cambiar, t.noEncontrado, t.rellenado]);

  async function elegirFoto() {
    setErrores((p) => ({ ...p, imagen: undefined }));
    try {
      const foto = await fotoConCamara(idioma, CAMARA, async () => {
        const r = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          preferredAssetRepresentationMode:
            ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
          quality: 0.6,
          allowsEditing: true,
          aspect: [1, 1],
        });
        return r.canceled ? null : (r.assets[0] ?? null);
      });
      if (!foto) return;
      setSubiendo(true);
      const url = await subirFotoLivianaApp(api.subirFoto, foto, manipulateAsync, SaveFormat.WEBP);
      cambiar('imagen', url);
    } catch (x) {
      setErrores((p) => ({ ...p, imagen: mensajeDe(x) }));
    } finally {
      setSubiendo(false);
    }
  }

  async function guardar() {
    setErrores({});
    setAviso('');
    const sku = producto ? undefined : skuNuevo(v.codigoBarras);
    const r = cuerpoProducto(v, producto, { pais, moneda, sku });
    if ('error' in r) {
      return setErrores({ [r.error.campo]: mensajeDeClave(r.error.clave) });
    }
    setGuardando(true);
    try {
      // Un producto nuevo con un código que ya está en el catálogo NO lo pisa: se avisa.
      if (!producto && sku && digitosCodigo(v.codigoBarras)) {
        const ya = await api.pedir<ListaCat>('GET', rutaLista(digitosCodigo(v.codigoBarras), 1));
        if (ya.productos.some((p) => p.sku === sku)) {
          setErrores({ codigoBarras: t.err.repetido });
          return;
        }
      }
      await api.pedir('PUT', '/datos/mi-restaurante/productos', r.cuerpo);
      await b.limpiar();
      recargar();
      cerrar();
    } catch (x) {
      const campo = x instanceof ErrorApi ? casillaDe(x.campo) : 'general';
      setErrores({ [campo]: mensajeDe(x) });
    } finally {
      setGuardando(false);
    }
  }

  const foto = fotoDeProducto(v.imagen, (r) => urlFoto(r));
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Pressable
          onPress={cerrar}
          accessibilityRole="button"
          accessibilityLabel={t.volver}
          hitSlop={8}
          style={{ width: 36 }}
        >
          <Text style={{ fontSize: 28, lineHeight: 30, color: C.secundario }}>‹</Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={{ flex: 1, fontSize: 20, fontWeight: '800', color: C.secundario }}
        >
          {producto ? `${t.editar}: ${palabras.articulo}` : palabras.agregarArticulo}
        </Text>
        <Pressable
          onPress={() => void guardar()}
          disabled={guardando}
          accessibilityRole="button"
          accessibilityLabel={t.guardar}
          style={{
            backgroundColor: C.primario,
            borderRadius: 999,
            paddingHorizontal: 16,
            paddingVertical: 9,
            opacity: guardando ? 0.6 : 1,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>
            {guardando ? t.guardando : t.guardar}
          </Text>
        </Pressable>
      </View>
      <AvisoBorrador visible={b.recuperado} idioma={idioma} empezar={b.empezarDeNuevo} />
      {errores.general ? <Text style={e.error}>{errores.general}</Text> : null}
      <Text style={e.etiqueta}>{t.foto}</Text>
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: errores.imagen ? 4 : 14 }}>
        {foto ? (
          <Image
            source={{ uri: foto }}
            style={{ width: 100, height: 100, borderRadius: 14, backgroundColor: '#EEEFF1' }}
            accessibilityIgnoresInvertColors
          />
        ) : null}
        <Pressable
          onPress={() => void elegirFoto()}
          disabled={subiendo}
          accessibilityRole="button"
          accessibilityLabel={foto ? t.cambiarFoto : t.anadirFoto}
          style={{
            flex: 1,
            height: 100,
            borderRadius: 14,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: '#C9C9C9',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#666B73', fontWeight: '700' }}>
            {subiendo ? t.subiendo : foto ? t.cambiarFoto : t.anadirFoto}
          </Text>
        </Pressable>
      </View>
      {errores.imagen ? <Text style={e.error}>{errores.imagen}</Text> : null}
      <Campo
        etiqueta={t.codigo}
        value={v.codigoBarras}
        onChangeText={(x) => {
          cambiar('codigoBarras', x);
          setErrores((p) => ({ ...p, codigoBarras: undefined }));
        }}
        error={errores.codigoBarras}
        keyboardType="number-pad"
        placeholder="0000000000000"
      />
      <BotonGrande texto={t.escanear} tipo="borde" alTocar={() => setEscaneando(true)} />
      {aviso ? <Text style={{ color: '#666B73', marginVertical: 8 }}>{aviso}</Text> : null}
      <View style={{ height: 8 }} />
      <Campo
        etiqueta={t.nombre}
        value={v.nombre}
        onChangeText={(x) => cambiar('nombre', x)}
        error={errores.nombre}
        placeholder={t.nombre}
      />
      <Campo
        etiqueta={moneda === 'USD' ? t.precio : t.precioMoneda.replace('{m}', moneda)}
        value={v.precio}
        onChangeText={(x) => cambiar('precio', x)}
        error={errores.precio}
        keyboardType="decimal-pad"
        placeholder={montoATexto(0, moneda)}
      />
      <Campo
        etiqueta={palabras.categoria === 'Tipo de comida' ? t.categoria : palabras.categoria}
        value={v.categoria}
        onChangeText={(x) => cambiar('categoria', x)}
        error={errores.categoria}
        placeholder={t.categoria}
      />
      <Campo
        etiqueta={t.existenciasCampo}
        value={v.existencias}
        onChangeText={(x) => cambiar('existencias', x)}
        error={errores.existencias}
        keyboardType="number-pad"
        placeholder="0"
      />
      <Campo
        etiqueta={t.marca}
        value={v.marca}
        onChangeText={(x) => cambiar('marca', x)}
        placeholder={t.marca}
      />
      {escaneando ? (
        <Escaner
          cerrar={() => setEscaneando(false)}
          alLeer={(codigo) => {
            setEscaneando(false);
            cambiar('codigoBarras', codigo);
            setErrores((p) => ({ ...p, codigoBarras: undefined }));
          }}
        />
      ) : null}
    </View>
  );
}

// ───────────────────────── Carga masiva ─────────────────────────

/** El texto CSV del archivo elegido: un .csv se lee tal cual; un .xlsx se convierte en el teléfono. */
async function csvDelArchivo(a: DocumentPicker.DocumentPickerAsset): Promise<string> {
  const tipo = tipoDeArchivo(a.name, a.mimeType);
  if (!tipo) throw new ExcelIlegible('archivo', 'invalido');
  // En la web el selector entrega el archivo del navegador; en el teléfono, su dirección.
  const web = a.file;
  if (tipo === 'csv') return web ? await web.text() : await new File(a.uri).text();
  const bytes = web ? new Uint8Array(await web.arrayBuffer()) : await new File(a.uri).bytes();
  return xlsxACsv(bytes);
}

async function compartirPlantilla(titulo: string) {
  const texto = plantillaCsv();
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'divoox-plantilla-productos.csv';
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const archivo = new File(Paths.cache, 'divoox-plantilla-productos.csv');
  archivo.create({ overwrite: true });
  archivo.write(texto);
  await Sharing.shareAsync(archivo.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: titulo,
  });
}

function CargaMasiva({ cerrar, recargar }: { cerrar: () => void; recargar: () => void }) {
  const { api, idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const [csv, setCsv] = useState('');
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [previa, setPrevia] = useState<RespuestaImportacion | null>(null);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [trabajando, setTrabajando] = useState('');

  async function revisar(texto: string, confirmar: boolean) {
    const r = await api.pedir<RespuestaImportacion>(
      'POST',
      '/datos/mi-restaurante/productos/importar',
      {
        csv: texto,
        confirmar,
      },
    );
    return r;
  }

  async function elegir() {
    setError('');
    setAviso('');
    try {
      const r = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/csv',
          'text/comma-separated-values',
          'application/csv',
          'text/plain',
          // Algunos teléfonos no reconocen el .csv y lo entregan como «cualquier cosa».
          'application/octet-stream',
        ],
        copyToCacheDirectory: true,
      });
      const a = r.canceled ? null : r.assets[0];
      if (!a) return;
      setTrabajando(t.leyendo);
      setPrevia(null);
      const texto = await csvDelArchivo(a);
      setCsv(texto);
      setNombreArchivo(a.name);
      setPrevia(await revisar(texto, false));
    } catch (x) {
      setCsv('');
      setError(
        x instanceof ExcelIlegible
          ? x.message === 'archivo'
            ? t.archivoMalo
            : t.excel[x.motivo]
          : mensajeDe(x),
      );
    } finally {
      setTrabajando('');
    }
  }

  async function guardar() {
    setError('');
    setTrabajando(t.guardando);
    try {
      const r = await revisar(csv, true);
      const res = resumenImportacion(r);
      setPrevia(null);
      setCsv('');
      setAviso(t.listoImportar(res.nuevos, res.actualizados, res.conError));
      recargar();
    } catch (x) {
      setError(mensajeDe(x));
    } finally {
      setTrabajando('');
    }
  }

  async function plantilla() {
    setError('');
    try {
      await compartirPlantilla(t.plantillaTitulo);
    } catch (x) {
      console.warn('catálogo: no se pudo compartir la plantilla', x);
      setError(t.plantillaMal);
    }
  }

  const res = previa ? resumenImportacion(previa) : null;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Pressable
          onPress={cerrar}
          accessibilityRole="button"
          accessibilityLabel={t.volver}
          hitSlop={8}
          style={{ width: 36 }}
        >
          <Text style={{ fontSize: 28, lineHeight: 30, color: C.secundario }}>‹</Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={{ flex: 1, fontSize: 20, fontWeight: '800', color: C.secundario }}
        >
          {t.importarTitulo}
        </Text>
      </View>
      <Text style={{ color: '#666B73', marginBottom: 4 }}>{t.importarAyuda}</Text>
      <BotonGrande texto={t.plantilla} tipo="claro" alTocar={() => void plantilla()} />
      <BotonGrande
        texto={csv || aviso ? t.otroArchivo : t.elegirArchivo}
        alTocar={() => void elegir()}
        desactivado={trabajando !== ''}
      />
      {trabajando ? <Text style={{ color: '#666B73', marginTop: 10 }}>{trabajando}</Text> : null}
      {error ? <Text style={[e.error, { marginTop: 10 }]}>{error}</Text> : null}
      {aviso ? (
        <Tarjeta style={{ marginTop: 12 }}>
          <Text style={{ color: C.exito, fontWeight: '800' }}>{aviso}</Text>
          <BotonGrande texto={t.verCatalogo} alTocar={cerrar} />
        </Tarjeta>
      ) : null}
      {res && !res.guardado ? (
        <Tarjeta style={{ marginTop: 12 }} etiqueta={t.previa}>
          <Text style={{ fontWeight: '800', fontSize: 16, color: C.secundario }}>{t.previa}</Text>
          {nombreArchivo ? (
            <Text style={{ color: '#666B73', marginBottom: 6 }}>{nombreArchivo}</Text>
          ) : null}
          <Text style={{ color: C.exito, fontWeight: '700' }}>{t.nuevos(res.nuevos)}</Text>
          <Text style={{ color: C.secundario, fontWeight: '700' }}>
            {t.actualizados(res.actualizados)}
          </Text>
          <Text
            style={{
              color: res.conError ? '#B3261E' : '#666B73',
              fontWeight: '700',
              marginTop: 4,
            }}
          >
            {res.conError ? t.conError(res.conError) : t.sinErrores}
          </Text>
          {res.errores.map((x) => (
            <Text key={`${x.fila}-${x.error}`} style={{ color: '#B3261E', marginTop: 4 }}>
              {t.fila} {x.fila}: {x.error}
            </Text>
          ))}
          {res.ocultos > 0 ? (
            <Text style={{ color: '#666B73', marginTop: 4 }}>{t.masErrores(res.ocultos)}</Text>
          ) : null}
          {res.puedeGuardar ? (
            <BotonGrande
              texto={t.guardarN(res.validas)}
              alTocar={() => void guardar()}
              desactivado={trabajando !== ''}
            />
          ) : (
            <Text style={{ color: '#666B73', marginTop: 8 }}>{t.nadaQueGuardar}</Text>
          )}
        </Tarjeta>
      ) : null}
    </View>
  );
}
