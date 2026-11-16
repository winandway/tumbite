import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { type Idioma, type TipoLugar, rutaFotoPuerta } from '@tumbite/compartido';
import {
  type DireccionConFotos,
  type FotoElegidaPuerta,
  FotosPuerta,
  // La pieza única de la cámara con el origen ya elegido por el botón tocado (los dos botones
  // están a la vista): pide el permiso y, sin permiso, lo dice en palabras; en la computadora,
  // «Tomar foto» abre la cámara web.
  fotoConOrigen,
  useSesion,
} from '@tumbite/movil';
import { Tarjeta } from './comida/piezas';

/**
 * C-FOTO-PUERTA + C-CAMARA-EN-TODA-SUBIDA — todos los países. La hoja común de las fotos de la
 * puerta con la cámara, los archivos y el convertidor de esta app. «Tomar foto» y «Subir desde
 * archivos» son dos botones visibles: el origen ya viene elegido y pasa por `fotoConOrigen`, que
 * pide el permiso y, sin permiso, lo dice en palabras (los archivos siguen disponibles).
 */
const CAMARA = {
  pedirPermiso: () => ImagePicker.requestCameraPermissionsAsync(),
  tomar: () => ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 }),
};

const deArchivos = async () => {
  // NXT-4z: en el iPhone, la versión «compatible» (JPEG); de todas formas se convierte a WebP.
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  return r.canceled ? null : (r.assets[0] ?? null);
};

export const elegirFotoPuerta =
  (idioma: Idioma) =>
  async (origen: 'camara' | 'archivos'): Promise<FotoElegidaPuerta | null> => {
    const a = await fotoConOrigen(idioma, CAMARA, deArchivos, origen);
    return a ? { uri: a.uri, width: a.width, height: a.height, fileName: a.fileName } : null;
  };

export type DireccionGuardada = DireccionConFotos & {
  etiqueta: string;
  direccion: string;
  lat: number | null;
  lng: number | null;
  instrucciones?: string;
  entrega?: 'puerta' | 'mano';
};

export function HojaFotosPuerta({
  direccion,
  cerrar,
  alCambiar,
}: {
  direccion: DireccionConFotos | null;
  cerrar: () => void;
  alCambiar?: (d: { id: string; tipoLugar: TipoLugar | ''; fotos: number[] }) => void;
}) {
  const { idioma } = useSesion();
  return (
    <FotosPuerta
      visible={!!direccion}
      idioma={idioma}
      direccion={direccion}
      cerrar={cerrar}
      alCambiar={alCambiar}
      elegir={elegirFotoPuerta(idioma)}
      manipular={manipulateAsync}
      webp={SaveFormat.WEBP}
    />
  );
}

const TT = {
  es: {
    titulo: 'Fotos de tu puerta',
    ayuda: 'Agrega fotos para que tu repartidor te encuentre.',
    agregar: 'Agregar fotos de mi puerta',
    ver: 'Ver o cambiar las fotos',
    escribeDireccion: 'Primero escribe tu dirección de entrega y luego agrega las fotos.',
    guardando: 'Guardando tu dirección…',
  },
  en: {
    titulo: 'Photos of your door',
    ayuda: 'Add photos so your courier can find you.',
    agregar: 'Add photos of my door',
    ver: 'View or change the photos',
    escribeDireccion: 'Enter your delivery address first, then add the photos.',
    guardando: 'Saving your address…',
  },
};

/**
 * C-FOTO-PUERTA en el carrito: tarjeta discreta (sin ventana emergente) debajo de la casilla de
 * apartamento. Con la dirección ya guardada muestra sus miniaturas; si todavía no está guardada,
 * «Agregar fotos de mi puerta» primero la guarda y luego abre la hoja. El error de la zona que
 * exige la foto (422, campo «fotoPuerta») se muestra aquí, en rojo.
 */
export function TarjetaFotosPuerta({
  direccion,
  textoDireccion,
  guardar,
  alCambiar,
  error,
}: {
  direccion: DireccionGuardada | null;
  textoDireccion: string;
  guardar: () => Promise<DireccionGuardada>;
  alCambiar: (d: { id: string; tipoLugar: TipoLugar | ''; fotos: number[] }) => void;
  error?: string;
}) {
  const { api, idioma } = useSesion();
  const t = idioma === 'en' ? TT.en : TT.es;
  const [abierta, setAbierta] = useState<DireccionGuardada | null>(null);
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [version, setVersion] = useState(0);
  // Las miniaturas, guardadas con la clave para la que se pidieron (dirección, fotos y versión):
  // si la clave cambia, las viejas dejan de mostrarse solas.
  const [minis, setMinis] = useState<{ clave: string; uris: Map<number, string> }>({
    clave: '',
    uris: new Map(),
  });
  const fotos = useMemo(() => direccion?.fotos ?? [], [direccion?.fotos]);
  const clave = `${direccion?.id ?? ''}:${fotos.join(',')}:${version}`;

  useEffect(() => {
    if (!direccion?.id || !fotos.length) return;
    let vivo = true;
    for (const orden of fotos)
      api
        .verFoto(rutaFotoPuerta(direccion.id, orden, { mini: true, version }))
        .then((uri) => {
          if (!vivo) return;
          setMinis((m) => ({
            clave,
            uris: new Map(m.clave === clave ? m.uris : []).set(orden, uri),
          }));
        })
        .catch((x: unknown) => console.warn('foto de la puerta: no cargó la miniatura', orden, x));
    return () => {
      vivo = false;
    };
    // `clave` resume la dirección, sus fotos y la versión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, clave]);

  async function abrir() {
    setAviso('');
    if (direccion) return setAbierta(direccion);
    if (textoDireccion.trim().length < 5) return setAviso(t.escribeDireccion);
    setGuardando(true);
    try {
      setAbierta(await guardar());
    } catch (x) {
      setAviso(x instanceof Error ? x.message : String(x));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta style={{ gap: 8, ...(error ? { borderWidth: 1, borderColor: '#c4001d' } : {}) }}>
      <Text testID="carrito-fotos-puerta" style={{ fontWeight: '700', color: '#101010' }}>
        {t.titulo}
      </Text>
      {fotos.length ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {fotos.map((o) => {
            const uri = minis.clave === clave ? minis.uris.get(o) : undefined;
            return uri ? (
              <Image
                key={o}
                source={{ uri }}
                style={{ width: 64, height: 48, borderRadius: 8, backgroundColor: '#F6F6F6' }}
                resizeMode="cover"
                accessibilityLabel={`${t.titulo} ${o}`}
              />
            ) : (
              <View
                key={o}
                style={{ width: 64, height: 48, borderRadius: 8, backgroundColor: '#F6F6F6' }}
              />
            );
          })}
        </View>
      ) : (
        <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{t.ayuda}</Text>
      )}
      <Pressable
        onPress={() => void abrir()}
        disabled={guardando}
        accessibilityRole="button"
        accessibilityLabel={fotos.length ? t.ver : t.agregar}
        testID="carrito-fotos-puerta-boton"
        style={({ pressed }) => ({
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: '#2a2a2a',
          paddingHorizontal: 14,
          paddingVertical: 9,
          opacity: pressed || guardando ? 0.7 : 1,
        })}
      >
        {guardando ? <ActivityIndicator size="small" color="#101010" /> : null}
        <Text style={{ fontWeight: '700', color: '#101010' }}>
          {guardando ? t.guardando : fotos.length ? t.ver : t.agregar}
        </Text>
      </Pressable>
      {aviso ? <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{aviso}</Text> : null}
      {error ? (
        <Text testID="carrito-fotos-puerta-error" style={{ color: '#c4001d', fontWeight: '600' }}>
          {error}
        </Text>
      ) : null}
      <HojaFotosPuerta
        direccion={abierta}
        cerrar={() => setAbierta(null)}
        alCambiar={(c) => {
          setVersion((v) => v + 1);
          alCambiar(c);
        }}
      />
    </Tarjeta>
  );
}
