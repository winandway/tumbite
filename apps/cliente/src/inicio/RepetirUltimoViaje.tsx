/**
 * C-MISMA-RUTA (15 nov 2026) — todos los países. «Tu último viaje» en el Inicio del cliente (pantalla
 * 3 del sistema de diseño): Origen → Destino, el vehículo y el botón negro «Repetir», que abre la
 * MISMA confirmación de «Mis viajes» (precio recalculado en el servidor).
 *
 * Uso: `<RepetirUltimoViaje />` en el Inicio. Es autocontenido: lee el historial (solo lectura) y
 * toma el viaje más reciente que se pueda repetir (Moto o Carro con sus puntos exactos).
 * No muestra NADA si no hay sesión, si no hay viajes o si el historial no se pudo leer.
 *
 * Props (todas opcionales):
 * - `alPedir(viajeId, servicio)`: qué hacer cuando el viaje nuevo ya existe. Por defecto abre la
 *   pantalla de espera de siempre (/ride con su servicio).
 * - `alCambiar(servicio)`: qué hacer con «Cambiar algo» (Pedir viaje ya quedó escrito). Por defecto
 *   abre /ride con su servicio.
 * - `testID`: por defecto «repetir-ultimo-viaje» (el botón es «repetir-ultimo-viaje-boton»).
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { enIdioma } from '@tumbite/compartido';
import { Boton, ESPACIO, Icono, LETRA, RADIO, Text, useColores, useSesion } from '@tumbite/movil';
import { ConfirmarMismaRuta } from '../viajes/ConfirmarMismaRuta';
import { vehiculoDe } from '../viajes/MisViajes';
import { type ViajeHistorial, sePuedeRepetir } from '../viajes/mismaRuta';
import { TEXTOS_MIS_VIAJES } from '../viajes/textos';

export type PropsRepetirUltimoViaje = {
  alPedir?: (viajeId: string, servicio: string) => void;
  alCambiar?: (servicio: string) => void;
  testID?: string;
};

const aViaje = (servicio: string) => router.push({ pathname: '/ride', params: { servicio } });

export function RepetirUltimoViaje({
  alPedir = (_id, servicio) => aViaje(servicio),
  alCambiar = aViaje,
  testID = 'repetir-ultimo-viaje',
}: PropsRepetirUltimoViaje) {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(TEXTOS_MIS_VIAJES, idioma);
  const col = useColores();
  const [ultimo, setUltimo] = useState<ViajeHistorial | null>(null);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!usuario) return;
    let vivo = true;
    api
      .pedir<{ viajes: ViajeHistorial[] }>('GET', '/datos/viajes/historial')
      .then((r) => vivo && setUltimo(r.viajes.find(sePuedeRepetir) ?? null))
      .catch((e: unknown) => console.warn('inicio: no se pudo leer el último viaje', e));
    return () => {
      vivo = false;
    };
  }, [api, usuario]);

  if (!usuario || !ultimo) return null;
  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: ESPACIO.m,
        padding: ESPACIO.l,
        borderWidth: 1,
        borderColor: col.borde,
        borderRadius: RADIO.l,
        backgroundColor: col.fondo,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: RADIO.m,
          backgroundColor: col.superficie,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icono nombre={ultimo.servicio === 'moto' ? 'bicycle-outline' : 'car-outline'} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[LETRA.pequeno, { color: col.textoSuave }]}>{t.ultimoViaje}</Text>
        <Text style={[LETRA.tarjeta, { color: col.texto }]} numberOfLines={1}>
          {ultimo.origen} → {ultimo.destino}
        </Text>
        <Text style={[LETRA.secundario, { color: col.textoSuave }]} numberOfLines={1}>
          {vehiculoDe(ultimo, t)}
        </Text>
      </View>
      <Boton
        tipo="fuerte"
        icono="repeat-outline"
        texto={t.repetir}
        alTocar={() => setAbierto(true)}
        enFila
        testID={`${testID}-boton`}
      />
      <ConfirmarMismaRuta
        viaje={abierto ? ultimo : null}
        alCerrar={() => setAbierto(false)}
        alPedir={(id, servicio) => {
          setAbierto(false);
          alPedir(id, servicio);
        }}
        alCambiar={(servicio) => {
          setAbierto(false);
          alCambiar(servicio);
        }}
      />
    </View>
  );
}
