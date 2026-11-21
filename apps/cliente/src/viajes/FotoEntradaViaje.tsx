import { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { CotizacionViaje, Idioma, LugarGuardado } from '@tumbite/compartido';
import { C, COLOR, Icono, Modal, Text, useSesion } from '@tumbite/movil';
import { HojaFotosPuerta } from '../FotosPuertaCliente';

/**
 * C-FOTO-RECOGIDA (21 nov 2026, orden de Richard) — todos los países. Del lado del pasajero, dos
 * ayudas discretas y opcionales, que nunca frenan el pedido:
 *  1. Al pedir desde una dirección guardada SIN fotos: «Agrega una foto de tu entrada y te encuentran
 *     más rápido», que abre «Fotos de la entrada» de esa dirección.
 *  2. Al terminar un viaje pedido desde un punto suelto: guardarlo como dirección (y agregar su foto).
 * Dentro de un barrio las casas no salen en el mapa; la foto es lo que ve el conductor al llegar.
 */
const T = {
  es: {
    invitacion: 'Agrega una foto de tu entrada y te encuentran más rápido',
    privacidad: 'Solo la ve tu conductor, y solo mientras va hacia ti.',
    guardarTitulo: '¿Sales seguido de aquí?',
    guardarAyuda: 'Guarda este punto como dirección y agrega una foto de tu entrada.',
    guardar: 'Guardar este punto',
    guardando: 'Guardando…',
    guardado: 'Guardado en tus direcciones',
    agregarFoto: 'Agregar una foto de la entrada',
    nombre: 'Mi punto de recogida',
    cerrar: 'Cerrar',
    error: 'No se pudo guardar. Revisa tu conexión e inténtalo otra vez.',
  },
  en: {
    invitacion: 'Add a photo of your entrance and get found faster',
    privacidad: 'Only your driver sees it, and only while on the way to you.',
    guardarTitulo: 'Do you leave from here often?',
    guardarAyuda: 'Save this spot as an address and add a photo of your entrance.',
    guardar: 'Save this spot',
    guardando: 'Saving…',
    guardado: 'Saved to your addresses',
    agregarFoto: 'Add an entrance photo',
    nombre: 'My pickup spot',
    cerrar: 'Close',
    error: 'Couldn’t save. Check your connection and try again.',
  },
};
const textos = (idioma: Idioma) => (idioma === 'en' ? T.en : T.es);

type ConFotos = LugarGuardado & { tipoLugar?: '' | 'casa' | 'edificio' | null; fotos?: number[] };

/** La hoja «Fotos de la entrada» de una dirección, en su propia ventana con salida clara. */
function HojaEntrada({ direccion, cerrar }: { direccion: ConFotos | null; cerrar: () => void }) {
  if (!direccion) return null;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={cerrar}>
      <HojaFotosPuerta direccion={direccion} cerrar={cerrar} alCambiar={() => undefined} />
    </Modal>
  );
}

/** 1. Al pedir: la invitación, solo si sale de una dirección guardada que no tiene fotos. */
export function InvitacionFotoEntrada({
  cotizacion,
  lugares,
  alCambiar,
}: {
  cotizacion: CotizacionViaje | null;
  lugares: LugarGuardado[];
  /** Al cerrar la hoja: se vuelve a leer la lista (ya puede tener fotos). */
  alCambiar: () => void;
}) {
  const { idioma } = useSesion();
  const t = textos(idioma);
  const [abierta, setAbierta] = useState(false);
  const r = cotizacion?.recogida;
  const direccion = (lugares.find((l) => l.id === r?.direccionId) ?? null) as ConFotos | null;
  // Ya tiene fotos (las acaba de agregar o el servidor lo dijo): no se invita.
  if (!r?.guardada || r.conFotos || !direccion || (direccion.fotos?.length ?? 0) > 0)
    return abierta ? (
      <HojaEntrada
        direccion={direccion}
        cerrar={() => {
          setAbierta(false);
          alCambiar();
        }}
      />
    ) : null;
  return (
    <>
      <Pressable
        onPress={() => setAbierta(true)}
        accessibilityRole="button"
        testID="viaje-invitar-foto"
        style={({ pressed }) => ({
          flexDirection: 'row',
          gap: 10,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: '#2a2a2a',
          borderRadius: 12,
          padding: 12,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Icono nombre="camera-outline" tamano={22} color={C.secundario} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontWeight: '700', color: C.secundario }}>{t.invitacion}</Text>
          <Text style={{ color: COLOR.textoSuave, fontSize: 12 }}>{t.privacidad}</Text>
        </View>
        <Icono nombre="chevron-forward" tamano={18} color={COLOR.textoSuave} />
      </Pressable>
      {abierta ? (
        <HojaEntrada
          direccion={direccion}
          cerrar={() => {
            setAbierta(false);
            alCambiar();
          }}
        />
      ) : null}
    </>
  );
}

/** 2. Al terminar un viaje pedido desde un punto suelto: guardarlo como dirección. */
export function GuardarPuntoDeRecogida({
  viaje,
}: {
  viaje: {
    estado: string;
    servicio?: string;
    recogidaGuardada?: boolean;
    origen: { direccion: string; lat: number; lng: number };
  };
}) {
  const { api, idioma } = useSesion();
  const t = textos(idioma);
  const [estado, setEstado] = useState<'nada' | 'guardando' | 'error'>('nada');
  const [guardada, setGuardada] = useState<ConFotos | null>(null);
  const [fotos, setFotos] = useState(false);
  // Solo viajes de personas ya terminados que salieron de un punto suelto (el servidor lo dice).
  if (
    viaje.estado !== 'terminado' ||
    viaje.servicio === 'envios' ||
    viaje.recogidaGuardada !== false
  )
    return null;
  const guardar = async () => {
    setEstado('guardando');
    try {
      const r = await api.pedir<{ direccion: ConFotos }>('POST', '/datos/mis-direcciones', {
        etiqueta: t.nombre,
        direccion: viaje.origen.direccion,
        lat: viaje.origen.lat,
        lng: viaje.origen.lng,
      });
      setGuardada(r.direccion);
      setEstado('nada');
    } catch {
      setEstado('error');
    }
  };
  return (
    <View
      testID="viaje-guardar-punto"
      style={{ borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, padding: 12, gap: 8 }}
    >
      {guardada ? (
        <>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Icono nombre="checkmark-circle" tamano={20} color={C.exito} />
            <Text style={{ fontWeight: '700', color: C.exito }} testID="viaje-punto-guardado">
              {t.guardado}
            </Text>
          </View>
          <Pressable
            onPress={() => setFotos(true)}
            accessibilityRole="button"
            testID="viaje-punto-agregar-foto"
          >
            <Text
              style={{ fontWeight: '700', color: C.secundario, textDecorationLine: 'underline' }}
            >
              {t.agregarFoto}
            </Text>
          </Pressable>
          <Text style={{ color: COLOR.textoSuave, fontSize: 12 }}>{t.privacidad}</Text>
        </>
      ) : (
        <>
          <Text style={{ fontWeight: '700', color: C.secundario }}>{t.guardarTitulo}</Text>
          <Text style={{ color: COLOR.textoSuave }}>{t.guardarAyuda}</Text>
          <Pressable
            onPress={() => void guardar()}
            disabled={estado === 'guardando'}
            accessibilityRole="button"
            testID="viaje-punto-guardar"
            style={({ pressed }) => ({
              minHeight: 44,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#2a2a2a',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed || estado === 'guardando' ? 0.7 : 1,
            })}
          >
            <Text style={{ fontWeight: '700', color: C.secundario }}>
              {estado === 'guardando' ? t.guardando : t.guardar}
            </Text>
          </Pressable>
          {estado === 'error' ? (
            <Text accessibilityRole="alert" style={{ color: C.primario, fontWeight: '700' }}>
              {t.error}
            </Text>
          ) : null}
        </>
      )}
      {fotos ? <HojaEntrada direccion={guardada} cerrar={() => setFotos(false)} /> : null}
    </View>
  );
}
