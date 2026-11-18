import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  type PuntoConfirmado,
  type TipoPunto,
  limpiarDetalles,
  textosPuntoExacto,
  tituloPuntoExacto,
} from '@tumbite/compartido';
import { Boton, C, Campo, Icono, Text, useSesion } from '@tumbite/movil';
import { ElegirEnMapa } from './ElegirEnMapa';
import { miUbicacion, type Punto } from './ubicacion';

/**
 * C-PUNTO-EXACTO en la web: la misma pantalla que en las apps (dirección del punto arriba, «Estoy
 * aquí» grande, punto de referencia, casa o apartamento y «Confirmar este punto»). En la computadora
 * el pin se pone tocando el mapa (el mapa web no gira alrededor de un pin fijo).
 */
export function PuntoExacto({
  tipo,
  inicial,
  cerca,
  conDetalles = true,
  conApto = true,
  confirmar,
  volver,
}: {
  tipo: TipoPunto;
  inicial: { punto: Punto | null; direccion?: string; referencia?: string; apto?: string };
  cerca?: Punto | null;
  conDetalles?: boolean;
  /** «Casa o apartamento»: sí en la entrega y en los envíos; no en el punto de encuentro. */
  conApto?: boolean;
  confirmar: (p: PuntoConfirmado) => void;
  volver: () => void;
}) {
  const { idioma } = useSesion();
  const t = textosPuntoExacto(idioma);
  const [punto, setPunto] = useState<Punto | null>(inicial.punto);
  const [direccion, setDireccion] = useState(inicial.direccion ?? '');
  const [referencia, setReferencia] = useState(inicial.referencia ?? '');
  const [apto, setApto] = useState(inicial.apto ?? '');
  const [aviso, setAviso] = useState('');

  async function estoyAqui() {
    setAviso('');
    const p = await miUbicacion({ aMano: true }).catch(() => null);
    if (p) setPunto(p);
    else setAviso(t.sinPermiso);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#fff' }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      testID="punto-exacto"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable
          onPress={volver}
          accessibilityRole="button"
          accessibilityLabel={t.volver}
          testID="punto-exacto-volver"
        >
          <Icono nombre="arrow-back" tamano={24} color={C.secundario} />
        </Pressable>
        {/* C-TITULO-PUNTO-ENTERO: hasta dos renglones, nunca cortado. */}
        <Text
          accessibilityRole="header"
          numberOfLines={2}
          style={{ flex: 1, flexShrink: 1, fontSize: 18, fontWeight: '700' }}
        >
          {tituloPuntoExacto(idioma, tipo)}
        </Text>
      </View>
      <View style={{ gap: 2 }}>
        <Text style={{ color: '#666B73', fontSize: 13 }}>{t.estaDireccion}</Text>
        <Text testID="punto-exacto-direccion" style={{ fontWeight: '700', fontSize: 16 }}>
          {direccion || t.sinCalle}
        </Text>
      </View>
      <Pressable
        onPress={() => void estoyAqui()}
        accessibilityRole="button"
        testID="punto-exacto-estoy-aqui"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: '#2a2a2a',
          paddingVertical: 12,
        }}
      >
        <Icono nombre="navigate" tamano={20} color={C.primario} />
        <Text style={{ fontWeight: '700', fontSize: 16 }}>{t.estoyAqui}</Text>
      </Pressable>
      <ElegirEnMapa
        punto={punto}
        cambiarPunto={setPunto}
        cambiarDireccion={setDireccion}
        cerca={cerca}
        textos={{ ayuda: t.ayuda, buscando: t.buscandoCalle, pin: t.mapa }}
      />
      {aviso ? <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{aviso}</Text> : null}
      {conDetalles ? (
        <>
          <Campo
            etiqueta={t.referencia}
            value={referencia}
            onChangeText={setReferencia}
            placeholder={t.referenciaEjemplo}
            testID="punto-exacto-referencia"
          />
          {conApto ? (
            <Campo
              etiqueta={t.apto}
              value={apto}
              onChangeText={setApto}
              placeholder={t.aptoEjemplo}
              testID="punto-exacto-apto"
            />
          ) : null}
        </>
      ) : null}
      <Boton
        texto={t.confirmar}
        testID="punto-exacto-confirmar"
        alTocar={() =>
          punto
            ? confirmar({ punto, direccion, ...limpiarDetalles({ referencia, apto }) })
            : setAviso(t.sinSenal)
        }
      />
    </ScrollView>
  );
}
