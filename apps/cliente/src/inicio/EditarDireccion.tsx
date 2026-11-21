import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { ICONOS_LUGAR, type Idioma, type TipoLugar, useBorrador } from '@tumbite/compartido';
import {
  AvisoBorrador,
  Boton,
  C,
  COLOR,
  CabeceraLugar,
  Icono,
  type NombreIcono,
  Text,
  alSalirTelefono,
  almacenTelefono,
  useSesion,
} from '@tumbite/movil';
import { type DireccionGuardada, HojaFotosPuerta } from '../FotosPuertaCliente';
import { ICONO_LUGAR } from '../viajes/textosLugares';
import {
  type DatosEditables,
  type FormularioDireccion,
  NOMBRE_MAXIMO,
  cuerpoDeEdicion,
  elegirTipo,
  formularioDe,
} from './editarDireccionLogica';
import { textosInicio } from './textos';

const ICONOS = new Map(Object.entries(ICONO_LUGAR));
const ico = (x: string) => (ICONOS.get(x) ?? 'star-outline') as NombreIcono;

/**
 * C-EDITAR-ES-EDITAR (21 nov 2026) — todos los países. La hoja de una dirección guardada, como un
 * paso dentro de «Tus direcciones» (C-NUNCA-EN-BLANCO: nunca otra ventana encima):
 *   1. «¿Dónde te entregamos?»: Casa, Trabajo y los demás tipos con su ícono, y el nombre propio.
 *   2. Datos de la dirección: el punto en el mapa («Ajustar el punto en el mapa»), apartamento y
 *      punto de referencia.
 *   3. Opcional, abajo: las fotos de la entrada (casa o edificio, «Tomar foto» y «Subir desde
 *      archivos») y el mensaje para quien llega.
 * Lo escrito no se pierde: borrador por cuenta y por dirección, que se borra solo cuando el
 * servidor confirma el guardado. Las fotos se guardan al instante, cada una por su lado.
 */
export function EditarDireccion({
  idioma,
  direccion,
  nueva = false,
  enfocarFotos = false,
  volver,
  cerrar,
  alGuardar,
  alPunto,
  alCambiarFotos,
}: {
  idioma: Idioma;
  direccion: DireccionGuardada;
  /** Recién guardada: se ofrece una vez, con «Ahora no» y sin obligar a nada. */
  nueva?: boolean;
  /** Abierta desde «Fotos de la entrada»: baja sola hasta las fotos. */
  enfocarFotos?: boolean;
  volver: () => void;
  cerrar: () => void;
  alGuardar: (d: DireccionGuardada) => void;
  alPunto: () => void;
  alCambiarFotos: (c: { id: string; tipoLugar: TipoLugar | ''; fotos: number[] }) => void;
}) {
  const { api, usuario } = useSesion();
  const t = textosInicio(idioma);
  const te = t.editar;
  const datos: DatosEditables = direccion;
  const b = useBorrador<FormularioDireccion>({
    formulario: `editar-direccion-${direccion.id}`,
    cuenta: usuario?.id,
    inicial: formularioDe(datos),
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const { valores: v, cambiar } = b;
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState('');
  const desplazar = useRef<ScrollView>(null);
  const yFotos = useRef(0);

  // Abierta desde «Fotos de la entrada»: cuando la hoja ya tomó su tamaño, baja hasta las fotos.
  useEffect(() => {
    if (!enfocarFotos) return;
    const t = setTimeout(
      () => desplazar.current?.scrollTo({ y: Math.max(0, yFotos.current - 8), animated: true }),
      450,
    );
    return () => clearTimeout(t);
  }, [enfocarFotos]);

  async function guardar() {
    setTrabajando(true);
    setError('');
    try {
      const r = await api.pedir<{ direccion: DireccionGuardada }>(
        'PUT',
        `/datos/mis-direcciones/${encodeURIComponent(direccion.id)}`,
        cuerpoDeEdicion(datos, v),
      );
      // Lo escrito se borra solo cuando el servidor confirmó que se guardó.
      await b.limpiar();
      alGuardar(r.direccion);
    } catch (x) {
      // Lo escrito se queda en pantalla (y en el borrador) para reintentar.
      setError(x instanceof Error && x.message ? x.message : te.noSeGuardo);
    } finally {
      setTrabajando(false);
    }
  }

  async function ahoraNo() {
    // «Ahora no» es soltarlo a propósito: el borrador no debe reaparecer encima de lo guardado.
    await b.limpiar();
    cerrar();
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} testID="editar-direccion">
      <CabeceraLugar
        titulo={nueva ? te.tituloNueva : te.titulo}
        subtitulo={nueva ? te.subtituloNueva : te.subtitulo}
        volver={nueva ? undefined : volver}
        etiquetaVolver={te.volver}
        cerrar={nueva ? () => void ahoraNo() : cerrar}
        etiquetaCerrar={nueva ? te.ahoraNo : t.cerrar}
        testID="editar-direccion-cabecera"
      />
      <ScrollView
        ref={desplazar}
        contentContainerStyle={{ padding: 16, gap: 22, paddingBottom: 28 }}
        keyboardShouldPersistTaps="handled"
      >
        <AvisoBorrador visible={b.recuperado} idioma={idioma} empezar={b.empezarDeNuevo} />

        {/* 1. ¿Dónde te entregamos? */}
        <Paso numero={1} titulo={te.paso1} ayuda={te.paso1Ayuda}>
          <View
            accessibilityRole="radiogroup"
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
          >
            {ICONOS_LUGAR.map((x) => {
              const activo = v.icono === x;
              const nombre = new Map(Object.entries(te.tipos)).get(x) ?? x;
              return (
                <Pressable
                  key={x}
                  onPress={() => b.setValores(elegirTipo(v, x, idioma))}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: activo }}
                  accessibilityLabel={nombre}
                  testID={`editar-direccion-tipo-${x}`}
                  style={({ pressed }) => ({
                    width: '23%',
                    minWidth: 72,
                    flexGrow: 1,
                    alignItems: 'center',
                    gap: 6,
                    paddingVertical: 10,
                    borderRadius: 14,
                    borderWidth: activo ? 1.5 : 1,
                    borderColor: activo ? C.primario : COLOR.borde,
                    backgroundColor: activo ? COLOR.marcaSuave : '#FFFFFF',
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  })}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: activo ? C.primario : COLOR.superficie,
                    }}
                  >
                    <Icono nombre={ico(x)} tamano={20} color={activo ? '#FFFFFF' : C.secundario} />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 13,
                      fontWeight: activo ? '700' : '600',
                      color: activo ? C.primario : C.secundario,
                    }}
                  >
                    {nombre}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Casilla
            icono="pricetag-outline"
            etiqueta={te.nombre}
            valor={v.nombre}
            cambiar={(x) => cambiar('nombre', x)}
            ejemplo={te.nombreEj}
            maximo={NOMBRE_MAXIMO}
            testID="editar-direccion-nombre"
          />
        </Paso>

        {/* 2. Datos de la dirección */}
        <Paso numero={2} titulo={te.paso2}>
          <Pressable
            onPress={alPunto}
            accessibilityRole="button"
            accessibilityLabel={`${t.ajustarPunto}: ${direccion.direccion}`}
            testID="editar-direccion-punto"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderWidth: 1,
              borderColor: COLOR.borde,
              borderRadius: 14,
              padding: 14,
              backgroundColor: pressed ? COLOR.superficie : '#FFFFFF',
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: COLOR.marcaSuave,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icono nombre="map-outline" tamano={22} color={C.primario} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontWeight: '700', color: C.secundario }} numberOfLines={2}>
                {direccion.direccion}
              </Text>
              <Text style={{ color: COLOR.marcaOscuro, fontWeight: '700', fontSize: 13 }}>
                {t.ajustarPunto}
              </Text>
            </View>
            <Icono nombre="chevron-forward" tamano={20} color={COLOR.textoSuave} />
          </Pressable>
          <Casilla
            icono="business-outline"
            etiqueta={te.apto}
            valor={v.apto}
            cambiar={(x) => cambiar('apto', x)}
            ejemplo={te.aptoEj}
            maximo={60}
            testID="editar-direccion-apto"
          />
          <Casilla
            icono="flag-outline"
            etiqueta={te.referencia}
            valor={v.referencia}
            cambiar={(x) => cambiar('referencia', x)}
            ejemplo={te.referenciaEj}
            maximo={160}
            testID="editar-direccion-referencia"
          />
        </Paso>

        {/* 3. Opcional: fotos de la entrada y mensaje para quien llega */}
        <View
          testID="editar-direccion-fotos"
          onLayout={(e) => {
            yFotos.current = e.nativeEvent.layout.y;
          }}
        >
          <Paso numero={3} titulo={te.paso3} etiqueta={te.opcional} ayuda={te.paso3Ayuda}>
            <HojaFotosPuerta
              seccion
              direccion={direccion}
              cerrar={() => undefined}
              alCambiar={alCambiarFotos}
            />
            <Casilla
              icono="chatbubble-ellipses-outline"
              etiqueta={te.mensaje}
              valor={v.instrucciones}
              cambiar={(x) => cambiar('instrucciones', x)}
              ejemplo={te.mensajeEj}
              maximo={300}
              varias
              testID="editar-direccion-mensaje"
            />
          </Paso>
        </View>
      </ScrollView>

      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 16,
          gap: 8,
          borderTopWidth: 1,
          borderTopColor: COLOR.borde,
          backgroundColor: '#FFFFFF',
        }}
      >
        {error ? (
          <Text
            testID="editar-direccion-error"
            accessibilityLiveRegion="polite"
            style={{ color: '#c4001d', fontWeight: '600' }}
          >
            {error}
          </Text>
        ) : null}
        <Boton
          texto={te.guardar}
          icono="checkmark"
          cargando={trabajando}
          alTocar={() => void guardar()}
          testID="editar-direccion-guardar"
        />
        {nueva ? (
          <Pressable
            onPress={() => void ahoraNo()}
            accessibilityRole="button"
            accessibilityLabel={te.ahoraNo}
            testID="editar-direccion-ahora-no"
            style={({ pressed }) => ({
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ fontWeight: '700', color: C.secundario }}>{te.ahoraNo}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Un paso numerado: el número en su círculo, el título, una etiqueta opcional y su contenido. */
function Paso({
  numero,
  titulo,
  ayuda,
  etiqueta,
  children,
}: {
  numero: number;
  titulo: string;
  ayuda?: string;
  etiqueta?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: C.secundario,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{numero}</Text>
        </View>
        <Text
          accessibilityRole="header"
          style={{ flex: 1, fontSize: 18, fontWeight: '700', color: C.secundario }}
        >
          {titulo}
        </Text>
        {etiqueta ? (
          <View
            style={{
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 3,
              backgroundColor: COLOR.superficie,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: COLOR.textoSuave }}>
              {etiqueta}
            </Text>
          </View>
        ) : null}
      </View>
      {ayuda ? (
        <Text style={{ color: COLOR.textoSuave, lineHeight: 20, marginTop: -4 }}>{ayuda}</Text>
      ) : null}
      {children}
    </View>
  );
}

/** Una casilla con su ícono a la izquierda, la etiqueta arriba y el contador de letras. */
function Casilla({
  icono,
  etiqueta,
  valor,
  cambiar,
  ejemplo,
  maximo,
  varias,
  testID,
}: {
  icono: NombreIcono;
  etiqueta: string;
  valor: string;
  cambiar: (x: string) => void;
  ejemplo: string;
  maximo: number;
  varias?: boolean;
  testID: string;
}) {
  const [foco, setFoco] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '700', color: C.secundario }}>{etiqueta}</Text>
        {foco || valor.length > maximo * 0.8 ? (
          <Text style={{ fontSize: 12, color: COLOR.textoSuave }}>
            {valor.length}/{maximo}
          </Text>
        ) : null}
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: varias ? 'flex-start' : 'center',
          gap: 10,
          borderWidth: foco ? 1.5 : 1,
          borderColor: foco ? C.secundario : COLOR.borde,
          borderRadius: 12,
          paddingHorizontal: 12,
          minHeight: varias ? 92 : 50,
          paddingTop: varias ? 12 : 0,
        }}
      >
        <Icono nombre={icono} tamano={20} color={foco ? C.primario : COLOR.textoSuave} />
        <TextInput
          value={valor}
          onChangeText={cambiar}
          onFocus={() => setFoco(true)}
          onBlur={() => setFoco(false)}
          placeholder={ejemplo}
          placeholderTextColor={COLOR.textoTenue}
          maxLength={maximo}
          multiline={varias}
          accessibilityLabel={etiqueta}
          testID={testID}
          style={[
            {
              flex: 1,
              fontSize: 16,
              color: C.secundario,
              minHeight: varias ? 72 : 48,
              paddingVertical: varias ? 0 : 12,
              textAlignVertical: varias ? 'top' : 'center',
            },
            // En la web el borde de la casilla ya marca el foco: sin el contorno del navegador.
            Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
          ]}
        />
      </View>
    </View>
  );
}
