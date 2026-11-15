import { useEffect, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Idioma } from '@tumbite/compartido';
import { C, CampoDireccion, MenuTresPuntos, useSesion } from '@tumbite/movil';
import type { DireccionEntrega } from '../comida/useRestaurantes';
import { type DireccionGuardada, HojaFotosPuerta } from '../FotosPuertaCliente';
import { textosInicio } from './textos';

type Guardada = DireccionGuardada;

/** ¿Borrar? En la web no hay ventanita nativa con botones: va la del navegador. */
function confirmar(mensaje: string, si: string, no: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(mensaje));
  return new Promise((r) =>
    Alert.alert('', mensaje, [
      { text: no, style: 'cancel', onPress: () => r(false) },
      { text: si, style: 'destructive', onPress: () => r(true) },
    ]),
  );
}

/**
 * POR-1 (2 nov 2026): «Entregar en ▾» del inicio, como DoorDash y Uber Eats. Una hoja con la
 * casilla de dirección de siempre (CampoDireccion, C-DIRECCION-SUGERENCIAS), las direcciones
 * guardadas de la persona y «Usar mi ubicación actual». Al elegir, la portada se ordena desde ahí.
 */
export function ElegirDireccion({
  visible,
  idioma,
  cerca,
  cerrar,
  elegir,
}: {
  visible: boolean;
  idioma: Idioma;
  cerca: { lat: number; lng: number } | null;
  cerrar: () => void;
  elegir: (d: DireccionEntrega | null) => void;
}) {
  const { api, usuario } = useSesion();
  const t = textosInicio(idioma);
  const [texto, setTexto] = useState('');
  const [guardadas, setGuardadas] = useState<Guardada[]>([]);
  useEffect(() => {
    if (!visible || !usuario) return;
    let vivo = true;
    api
      .pedir<{ direcciones: Guardada[] }>('GET', '/datos/mis-direcciones')
      .then((r) => {
        if (vivo) setGuardadas(r.direcciones.filter((d) => d.lat != null && d.lng != null));
      })
      .catch((e: unknown) => console.warn('direcciones guardadas: no se pudieron cargar', e));
    return () => {
      vivo = false;
    };
  }, [api, usuario, visible]);

  // C-FOTO-PUERTA: la dirección cuyas fotos se están viendo (hoja «Ayuda a tu repartidor…»).
  const [fotosDe, setFotosDe] = useState<Guardada | null>(null);
  // Si la hoja de fotos se abrió justo después de guardar, al cerrarla se cierra también esta.
  const [cerrarAlTerminar, setCerrarAlTerminar] = useState(false);

  const listo = (d: DireccionEntrega | null) => {
    elegir(d);
    setTexto('');
    cerrar();
  };

  /**
   * Una dirección nueva del buscador, con sesión: se guarda y se abre UNA vez la hoja de las
   * fotos de la puerta («justo después de guardar la dirección», ficha 5.3), con «Ahora no».
   * Si ya estaba guardada, o si guardar falla, se elige como siempre sin frenar a nadie.
   */
  async function elegirNueva(d: { direccion: string; punto: { lat: number; lng: number } }) {
    const entrega: DireccionEntrega = { texto: d.direccion, punto: d.punto };
    const ya = guardadas.some((g) => g.direccion.trim() === d.direccion.trim());
    if (!usuario || ya) return listo(entrega);
    elegir(entrega);
    setTexto('');
    try {
      const r = await api.pedir<{ direccion: Guardada }>('POST', '/datos/mis-direcciones', {
        etiqueta: '',
        direccion: d.direccion,
        apto: '',
        lat: d.punto.lat,
        lng: d.punto.lng,
        instrucciones: '',
        entrega: 'puerta',
      });
      setGuardadas((g) => [r.direccion, ...g]);
      setCerrarAlTerminar(true);
      setFotosDe(r.direccion);
    } catch (x) {
      console.warn('dirección: no se pudo guardar', x);
      cerrar();
    }
  }

  async function borrarDireccion(d: Guardada) {
    if (!(await confirmar(t.borrarDireccionPregunta, t.borrarDireccion, t.cancelarBorrar))) return;
    try {
      await api.pedir('DELETE', `/datos/mis-direcciones/${encodeURIComponent(d.id)}`);
      setGuardadas((g) => g.filter((x) => x.id !== d.id));
    } catch (x) {
      const m = x instanceof Error ? x.message : String(x);
      if (Platform.OS === 'web') window.alert(m);
      else Alert.alert('', m);
    }
  }

  const cerrarFotos = () => {
    setFotosDe(null);
    if (cerrarAlTerminar) {
      setCerrarAlTerminar(false);
      cerrar();
    }
  };

  return (
    <Modal
      presentationStyle="pageSheet"
      visible={visible}
      animationType="slide"
      onRequestClose={cerrar}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: '#ECEDEF',
          }}
        >
          <Text
            accessibilityRole="header"
            style={{ fontSize: 20, fontWeight: '700', color: C.secundario }}
          >
            {t.direccionTitulo}
          </Text>
          <Pressable
            onPress={cerrar}
            accessibilityRole="button"
            accessibilityLabel={t.cerrar}
            hitSlop={10}
          >
            {/* La X con dos líneas (sin emojis en el producto, C-SIN-EMOJIS). */}
            <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
              {[45, -45].map((g) => (
                <View
                  key={g}
                  style={{
                    position: 'absolute',
                    width: 20,
                    height: 2,
                    borderRadius: 1,
                    backgroundColor: C.secundario,
                    transform: [{ rotate: `${g}deg` }],
                  }}
                />
              ))}
            </View>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12 }}
          keyboardShouldPersistTaps="handled"
        >
          <CampoDireccion
            etiqueta={t.direccionCasilla}
            valor={texto}
            cambiar={setTexto}
            cerca={cerca}
            alElegir={(d) => void elegirNueva({ direccion: d.direccion, punto: d.punto })}
            testID="inicio-direccion-casilla"
            autoFocus
          />
          <Pressable
            onPress={() => listo(null)}
            accessibilityRole="button"
            style={{ paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <Text style={{ fontSize: 18, color: C.primario }}>◎</Text>
            <Text style={{ fontWeight: '700', color: C.secundario }}>{t.usarUbicacion}</Text>
          </Pressable>
          {guardadas.length ? (
            <View style={{ gap: 4 }}>
              <Text style={{ fontWeight: '700', color: '#666B73', marginTop: 4 }}>
                {t.direccionesGuardadas}
              </Text>
              {guardadas.map((d, i) => (
                <View
                  key={d.id}
                  style={{
                    // El menú de tres puntos abre hacia abajo: cada fila queda encima de la siguiente.
                    zIndex: guardadas.length - i,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: '#ECEDEF',
                  }}
                >
                  <Pressable
                    onPress={() =>
                      listo({ texto: d.direccion, punto: { lat: d.lat ?? 0, lng: d.lng ?? 0 } })
                    }
                    accessibilityRole="button"
                    style={{ flex: 1, paddingVertical: 12 }}
                  >
                    {d.etiqueta ? (
                      <Text style={{ fontWeight: '700', color: C.secundario }}>{d.etiqueta}</Text>
                    ) : null}
                    <Text style={{ color: '#666B73' }} numberOfLines={2}>
                      {d.direccion}
                    </Text>
                  </Pressable>
                  {d.fotos?.length ? (
                    <View
                      testID={`direccion-con-foto-${d.id}`}
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        backgroundColor: '#E6F2EA',
                      }}
                    >
                      <Text style={{ color: C.exito, fontSize: 12, fontWeight: '700' }}>
                        {t.conFoto}
                      </Text>
                    </View>
                  ) : null}
                  <MenuTresPuntos
                    etiqueta={`${t.opcionesDireccion}: ${d.etiqueta || d.direccion}`}
                    testID={`direccion-menu-${d.id}`}
                    opciones={[
                      {
                        texto: t.fotosPuerta,
                        alTocar: () => setFotosDe(d),
                        testID: `direccion-fotos-${d.id}`,
                      },
                      {
                        texto: t.borrarDireccion,
                        alTocar: () => void borrarDireccion(d),
                        peligro: true,
                        testID: `direccion-borrar-${d.id}`,
                      },
                    ]}
                  />
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
        {/* Dentro de esta hoja, para que en el iPhone se presente encima de ella. */}
        <HojaFotosPuerta
          direccion={fotosDe}
          cerrar={cerrarFotos}
          alCambiar={(c) =>
            setGuardadas((g) =>
              g.map((x) => (x.id === c.id ? { ...x, tipoLugar: c.tipoLugar, fotos: c.fotos } : x)),
            )
          }
        />
      </SafeAreaView>
    </Modal>
  );
}
