import type { ReactNode } from 'react';
import { Platform, View } from 'react-native';
import {
  type Idioma,
  type PerfilConductorPublico,
  vistaPerfilConductor,
} from '@tumbite/compartido';
import { COLOR, COLOR_OSCURO, ESPACIO, RADIO } from './tokens';
import { Icono, type NombreIcono, Text } from './diseno';

/**
 * C-PERFIL-CONDUCTOR (20 nov 2026, todos los países): el perfil del conductor, calcado del borrador
 * aprobado (`progreso/borrador-registro`, `perfilConductor`, variante OSCURA). Lo usan Driver («Así
 * te ven los pasajeros») y la app del pasajero (la tarjeta del conductor en el viaje). Qué se muestra
 * lo decide `vistaPerfilConductor` (paquete compartido): nuevo sin ceros, opcionales que faltan solo
 * para el propio conductor, sellos solo si de verdad está verificado.
 */
const ICONO_FILA: Record<'linea' | 'idiomas' | 'dato', NombreIcono> = {
  linea: 'people-outline',
  idiomas: 'globe-outline',
  dato: 'happy-outline',
};

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export function PerfilConductor({
  perfil,
  idioma,
  propio,
  foto,
  cabecera,
  tamanoFoto = 120,
  debajoDelNombre,
  testID = 'perfil-conductor',
}: {
  perfil: PerfilConductorPublico;
  idioma: Idioma;
  /** true = lo mira el propio conductor (ve las invitaciones a completar). */
  propio: boolean;
  /** La foto (o la inicial), del tamaño `tamanoFoto - 16`. */
  foto: ReactNode;
  /** El texto chico de arriba («Así te ven los pasajeros», «Tu conductor»). */
  cabecera?: string;
  tamanoFoto?: number;
  /** Lo que va justo debajo del nombre (en el viaje, la hora de llegada). */
  debajoDelNombre?: ReactNode;
  testID?: string;
}) {
  const v = vistaPerfilConductor(perfil, { idioma, propio });
  const aro = v.fotoVerificada ? COLOR.exitoVivo : COLOR.bordeOscuro;
  return (
    <View testID={testID} style={{ backgroundColor: COLOR.blanco }}>
      <View
        style={{
          backgroundColor: COLOR.negro,
          alignItems: 'center',
          paddingHorizontal: ESPACIO.xl,
          paddingTop: ESPACIO.l,
          paddingBottom: ESPACIO.xxl,
        }}
      >
        {cabecera ? (
          <Text style={{ color: '#FFFFFF', opacity: 0.75, fontSize: 12.5, fontWeight: '600' }}>
            {cabecera}
          </Text>
        ) : null}
        <View
          testID={`${testID}-foto`}
          style={{
            width: tamanoFoto,
            height: tamanoFoto,
            borderRadius: tamanoFoto / 2,
            padding: 4,
            backgroundColor: aro,
            marginTop: ESPACIO.s,
            marginBottom: ESPACIO.m,
          }}
        >
          <View
            style={{
              flex: 1,
              borderRadius: tamanoFoto / 2,
              borderWidth: 4,
              borderColor: COLOR.negro,
              backgroundColor: '#2A2D31',
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {foto}
          </View>
          {v.fotoVerificada ? (
            <View
              testID={`${testID}-sello-foto`}
              accessibilityLabel={v.sellos.find((s) => s.clave === 'identidad')?.texto}
              style={{
                position: 'absolute',
                right: 2,
                bottom: 2,
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: COLOR.exito,
                borderWidth: 3,
                borderColor: COLOR.negro,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icono nombre="checkmark" tamano={15} color="#FFFFFF" />
            </View>
          ) : null}
        </View>
        <Text
          testID={`${testID}-nombre`}
          numberOfLines={1}
          style={{ color: '#FFFFFF', fontSize: 28, lineHeight: 34, fontWeight: '700' }}
        >
          {v.nombre}
        </Text>
        {debajoDelNombre}
        {v.vehiculo || v.placa ? (
          <Text
            testID={`${testID}-vehiculo`}
            style={{ color: '#FFFFFF', opacity: 0.78, fontSize: 14.5, marginTop: ESPACIO.xs }}
          >
            {v.vehiculo}
            {v.vehiculo && v.placa ? ' · ' : ''}
            {v.placa ? (
              <Text style={{ fontFamily: MONO, fontWeight: '700', letterSpacing: 1 }}>
                {v.placa}
              </Text>
            ) : null}
          </Text>
        ) : null}
        {v.cifras ? (
          <View
            testID={`${testID}-cifras`}
            style={{ flexDirection: 'row', alignSelf: 'stretch', marginTop: ESPACIO.xl }}
          >
            {v.cifras.map((c, i) => (
              <View
                key={c.etiqueta}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  borderLeftWidth: i ? 1 : 0,
                  borderLeftColor: 'rgba(255,255,255,0.16)',
                }}
              >
                <Text
                  style={{ color: '#FFFFFF', fontSize: 24, lineHeight: 30, fontWeight: '600' }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {c.valor}
                </Text>
                <Text style={{ color: '#FFFFFF', opacity: 0.7, fontSize: 12.5 }}>{c.etiqueta}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={{ alignItems: 'center' }}>
            <View
              testID={`${testID}-nuevo`}
              style={{
                marginTop: ESPACIO.l,
                paddingHorizontal: ESPACIO.l,
                paddingVertical: ESPACIO.s,
                borderRadius: RADIO.pildora,
                backgroundColor: COLOR_OSCURO.exitoSuave,
              }}
            >
              <Text style={{ color: COLOR_OSCURO.exito, fontWeight: '700', fontSize: 14 }}>
                {v.nuevo}
              </Text>
            </View>
            {v.nuevoAyuda ? (
              <Text
                style={{
                  color: '#FFFFFF',
                  opacity: 0.78,
                  fontSize: 13,
                  marginTop: ESPACIO.s,
                  textAlign: 'center',
                }}
              >
                {v.nuevoAyuda}
              </Text>
            ) : null}
          </View>
        )}
      </View>
      {v.sellos.length || v.filas.length ? (
        <View style={{ paddingHorizontal: ESPACIO.xl, paddingTop: ESPACIO.l, paddingBottom: 4 }}>
          {v.sellos.length ? (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: ESPACIO.s,
                marginBottom: ESPACIO.s,
              }}
            >
              {v.sellos.map((s) => (
                <View
                  key={s.clave}
                  testID={`${testID}-sello-${s.clave}${s.verificado ? '-si' : '-no'}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    borderRadius: RADIO.pildora,
                    paddingHorizontal: 11,
                    paddingVertical: 6,
                    backgroundColor: s.verificado ? COLOR.exitoSuave : COLOR.superficie,
                  }}
                >
                  {s.verificado ? (
                    <Icono nombre="checkmark" tamano={14} color={COLOR.exito} />
                  ) : null}
                  <Text
                    style={{
                      fontSize: 12.5,
                      fontWeight: '700',
                      color: s.verificado ? COLOR.exito : COLOR.textoSuave,
                    }}
                  >
                    {s.texto}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          {v.filas.map((f) => (
            <View
              key={f.clave}
              testID={`${testID}-${f.clave}`}
              style={{
                flexDirection: 'row',
                gap: ESPACIO.m,
                alignItems: 'flex-start',
                paddingVertical: 13,
                borderTopWidth: 1,
                borderTopColor: COLOR.borde,
              }}
            >
              <Icono nombre={ICONO_FILA[f.clave]} tamano={20} color={COLOR.textoSuave} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: COLOR.textoSuave }}>{f.etiqueta}</Text>
                {f.valor ? (
                  <Text style={{ fontSize: 14.5, lineHeight: 20, color: COLOR.texto }}>
                    {f.valor}
                  </Text>
                ) : (
                  <Text style={{ fontSize: 14.5, lineHeight: 20, color: COLOR.textoTenue }}>
                    {v.textoFalta}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** La inicial del nombre en un círculo (cuando no hay foto verificada o no carga). */
export function InicialConductor({ nombre, tamano }: { nombre: string; tamano: number }) {
  return (
    <Text style={{ color: '#FFFFFF', fontSize: Math.round(tamano * 0.38), fontWeight: '700' }}>
      {(nombre.trim()[0] ?? '·').toUpperCase()}
    </Text>
  );
}
