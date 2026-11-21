import { Modal } from './Hoja';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  type Idioma,
  type TipoLugar,
  casillasPuerta,
  rutaFotoPuerta,
  textosFotoPuerta,
  tipoLugarDe,
} from '@tumbite/compartido';
import { useSesion } from './sesion';
import { textosCamara } from './camaraLogica';
import { subirFotoPuertaApp } from './fotoLiviana';
import { C } from './ui';
import { Icono, type NombreIcono, Text } from './diseno';
import { CabeceraLugar } from './CabeceraLugar';

/**
 * C-FOTO-PUERTA (15 nov 2026) — todos los países. «Ayuda a tu repartidor a encontrarte»: la hoja
 * de las fotos de la puerta de UNA dirección guardada. Casa (frente y puerta de cerca) o edificio
 * (entrada, paso intermedio y puerta del apartamento), en orden fijo de afuera hacia adentro, cada
 * casilla con su indicación y los dos botones visibles «Tomar foto» y «Subir desde archivos»
 * (C-CAMARA-EN-TODA-SUBIDA). La foto se convierte en el teléfono (WebP 1024 y miniatura 200) y,
 * si la subida falla, se queda en pantalla con «Reintentar». El paquete compartido no depende de
 * expo-image-picker ni de expo-image-manipulator: la app le pasa `elegir`, `manipular` y `webp`.
 */
export type FotoElegidaPuerta = {
  uri: string;
  width: number;
  height: number;
  fileName?: string | null;
};

type Manipular<F> = (
  uri: string,
  acciones: { resize: { width: number; height: number } }[],
  opciones: { compress: number; format: F },
) => Promise<{ uri: string }>;

export type DireccionConFotos = {
  id: string;
  apto?: string | null;
  tipoLugar?: '' | TipoLugar | null;
  fotos?: number[];
};

type EstadoCasilla = {
  /** La foto que se ve: la miniatura del servidor («data:») o la elegida en el teléfono. */
  uri?: string;
  subiendo?: boolean;
  /** La foto elegida que no se pudo subir: se queda para «Reintentar». */
  pendiente?: FotoElegidaPuerta;
  error?: string;
  cambiando?: boolean;
};

/** ¿Borrar? En la web no hay ventanita nativa con botones: va la del navegador. */
function confirmar(titulo: string, mensaje: string, si: string, no: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    const conf = (globalThis as { confirm?: (m: string) => boolean }).confirm;
    return Promise.resolve(conf ? conf(`${titulo}\n\n${mensaje}`) : true);
  }
  return new Promise((ok) =>
    Alert.alert(titulo, mensaje, [
      { text: no, style: 'cancel', onPress: () => ok(false) },
      { text: si, style: 'destructive', onPress: () => ok(true) },
    ]),
  );
}

/** Los tres puntos (sin emojis en el producto, C-SIN-EMOJIS). */
export function PuntosVerticales({ color = C.secundario }: { color?: string }) {
  return (
    <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color }} />
      ))}
    </View>
  );
}

/**
 * Menú de tres puntos con sus opciones. La acción destructiva va aquí adentro, nunca a la vista
 * (regla de Richard: borrar dentro del menú de tres puntos, con confirmación aparte).
 */
export function MenuTresPuntos({
  etiqueta,
  opciones,
  testID,
}: {
  etiqueta: string;
  opciones: {
    texto: string;
    alTocar: () => void;
    peligro?: boolean;
    testID?: string;
    /** Ícono de línea a la izquierda (C-EDITAR-ES-EDITAR: cada acción se reconoce de un vistazo). */
    icono?: NombreIcono;
  }[];
  testID?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <View style={{ position: 'relative', zIndex: abierto ? 20 : 1 }}>
      <Pressable
        onPress={() => setAbierto((a) => !a)}
        accessibilityRole="button"
        accessibilityLabel={etiqueta}
        accessibilityState={{ expanded: abierto }}
        hitSlop={10}
        testID={testID}
        style={{ padding: 6 }}
      >
        <PuntosVerticales />
      </Pressable>
      {abierto ? (
        <View
          accessibilityRole="menu"
          style={{
            position: 'absolute',
            top: 36,
            right: 0,
            minWidth: 272,
            backgroundColor: '#fff',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#2a2a2a',
            paddingVertical: 4,
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          }}
        >
          {opciones.map((o, i) => (
            <Pressable
              key={o.texto}
              onPress={() => {
                setAbierto(false);
                o.alTocar();
              }}
              accessibilityRole="menuitem"
              testID={o.testID}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: '#ECEDEF',
                backgroundColor: pressed ? '#F6F6F6' : '#fff',
              })}
            >
              {o.icono ? (
                <Icono nombre={o.icono} tamano={18} color={o.peligro ? '#c4001d' : C.secundario} />
              ) : null}
              <Text style={{ fontWeight: '600', color: o.peligro ? '#c4001d' : C.secundario }}>
                {o.texto}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function BotonFoto({
  texto,
  alTocar,
  principal,
  deshabilitado,
  testID,
}: {
  texto: string;
  alTocar: () => void;
  principal?: boolean;
  deshabilitado?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={alTocar}
      disabled={deshabilitado}
      accessibilityRole="button"
      accessibilityLabel={texto}
      accessibilityState={{ disabled: !!deshabilitado }}
      testID={testID}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 46,
        borderRadius: 12,
        paddingHorizontal: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: principal ? C.primario : '#fff',
        borderWidth: principal ? 0 : 1,
        borderColor: '#2a2a2a',
        opacity: deshabilitado ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{ fontWeight: '700', color: principal ? '#fff' : C.secundario, textAlign: 'center' }}
      >
        {texto}
      </Text>
    </Pressable>
  );
}

type Props<F> = {
  visible: boolean;
  idioma: Idioma;
  direccion: DireccionConFotos | null;
  cerrar: () => void;
  /** Avisa a la pantalla de afuera cuando cambian el tipo de lugar o las fotos. */
  alCambiar?: (d: { id: string; tipoLugar: TipoLugar | ''; fotos: number[] }) => void;
  /** La foto de la cámara o de los archivos (la app usa `fotoConCamara` con el origen tocado). */
  elegir: (origen: 'camara' | 'archivos') => Promise<FotoElegidaPuerta | null>;
  manipular: Manipular<F>;
  webp: F;
  /**
   * C-NUNCA-EN-BLANCO: dentro de otra hoja va «en línea», como un paso más de la misma ventana.
   * En el iPhone, una ventana encima de otra que se cierran juntas dejaba la de abajo en blanco.
   */
  enLinea?: boolean;
  /**
   * C-EDITAR-ES-EDITAR: como una sección al final de la hoja «Editar dirección» (sin cabecera, sin
   * desplazamiento propio y sin «Listo»): la hoja de afuera pone todo eso.
   */
  seccion?: boolean;
};

export function FotosPuerta<F>(props: Props<F>) {
  const { visible, direccion, cerrar, enLinea, seccion } = props;
  if (enLinea || seccion)
    return visible && direccion ? (
      <ContenidoFotosPuerta key={direccion.id} {...props} direccion={direccion} />
    ) : null;
  return (
    <Modal
      presentationStyle="pageSheet"
      visible={visible}
      animationType="slide"
      onRequestClose={cerrar}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        {/* Una hoja nueva por dirección: arranca con sus datos, sin restos de la anterior. */}
        {visible && direccion ? (
          <ContenidoFotosPuerta key={direccion.id} {...props} direccion={direccion} />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

function ContenidoFotosPuerta<F>({
  idioma,
  direccion,
  cerrar,
  alCambiar,
  elegir,
  manipular,
  webp,
  seccion,
}: Props<F> & { direccion: DireccionConFotos }) {
  const { api } = useSesion();
  const t = textosFotoPuerta(idioma);
  const tc = textosCamara(idioma);
  // Casa o edificio: lo guardado o, si escribió apartamento, edificio sin preguntar (ficha 5.1).
  const [tipo, setTipo] = useState<TipoLugar | null>(() =>
    tipoLugarDe(direccion.tipoLugar, direccion.apto),
  );
  const [fotos, setFotos] = useState<number[]>(() => direccion.fotos ?? []);
  const [casillas, setCasillas] = useState<Map<number, EstadoCasilla>>(() => new Map());
  const [errorTipo, setErrorTipo] = useState('');
  const [guardandoTipo, setGuardandoTipo] = useState(false);
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const id = direccion.id;
  const avisar = useCallback(
    (tl: TipoLugar | null, f: number[]) => {
      if (id) alCambiar?.({ id, tipoLugar: tl ?? '', fotos: f });
    },
    [alCambiar, id],
  );

  const cambiarTipo = useCallback(
    async (nuevo: TipoLugar, conFotosDeMas = false) => {
      if (!id) return;
      // Al cambiar entre casa y edificio el servidor borra las fotos de orden 2 en adelante.
      if (
        conFotosDeMas &&
        !(await confirmar(t.cambiarTipoTitulo, t.cambiarTipoMensaje, t.cambiar, t.cancelar))
      )
        return;
      setErrorTipo('');
      setGuardandoTipo(true);
      try {
        const r = await api.pedir<{ ok: boolean; tipoLugar: TipoLugar; fotos: number[] }>(
          'PATCH',
          `/datos/mis-direcciones/${encodeURIComponent(id)}`,
          { tipoLugar: nuevo },
        );
        if (!vivo.current) return;
        const tl = r.tipoLugar === 'casa' || r.tipoLugar === 'edificio' ? r.tipoLugar : nuevo;
        const quedan = [...(r.fotos ?? [])].sort((a, b) => a - b);
        setTipo(tl);
        setFotos(quedan);
        avisar(tl, quedan);
        setCasillas((c) => new Map([...c].filter(([o]) => quedan.includes(o))));
      } catch (x) {
        if (vivo.current) setErrorTipo(x instanceof Error ? x.message : String(x));
      } finally {
        if (vivo.current) setGuardandoTipo(false);
      }
    },
    [api, avisar, id, t],
  );

  // Al abrir: si el tipo se dedujo del apartamento y no estaba guardado, se guarda (PATCH).
  useEffect(() => {
    const guardado = direccion.tipoLugar === 'casa' || direccion.tipoLugar === 'edificio';
    const deducido = tipoLugarDe(direccion.tipoLugar, direccion.apto);
    if (guardado || !deducido) return;
    api
      .pedir<{ ok: boolean; tipoLugar: TipoLugar; fotos: number[] }>(
        'PATCH',
        `/datos/mis-direcciones/${encodeURIComponent(id)}`,
        { tipoLugar: deducido },
      )
      .then((r) => {
        if (!vivo.current) return;
        const quedan = [...(r.fotos ?? [])].sort((a, b) => a - b);
        setFotos(quedan);
        avisar(deducido, quedan);
      })
      // Si no se pudo guardar, la hoja sigue igual: se vuelve a guardar al cambiarlo o al reabrir.
      .catch((x: unknown) => console.warn('foto de la puerta: no se guardó el tipo de lugar', x));
    // Solo una vez, al abrir la hoja para esta dirección.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Las miniaturas de las fotos que ya están en el servidor.
  useEffect(() => {
    let sigue = true;
    for (const orden of direccion.fotos ?? []) {
      api
        .verFoto(rutaFotoPuerta(id, orden, { mini: true }))
        .then((uri) => {
          if (!sigue) return;
          setCasillas((c) => {
            const antes = c.get(orden);
            if (antes?.uri) return c;
            return new Map(c).set(orden, { ...antes, uri });
          });
        })
        .catch((x: unknown) => console.warn('foto de la puerta: no cargó la miniatura', orden, x));
    }
    return () => {
      sigue = false;
    };
    // Solo al abrir: las fotos nuevas ya se ven desde el teléfono.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fijar = (orden: number, cambio: Partial<EstadoCasilla> | null) =>
    setCasillas((c) =>
      new Map(c).set(orden, cambio === null ? {} : { ...c.get(orden), ...cambio }),
    );

  async function subir(orden: number, foto: FotoElegidaPuerta) {
    // La foto elegida se ve de inmediato y no se suelta hasta que el servidor confirme.
    fijar(orden, { uri: foto.uri, subiendo: true, error: '', pendiente: foto, cambiando: false });
    try {
      await subirFotoPuertaApp(api.subirFoto, foto, manipular, webp, rutaFotoPuerta(id, orden));
      if (!vivo.current) return;
      fijar(orden, { subiendo: false, pendiente: undefined, error: '' });
      setFotos((f) => {
        const n = f.includes(orden) ? f : [...f, orden].sort((a, b) => a - b);
        avisar(tipo, n);
        return n;
      });
    } catch (x) {
      if (!vivo.current) return;
      fijar(orden, {
        subiendo: false,
        error: `${t.sinSubir} ${x instanceof Error ? x.message : ''}`.trim(),
      });
    }
  }

  async function tomar(orden: number, origen: 'camara' | 'archivos') {
    fijar(orden, { error: '' });
    try {
      const foto = await elegir(origen);
      if (foto) await subir(orden, foto);
    } catch (x) {
      // Sin permiso de cámara: el mensaje en palabras, y los archivos siguen a mano.
      fijar(orden, { error: x instanceof Error ? x.message : String(x) });
    }
  }

  async function borrar(orden: number) {
    const si = await confirmar(t.borrarTitulo, t.borrarMensaje, t.borrar, t.cancelar);
    if (!si) return;
    fijar(orden, { subiendo: true, error: '' });
    try {
      await api.pedir('DELETE', rutaFotoPuerta(id, orden));
      if (!vivo.current) return;
      fijar(orden, null);
      setFotos((f) => {
        const n = f.filter((o) => o !== orden);
        avisar(tipo, n);
        return n;
      });
    } catch (x) {
      if (vivo.current)
        fijar(orden, { subiendo: false, error: x instanceof Error ? x.message : String(x) });
    }
  }

  const hayFotos = fotos.length > 0;

  const cuerpo = (
    <>
      {!tipo ? (
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: C.secundario }}>{t.pregunta}</Text>
          {(['casa', 'edificio'] as const).map((op) => (
            <Pressable
              key={op}
              onPress={() => void cambiarTipo(op)}
              disabled={guardandoTipo}
              accessibilityRole="button"
              accessibilityLabel={op === 'casa' ? t.casa : t.edificio}
              testID={`fotos-puerta-tipo-${op}`}
              style={({ pressed }) => ({
                minHeight: 64,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#2a2a2a',
                paddingHorizontal: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: pressed ? '#F6F6F6' : '#fff',
                opacity: guardandoTipo ? 0.6 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#FDECEE',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icono
                  nombre={op === 'casa' ? 'home-outline' : 'business-outline'}
                  tamano={20}
                  color={C.primario}
                />
              </View>
              <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: C.secundario }}>
                {op === 'casa' ? t.casa : t.edificio}
              </Text>
              <Icono nombre="chevron-forward" tamano={18} color="#666B73" />
            </Pressable>
          ))}
          {guardandoTipo ? <ActivityIndicator color={C.primario} /> : null}
          {errorTipo ? <Text style={{ color: '#c4001d' }}>{errorTipo}</Text> : null}
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ flex: 1, color: '#666B73', fontWeight: '600' }}>
              {tipo === 'casa' ? t.esCasa : t.esEdificio}
            </Text>
            <Pressable
              onPress={() =>
                void cambiarTipo(
                  tipo === 'casa' ? 'edificio' : 'casa',
                  fotos.some((o) => o > 1),
                )
              }
              disabled={guardandoTipo}
              accessibilityRole="button"
              accessibilityLabel={`${t.cambiar}: ${tipo === 'casa' ? t.edificio : t.casa}`}
              hitSlop={8}
              testID="fotos-puerta-cambiar-tipo"
            >
              <Text style={{ color: C.secundario, textDecorationLine: 'underline' }}>
                {t.cambiar}
              </Text>
            </Pressable>
          </View>
          {errorTipo ? <Text style={{ color: '#c4001d' }}>{errorTipo}</Text> : null}
          {/* Indicaciones comunes y el aviso de privacidad, antes de los botones. */}
          <View style={{ gap: 6, backgroundColor: '#F6F6F6', borderRadius: 12, padding: 12 }}>
            {t.indicaciones.map((x) => (
              <View key={x} style={{ flexDirection: 'row', gap: 8 }}>
                <Text style={{ color: C.secundario }}>•</Text>
                <Text style={{ flex: 1, color: C.secundario }}>{x}</Text>
              </View>
            ))}
          </View>
          <Text
            testID="fotos-puerta-privacidad"
            style={{ color: '#666B73', fontSize: 13, lineHeight: 18 }}
          >
            {t.privacidad}
          </Text>
          {casillasPuerta(tipo, idioma).map((c) => {
            const est = casillas.get(c.orden) ?? {};
            const tiene = fotos.includes(c.orden);
            const conBotones = !tiene || est.cambiando || !!est.pendiente;
            return (
              <View
                key={c.orden}
                testID={`fotos-puerta-casilla-${c.orden}`}
                style={{
                  borderWidth: 1,
                  borderColor: '#2a2a2a',
                  borderRadius: 14,
                  padding: 14,
                  gap: 10,
                  backgroundColor: '#fff',
                  zIndex: 10 - c.orden,
                }}
              >
                {/* En la web cada vista abre su propia capa (z-index 0): sin subir esta fila,
                      la miniatura de abajo tapaba el menú abierto y «Borrar foto» no se podía
                      tocar (visto en el recorrido del 15 nov 2026). */}
                <View
                  testID={`fotos-puerta-cabecera-${c.orden}`}
                  style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, zIndex: 2 }}
                >
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: C.secundario,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>{c.orden}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ fontWeight: '700', fontSize: 16, color: C.secundario }}>
                      {c.titulo}
                    </Text>
                    <Text style={{ color: '#4A4F57', lineHeight: 20 }}>{c.indicacion}</Text>
                  </View>
                  {tiene && !est.subiendo ? (
                    <MenuTresPuntos
                      etiqueta={`${t.masOpciones}: ${c.titulo}`}
                      testID={`fotos-puerta-menu-${c.orden}`}
                      opciones={[
                        {
                          texto: t.cambiarFoto,
                          alTocar: () => fijar(c.orden, { cambiando: true }),
                          testID: `fotos-puerta-cambiar-${c.orden}`,
                        },
                        {
                          texto: t.borrarFoto,
                          alTocar: () => void borrar(c.orden),
                          peligro: true,
                          testID: `fotos-puerta-borrar-${c.orden}`,
                        },
                      ]}
                    />
                  ) : null}
                </View>
                {est.uri ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Image
                      source={{ uri: est.uri }}
                      accessibilityLabel={c.titulo}
                      style={{
                        width: 120,
                        height: 90,
                        borderRadius: 10,
                        backgroundColor: '#F6F6F6',
                      }}
                      resizeMode="cover"
                    />
                    <View style={{ flex: 1 }}>
                      {est.subiendo ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <ActivityIndicator color={C.primario} />
                          <Text style={{ color: '#666B73' }}>{t.subiendo}</Text>
                        </View>
                      ) : tiene && !est.pendiente ? (
                        <Text
                          testID={`fotos-puerta-guardada-${c.orden}`}
                          style={{ color: C.exito, fontWeight: '700' }}
                        >
                          {t.guardada}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ) : null}
                {est.error ? (
                  <Text style={{ color: '#c4001d' }} accessibilityLiveRegion="polite">
                    {est.error}
                  </Text>
                ) : null}
                {est.pendiente && !est.subiendo ? (
                  <BotonFoto
                    texto={t.reintentar}
                    principal
                    alTocar={() => est.pendiente && void subir(c.orden, est.pendiente)}
                    testID={`fotos-puerta-reintentar-${c.orden}`}
                  />
                ) : null}
                {conBotones ? (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <BotonFoto
                      texto={tc.camara}
                      principal={!est.pendiente}
                      deshabilitado={est.subiendo}
                      alTocar={() => void tomar(c.orden, 'camara')}
                      testID={`fotos-puerta-camara-${c.orden}`}
                    />
                    <BotonFoto
                      texto={tc.archivos}
                      deshabilitado={est.subiendo}
                      alTocar={() => void tomar(c.orden, 'archivos')}
                      testID={`fotos-puerta-archivos-${c.orden}`}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </>
      )}
    </>
  );

  if (seccion) return <View style={{ gap: 14 }}>{cuerpo}</View>;

  return (
    <>
      <CabeceraLugar
        titulo={t.titulo}
        subtitulo={t.subtitulo}
        cerrar={cerrar}
        etiquetaCerrar={hayFotos ? t.listo : t.ahoraNo}
        icono="camera"
        testID="fotos-puerta-cabecera"
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }}>
        {cuerpo}
        <Pressable
          onPress={cerrar}
          accessibilityRole="button"
          accessibilityLabel={hayFotos ? t.listo : t.ahoraNo}
          testID={hayFotos ? 'fotos-puerta-listo' : 'fotos-puerta-ahora-no'}
          style={({ pressed }) => ({
            minHeight: 50,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: hayFotos ? C.exito : '#fff',
            borderWidth: hayFotos ? 0 : 1,
            borderColor: '#2a2a2a',
            opacity: pressed ? 0.85 : 1,
            marginTop: 4,
          })}
        >
          <Text style={{ fontWeight: '700', color: hayFotos ? '#fff' : C.secundario }}>
            {hayFotos ? t.listo : t.ahoraNo}
          </Text>
        </Pressable>
      </ScrollView>
    </>
  );
}
