import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  type DestinoReciente,
  type FilaLugar,
  type LugarGuardado,
  type ViajeHecho,
  lugaresQueCoinciden,
  ordenarRecientes,
  ordenarResultados,
  partirDireccion,
  textoDistanciaLugar,
  useSugerenciasDireccion,
} from '@tumbite/compartido';
import { C, COLOR, Icono, type NombreIcono, Text, useSesion } from '@tumbite/movil';
import type { Punto } from '../ubicacion';
import { LugaresFila } from './LugaresFila';
import { ICONO_LUGAR, textosLugares } from './textosLugares';
import type { LugarAGuardar } from './useLugares';

export type DestinoElegido = { punto: Punto; direccion: string; clave?: string };
type Popular = { titulo: string; detalle: string; lat: number; lng: number };

/**
 * «¿A dónde vas?» (regla de Richard, BUSQUEDA-DESTINO.md). Casilla vacía: atajos (lugares
 * guardados), Recientes ordenados por hora y día (código, sin IA) y Populares cerca de ti (agregados
 * de la ciudad o lugares conocidos del mapa). Con texto: «Resultados» del mapa por cercanía, y Casa y
 * Trabajo solo si coinciden. Sesiones de búsqueda, 300 ms entre teclas, desde la segunda letra y con
 * tope diario (useSugerenciasDireccion). «Fijar … en el mapa» siempre debajo de la casilla
 * (C-FIJAR-EN-MAPA).
 */
export function BuscarDestino({
  modo,
  cerca,
  lugares,
  guardar,
  borrar,
  volver,
  elegir,
  enMapa,
}: {
  modo: 'destino' | 'recogida';
  cerca: Punto | null;
  lugares: LugarGuardado[];
  guardar: (d: LugarAGuardar, id?: string) => Promise<LugarGuardado>;
  borrar: (id: string) => Promise<void>;
  volver: () => void;
  elegir: (d: DestinoElegido) => void;
  enMapa: () => void;
}) {
  const { api, idioma } = useSesion();
  const t = textosLugares(idioma);
  const [texto, setTexto] = useState('');
  const sug = useSugerenciasDireccion({
    pedir: api.pedir.bind(api),
    cerca,
    minimo: 2,
    tope: true,
  });
  const [recientes, setRecientes] = useState<DestinoReciente[]>([]);
  const [populares, setPopulares] = useState<{ origen: string; lugares: Popular[] }>({
    origen: 'ninguno',
    lugares: [],
  });
  const [eligiendo, setEligiendo] = useState(false);

  useEffect(() => {
    let vivo = true;
    void api
      // C-RECIENTES-CIUDAD: con la ubicación, solo los destinos de la ciudad donde está la persona.
      .pedir<{ destinos: ViajeHecho[] }>(
        'GET',
        cerca
          ? `/datos/lugares/recientes?lat=${cerca.lat}&lng=${cerca.lng}`
          : '/datos/lugares/recientes',
      )
      .then(
        (r) => vivo && setRecientes(ordenarRecientes(r.destinos, new Date(), { idioma, lugares })),
      )
      .catch(() => undefined);
    if (cerca)
      void api
        .pedir<{ origen: string; lugares: Popular[] }>(
          'GET',
          `/datos/lugares/populares?lat=${cerca.lat}&lng=${cerca.lng}`,
        )
        .then((r) => vivo && setPopulares(r))
        .catch(() => undefined);
    return () => {
      vivo = false;
    };
    // Una vez al abrir (los lugares cambian el nombre de los recientes: se recalcula abajo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, cerca?.lat, cerca?.lng]);

  const escrito = texto.trim();
  const coinciden = useMemo(() => lugaresQueCoinciden(escrito, lugares), [escrito, lugares]);
  const resultados = useMemo(() => ordenarResultados(sug.sugerencias), [sug.sugerencias]);

  const tomarLugar = (l: LugarGuardado, f?: FilaLugar) => {
    if (l.lat == null || l.lng == null) return;
    elegir({ punto: { lat: l.lat, lng: l.lng }, direccion: l.direccion, clave: f?.clave ?? l.id });
  };
  const tomarSugerencia = async (id: string) => {
    setEligiendo(true);
    const d = await sug.elegir(id);
    setEligiendo(false);
    if (d) elegir({ punto: d.punto, direccion: d.direccion });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} testID="buscar-destino">
      <View
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 52 }}
      >
        <Pressable
          onPress={volver}
          accessibilityRole="button"
          accessibilityLabel={idioma === 'en' ? 'Back' : 'Volver'}
          hitSlop={10}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icono nombre="chevron-back" tamano={24} color={C.secundario} />
        </Pressable>
        <Text
          accessibilityRole="header"
          style={{ flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '700', marginRight: 44 }}
        >
          {modo === 'destino' ? t.adonde : t.dondeRecoger}
        </Text>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderWidth: 2,
            borderColor: C.secundario,
            borderRadius: 16,
            paddingHorizontal: 14,
            minHeight: 54,
            marginTop: 4,
          }}
        >
          <Icono nombre="search" tamano={20} color={C.secundario} />
          <TextInput
            value={texto}
            onChangeText={(x) => {
              setTexto(x);
              sug.buscar(x);
            }}
            autoFocus
            placeholder={modo === 'destino' ? t.escribe : t.escribeRecogida}
            placeholderTextColor={COLOR.textoSuave}
            accessibilityLabel={modo === 'destino' ? t.escribe : t.escribeRecogida}
            testID="destino-casilla"
            returnKeyType="search"
            style={{ flex: 1, fontSize: 17, color: C.secundario, minHeight: 50 }}
          />
          {texto ? (
            <Pressable
              onPress={() => {
                setTexto('');
                sug.buscar('');
              }}
              accessibilityRole="button"
              accessibilityLabel={idioma === 'en' ? 'Clear' : 'Borrar'}
              hitSlop={8}
            >
              <Icono nombre="close-circle" tamano={20} color={COLOR.textoSuave} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={enMapa}
          accessibilityRole="button"
          testID="destino-fijar-mapa"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderColor: COLOR.borde,
          }}
        >
          <Icono nombre="location-outline" tamano={22} color={C.acento} />
          <Text style={{ flex: 1, color: C.acento, fontWeight: '700', fontSize: 16 }}>
            {modo === 'destino' ? t.fijarDestino : t.fijarRecogida}
          </Text>
          <Icono nombre="chevron-forward" tamano={18} color={COLOR.textoSuave} />
        </Pressable>

        {escrito.length < 2 ? (
          <>
            <View style={{ marginTop: 14 }}>
              <LugaresFila
                lista={lugares}
                alElegir={(l, f) => tomarLugar(l, f)}
                guardar={guardar}
                borrar={borrar}
                cerca={cerca}
                testID="destino-lugares"
              />
            </View>
            {recientes.length ? (
              <Bloque titulo={t.recientes} nota={t.recientesNota}>
                {recientes.map((r) => (
                  <Fila
                    key={r.clave}
                    icono="time-outline"
                    titulo={r.titulo}
                    detalle={[r.detalle, r.motivo].filter(Boolean).join(' · ')}
                    alTocar={() =>
                      elegir({ punto: { lat: r.lat, lng: r.lng }, direccion: r.direccion })
                    }
                    testID={`reciente-${r.clave}`}
                  />
                ))}
              </Bloque>
            ) : null}
            {populares.lugares.length ? (
              <Bloque
                titulo={t.populares}
                nota={populares.origen === 'mapa' ? t.popularesMapa : t.popularesCiudad}
              >
                {populares.lugares.map((p) => (
                  <Fila
                    key={`${p.lat},${p.lng}`}
                    icono="star-outline"
                    titulo={p.titulo}
                    detalle={p.detalle}
                    alTocar={() =>
                      elegir({
                        punto: { lat: p.lat, lng: p.lng },
                        direccion: [p.titulo, p.detalle].filter(Boolean).join(', '),
                      })
                    }
                    testID="popular"
                  />
                ))}
              </Bloque>
            ) : null}
          </>
        ) : (
          <Bloque titulo={t.resultados} nota={t.resultadosNota}>
            {coinciden.map((l) => (
              <Fila
                key={l.id}
                icono={(ICONO_LUGAR[l.icono || ''] ?? 'bookmark-outline') as NombreIcono}
                titulo={l.etiqueta}
                detalle={l.direccion}
                alTocar={() => tomarLugar(l)}
                testID={`resultado-lugar-${l.id}`}
              />
            ))}
            {resultados.map((s) => {
              const partes = s.principal
                ? { titulo: s.principal, detalle: s.secundario ?? '' }
                : partirDireccion(s.texto);
              return (
                <Fila
                  key={s.id}
                  icono="location-outline"
                  titulo={partes.titulo}
                  detalle={partes.detalle}
                  derecha={s.distanciaM != null ? textoDistanciaLugar(s.distanciaM, idioma) : ''}
                  alTocar={() => void tomarSugerencia(s.id)}
                  testID="resultado-mapa"
                />
              );
            })}
            {!coinciden.length && !resultados.length && !sug.buscando ? (
              <Text style={{ color: COLOR.textoSuave, marginTop: 10 }} testID="sin-resultados">
                {sug.agotado ? t.agotado : t.sinResultados}
              </Text>
            ) : null}
            {eligiendo || sug.buscando ? (
              <Text style={{ color: COLOR.textoSuave, marginTop: 10 }}>{t.buscando}</Text>
            ) : null}
          </Bloque>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Bloque({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text
        accessibilityRole="header"
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: COLOR.textoSuave,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}
      >
        {titulo}
      </Text>
      <Text style={{ fontSize: 13, color: COLOR.textoSuave, marginTop: 2 }}>{nota}</Text>
      {children}
    </View>
  );
}

function Fila({
  icono,
  titulo,
  detalle,
  derecha,
  alTocar,
  testID,
}: {
  icono: NombreIcono;
  titulo: string;
  detalle: string;
  derecha?: string;
  alTocar: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityLabel={[titulo, detalle, derecha].filter(Boolean).join(', ')}
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderColor: COLOR.borde,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: COLOR.superficie,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icono nombre={icono} tamano={20} color={C.secundario} />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontWeight: '700', fontSize: 16, color: C.secundario }}>
          {titulo}
        </Text>
        {detalle ? (
          <Text numberOfLines={1} style={{ color: COLOR.textoSuave }}>
            {detalle}
          </Text>
        ) : null}
      </View>
      {derecha ? (
        <Text style={{ color: COLOR.textoSuave, fontWeight: '600', fontSize: 13 }}>{derecha}</Text>
      ) : null}
    </Pressable>
  );
}
