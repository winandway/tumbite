import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type Idioma, type PuntoConfirmado, iconoDeLugar } from '@tumbite/compartido';
import {
  C,
  CampoDireccion,
  Icono,
  MenuTresPuntos,
  Modal,
  type NombreIcono,
  useSesion,
  Text,
} from '@tumbite/movil';
import type { DireccionEntrega } from '../comida/useRestaurantes';
import type { DireccionGuardada } from '../FotosPuertaCliente';
import { PuntoExacto } from '../PuntoExacto';
import { miUbicacion, type Punto } from '../ubicacion';
import { ICONO_LUGAR } from '../viajes/textosLugares';
import { EditarDireccion } from './EditarDireccion';
import { cuerpoDePunto, despuesDeConfirmarPunto } from './editarDireccionLogica';
import { textosInicio } from './textos';

type Guardada = DireccionGuardada;

const ICONOS = new Map(Object.entries(ICONO_LUGAR));
const ICONO_DE_LUGAR = (x: string) => (ICONOS.get(x) ?? 'star-outline') as NombreIcono;

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
 * Los pasos de la hoja. C-NUNCA-EN-BLANCO (16 nov 2026, pantalla blanca en el iPhone de Richard):
 * todo pasa DENTRO de esta misma ventana. Antes, al guardar se abría la hoja de las fotos de la
 * puerta como otra ventana encima y, al tocar «Ahora no», se cerraban las dos a la vez: el iPhone
 * dejaba la de abajo vacía y sin salida.
 */
type Paso =
  | { tipo: 'buscar' }
  | {
      tipo: 'punto';
      inicial: { punto: Punto | null; direccion: string; referencia?: string; apto?: string };
      /** La dirección guardada que se ajusta («Ajustar el punto»): se corrige ESA, por su id. */
      guardada?: Guardada;
      /** A dónde se vuelve: la lista o la hoja de esa dirección. */
      volverA?: 'buscar' | 'editar';
    }
  /**
   * C-EDITAR-ES-EDITAR: la hoja de la dirección (nombre, datos y, abajo y opcional, las fotos de la
   * entrada). `nueva`: recién guardada, se ofrece una vez con «Ahora no».
   */
  | { tipo: 'editar'; direccion: Guardada; nueva?: boolean; enfocarFotos?: boolean };

/**
 * POR-1 (2 nov 2026): «Entregar en ▾» del inicio, como DoorDash y Uber Eats.
 * C-PUNTO-EXACTO (16 nov 2026): al elegir una calle o una avenida (o «Estoy aquí») se abre el mapa
 * con el pin fijo en el centro; la persona lo lleva hasta su puerta, agrega el punto de referencia
 * y la casa o apartamento (opcionales) y toca «Confirmar este punto». Se guarda con el punto exacto
 * y la referencia; después, una vez, se ofrece la hoja de la dirección (con «Ahora no»).
 * C-EDITAR-ES-EDITAR (21 nov 2026): en los tres puntos de cada dirección, «Editar» va primero y abre
 * esa hoja; «Fotos de la entrada» la abre en las fotos; ajustar el punto de una dirección guardada
 * la corrige por su id y vuelve atrás, nunca termina en las fotos.
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
  const [paso, setPaso] = useState<Paso>({ tipo: 'buscar' });
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [buscandome, setBuscandome] = useState(false);

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

  // Al cerrar se deja lista para la próxima vez: empieza en la búsqueda.
  const salir = () => {
    setTexto('');
    setAviso('');
    setPaso({ tipo: 'buscar' });
    cerrar();
  };

  /**
   * La persona confirmó el punto exacto: se elige y se guarda. Si era una dirección guardada, se
   * corrige esa misma (PUT por id) y se vuelve atrás; si es nueva, se ofrece su hoja una vez.
   */
  async function alConfirmar(
    p: PuntoConfirmado,
    guardada?: Guardada,
    volverA: 'buscar' | 'editar' = 'buscar',
  ) {
    const entrega: DireccionEntrega = {
      texto: p.direccion,
      punto: p.punto,
      referencia: p.referencia,
      apto: p.apto,
    };
    elegir(entrega);
    if (!usuario || p.direccion.trim().length < 5) return salir();
    setAviso('');
    setGuardando(true);
    try {
      const r = guardada
        ? await api.pedir<{ direccion: Guardada }>(
            'PUT',
            `/datos/mis-direcciones/${encodeURIComponent(guardada.id)}`,
            cuerpoDePunto(guardada, p),
          )
        : await api.pedir<{ direccion: Guardada }>('POST', '/datos/mis-direcciones', {
            etiqueta: '',
            direccion: p.direccion,
            apto: p.apto,
            referencia: p.referencia,
            lat: p.punto.lat,
            lng: p.punto.lng,
            instrucciones: '',
            entrega: 'puerta',
          });
      setGuardadas((g) => [r.direccion, ...g.filter((x) => x.id !== r.direccion.id)]);
      setTexto('');
      const destino = despuesDeConfirmarPunto({
        eraGuardada: !!guardada,
        tieneFotos: !!r.direccion.fotos?.length,
      });
      if (destino === 'lista')
        setPaso(
          volverA === 'editar' ? { tipo: 'editar', direccion: r.direccion } : { tipo: 'buscar' },
        );
      // Ficha 5.3 de la foto de la puerta: justo después de guardar una NUEVA, una vez, con «Ahora no».
      else if (destino === 'hoja') setPaso({ tipo: 'editar', direccion: r.direccion, nueva: true });
      else salir();
    } catch (x) {
      // Ya quedó elegida para este pedido: no se frena a nadie, pero se dice qué pasó.
      console.warn('dirección: no se pudo guardar', x);
      setAviso(x instanceof Error ? x.message : String(x));
      setPaso({ tipo: 'buscar' });
    } finally {
      setGuardando(false);
    }
  }

  /** «Ajustar el punto en el mapa» de una dirección guardada (desde la lista o desde su hoja). */
  const ajustar = (d: Guardada, volverA: 'buscar' | 'editar') =>
    setPaso({
      tipo: 'punto',
      guardada: d,
      volverA,
      inicial: {
        punto: d.lat != null && d.lng != null ? { lat: d.lat, lng: d.lng } : null,
        direccion: d.direccion,
        referencia: d.referencia ?? '',
        apto: d.apto ?? '',
      },
    });

  async function estoyAqui() {
    setBuscandome(true);
    const p = await miUbicacion({ aMano: true }).catch(() => null);
    setBuscandome(false);
    // Sin permiso o sin señal, el mapa abre igual (en la zona) y lo dice en palabras.
    setPaso({ tipo: 'punto', inicial: { punto: p, direccion: '' } });
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

  const contenido = () => {
    if (guardando)
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator color={C.primario} />
          <Text style={{ color: '#666B73' }}>{t.guardando}</Text>
        </View>
      );
    if (paso.tipo === 'punto')
      return (
        <PuntoExacto
          tipo="entrega"
          inicial={paso.inicial}
          cerca={cerca}
          volver={() =>
            setPaso(
              paso.guardada && paso.volverA === 'editar'
                ? { tipo: 'editar', direccion: paso.guardada }
                : { tipo: 'buscar' },
            )
          }
          confirmar={(p) => void alConfirmar(p, paso.guardada, paso.volverA)}
        />
      );
    if (paso.tipo === 'editar') {
      const d = paso.direccion;
      return (
        <EditarDireccion
          key={d.id}
          idioma={idioma}
          direccion={d}
          nueva={paso.nueva}
          enfocarFotos={paso.enfocarFotos}
          volver={() => setPaso({ tipo: 'buscar' })}
          cerrar={salir}
          alGuardar={(r) => {
            setGuardadas((g) => g.map((x) => (x.id === r.id ? r : x)));
            if (paso.nueva) salir();
            else setPaso({ tipo: 'buscar' });
          }}
          alPunto={() => ajustar(d, 'editar')}
          alCambiarFotos={(c) => {
            const cambio = (x: Guardada) =>
              x.id === c.id ? { ...x, tipoLugar: c.tipoLugar, fotos: c.fotos } : x;
            setGuardadas((g) => g.map(cambio));
            // La hoja abierta también conoce sus fotos (al volver del mapa no se pierden).
            setPaso((p) => (p.tipo === 'editar' ? { ...p, direccion: cambio(p.direccion) } : p));
          }}
        />
      );
    }
    return (
      <>
        <Encabezado titulo={t.direccionTitulo} cerrar={salir} etiquetaCerrar={t.cerrar} />
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12 }}
          keyboardShouldPersistTaps="handled"
        >
          <CampoDireccion
            etiqueta={t.direccionCasilla}
            valor={texto}
            cambiar={setTexto}
            cerca={cerca}
            alElegir={(d) =>
              setPaso({ tipo: 'punto', inicial: { punto: d.punto, direccion: d.direccion } })
            }
            testID="inicio-direccion-casilla"
            autoFocus
          />
          {aviso ? (
            <Text testID="inicio-direccion-aviso" style={{ color: '#c4001d' }}>
              {aviso}
            </Text>
          ) : null}
          {/* «Estoy aquí»: un botón grande y claro, no una línea de texto (como Uber y DiDi). */}
          <Pressable
            onPress={() => void estoyAqui()}
            disabled={buscandome}
            accessibilityRole="button"
            accessibilityLabel={t.usarUbicacion}
            testID="inicio-estoy-aqui"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderWidth: 1,
              borderColor: '#2a2a2a',
              borderRadius: 14,
              paddingVertical: 14,
              paddingHorizontal: 16,
              opacity: pressed || buscandome ? 0.7 : 1,
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
              {buscandome ? (
                <ActivityIndicator color={C.primario} />
              ) : (
                <Icono nombre="navigate" tamano={20} color={C.primario} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', fontSize: 17, color: C.secundario }}>
                {t.usarUbicacion}
              </Text>
              <Text style={{ color: '#666B73', fontSize: 13 }}>{t.usarUbicacionAyuda}</Text>
            </View>
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
                    onPress={() => {
                      elegir({
                        texto: d.direccion,
                        punto: { lat: d.lat ?? 0, lng: d.lng ?? 0 },
                        referencia: d.referencia ?? '',
                        apto: d.apto ?? '',
                      });
                      salir();
                    }}
                    accessibilityRole="button"
                    style={{ flex: 1, paddingVertical: 12 }}
                  >
                    {d.etiqueta ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Icono
                          nombre={ICONO_DE_LUGAR(iconoDeLugar(d))}
                          tamano={16}
                          color={C.primario}
                        />
                        <Text style={{ fontWeight: '700', color: C.secundario }}>{d.etiqueta}</Text>
                      </View>
                    ) : null}
                    <Text style={{ color: '#666B73' }} numberOfLines={2}>
                      {d.direccion}
                    </Text>
                    {d.referencia ? (
                      <Text style={{ color: '#666B73', fontSize: 13 }} numberOfLines={1}>
                        {d.referencia}
                      </Text>
                    ) : null}
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
                        texto: t.editarDireccion,
                        icono: 'create-outline',
                        alTocar: () => setPaso({ tipo: 'editar', direccion: d }),
                        testID: `direccion-editar-${d.id}`,
                      },
                      {
                        texto: t.ajustarPunto,
                        icono: 'map-outline',
                        alTocar: () => ajustar(d, 'buscar'),
                        testID: `direccion-ajustar-${d.id}`,
                      },
                      {
                        texto: t.fotosPuerta,
                        icono: 'camera-outline',
                        alTocar: () =>
                          setPaso({ tipo: 'editar', direccion: d, enfocarFotos: true }),
                        testID: `direccion-fotos-${d.id}`,
                      },
                      {
                        texto: t.borrarDireccion,
                        icono: 'trash-outline',
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
      </>
    );
  };

  return (
    <Modal
      presentationStyle="pageSheet"
      visible={visible}
      animationType="slide"
      onRequestClose={salir}
      testID="hoja-direccion"
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>{contenido()}</SafeAreaView>
    </Modal>
  );
}

function Encabezado({
  titulo,
  cerrar,
  etiquetaCerrar,
}: {
  titulo: string;
  cerrar: () => void;
  etiquetaCerrar: string;
}) {
  return (
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
        {titulo}
      </Text>
      <Pressable
        onPress={cerrar}
        accessibilityRole="button"
        accessibilityLabel={etiquetaCerrar}
        hitSlop={10}
        testID="hoja-direccion-cerrar"
      >
        <Icono nombre="close" tamano={24} color={C.secundario} />
      </Pressable>
    </View>
  );
}
