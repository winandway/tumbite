import { Pressable, View } from 'react-native';
import type { Idioma } from '@tumbite/compartido';
import {
  COLOR,
  FUENTE,
  Icono,
  LETRA,
  MotivoRechazo,
  PildoraPapel,
  RADIO,
  Text,
  type EstadoPapel,
  type NombreIcono,
} from '@tumbite/movil';
import { textosServicios } from './textos';

const de = (m: Record<string, string> | undefined, k: string) =>
  m ? new Map(Object.entries(m)).get(k) : undefined;

/**
 * Tramo 1 (registro real de un mototaxista, 23 nov 2026): UN solo diseño para la fila de un papel
 * (del conductor o del vehículo), en el perfil y en el alta de Moto y Carro. Antes había dos («Subir /
 * Subir otro» y «Tomar foto / Subir archivo») para la misma moto.
 */
export function FilaPapel({
  nombre,
  detalle,
  estado,
  motivo,
  chips,
  idioma,
  subiendo,
  alSubir,
  alAbrir,
  primera,
  testID,
}: {
  testID?: string;
  nombre: string;
  detalle?: string;
  estado: EstadoPapel;
  motivo?: string;
  chips?: string[];
  idioma: Idioma;
  subiendo?: boolean;
  /** Sube el papel con la cámara o desde los archivos. */
  alSubir?: (origen: 'camara' | 'archivos') => void;
  /** Abre la pantalla completa de ese papel (identidad, antecedentes). */
  alAbrir?: () => void;
  primera?: boolean;
}) {
  const t = textosServicios(idioma);
  const necesita = estado === 'rechazado' || estado === 'falta';
  return (
    <View
      testID={testID}
      style={{
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderTopWidth: primera ? 0 : 1,
        borderTopColor: COLOR.borde,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: FUENTE.tituloMedio, fontSize: 16, lineHeight: 22 }}>
            {nombre}
          </Text>
          {detalle ? <Text style={LETRA.secundario}>{detalle}</Text> : null}
          {chips?.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {chips.map((c) => (
                <View
                  key={c}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: RADIO.s,
                    backgroundColor: COLOR.superficie,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FUENTE.textoFuerte,
                      fontSize: 12,
                      color: COLOR.textoSuave,
                    }}
                  >
                    {c}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
        <PildoraPapel estado={estado} texto={de(t.estados, estado) ?? estado} />
      </View>
      {estado === 'rechazado' && motivo ? (
        <MotivoRechazo etiqueta={t.motivo} texto={motivo} />
      ) : null}
      {necesita && alSubir ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <BotonSubir
              texto={subiendo ? t.subiendo : t.tomarFoto}
              icono="camera-outline"
              fuerte
              cargando={subiendo}
              alTocar={() => alSubir('camara')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <BotonSubir
              texto={t.subirArchivo}
              cargando={subiendo}
              alTocar={() => alSubir('archivos')}
            />
          </View>
        </View>
      ) : necesita && alAbrir ? (
        <BotonSubir texto={nombre} icono="arrow-forward" fuerte alTocar={alAbrir} />
      ) : null}
    </View>
  );
}

export function BotonSubir({
  texto,
  icono,
  fuerte,
  cargando,
  alTocar,
}: {
  texto: string;
  icono?: NombreIcono;
  fuerte?: boolean;
  cargando?: boolean;
  alTocar: () => void;
}) {
  return (
    <Pressable
      onPress={alTocar}
      disabled={cargando}
      accessibilityRole="button"
      accessibilityLabel={texto}
      style={({ pressed }) => ({
        height: 48,
        borderRadius: RADIO.m,
        backgroundColor: fuerte
          ? pressed
            ? '#2A2A2A'
            : COLOR.negro
          : pressed
            ? '#E3E3E3'
            : COLOR.superficie,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: cargando ? 0.6 : 1,
      })}
    >
      {icono ? (
        <Icono nombre={icono} tamano={18} color={fuerte ? COLOR.blanco : COLOR.texto} />
      ) : null}
      <Text
        numberOfLines={2}
        style={{
          fontFamily: FUENTE.tituloMedio,
          fontSize: 15,
          color: fuerte ? COLOR.blanco : COLOR.texto,
        }}
      >
        {texto}
      </Text>
    </Pressable>
  );
}
