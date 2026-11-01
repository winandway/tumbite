import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ErrorApi, enIdioma, formatearMonto } from '@tumbite/compartido';
import { C, e, useSesion } from '@tumbite/movil';

/**
 * C-GANAR-POR-TIEMPO (R-T1, como «Earn by Time» de DoorDash): antes de conectarse, el repartidor
 * elige cómo cobrar. Solo aparece cuando Divoox lo encendió en su zona; conectado no se cambia.
 */
const T = {
  es: {
    titulo: '¿Cómo quieres cobrar hoy?',
    oferta: 'Por oferta',
    ofertaAyuda: 'Ves lo que pagas antes de aceptar cada pedido.',
    tiempo: 'Por tiempo',
    tiempoAyuda: (hora: string) =>
      `${hora} garantizados por hora activa, desde que aceptas hasta que entregas. Propinas aparte.`,
    conectado: 'Para cambiar cómo cobras, desconéctate primero.',
  },
  en: {
    titulo: 'How do you want to earn today?',
    oferta: 'Per offer',
    ofertaAyuda: 'You see the pay before accepting each order.',
    tiempo: 'By time',
    tiempoAyuda: (hora: string) =>
      `${hora} guaranteed per active hour, from accepting to delivering. Tips are extra.`,
    conectado: 'To change how you earn, go offline first.',
  },
};

export function ModoPago({
  datos,
  conectado,
  alCambiar,
}: {
  datos: { activo: boolean; centavosHora: number; modo: 'oferta' | 'tiempo' };
  conectado: boolean;
  alCambiar: () => void;
}) {
  const { api, idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const [error, setError] = useState('');
  if (!datos.activo) return null;
  const hora = formatearMonto(datos.centavosHora, 'USD', idioma);
  async function elegir(modo: 'oferta' | 'tiempo') {
    if (conectado || modo === datos.modo) return;
    setError('');
    try {
      await api.pedir('PUT', '/datos/repartidor/modo-pago', { modo });
      alCambiar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  const opcion = (modo: 'oferta' | 'tiempo', titulo: string, ayuda: string) => {
    const activa = datos.modo === modo;
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: activa, disabled: conectado }}
        onPress={() => void elegir(modo)}
        style={{
          flex: 1,
          padding: 10,
          borderRadius: 10,
          borderWidth: activa ? 2 : 1,
          borderColor: activa ? C.secundario : '#D0D0D0',
          opacity: conectado && !activa ? 0.5 : 1,
        }}
      >
        <Text style={{ fontWeight: '700', color: C.secundario }}>{titulo}</Text>
        <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{ayuda}</Text>
      </Pressable>
    );
  };
  return (
    <View testID="modo-pago" style={[e.tarjeta, { gap: 8 }]}>
      <Text style={{ fontWeight: '700', fontSize: 15 }}>{t.titulo}</Text>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 8 }}>
        {opcion('oferta', t.oferta, t.ofertaAyuda)}
        {opcion('tiempo', t.tiempo, t.tiempoAyuda(hora))}
      </View>
      {conectado ? <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{t.conectado}</Text> : null}
      {error ? <Text style={e.error}>{error}</Text> : null}
    </View>
  );
}
