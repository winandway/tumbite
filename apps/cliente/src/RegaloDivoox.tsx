import { useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  ErrorApi,
  type Idioma,
  type RegaloDivoox,
  enIdioma,
  formatearMonto,
  nombreRegalo,
  normalizarCodigoRegalo,
  pagaEnMano,
} from '@tumbite/compartido';
import { Boton, C, CASILLA_EN_FILA, Campo, FilaConBoton, Text, useSesion } from '@tumbite/movil';

/**
 * C-CUPON-DIVOOX (17 nov 2026): el regalo que paga Divoox, como lo muestran Uber, DiDi e inDrive en
 * la pantalla del precio: el precio de siempre tachado, el regalo en verde y lo que se paga en mano.
 * «¿Tienes un código de regalo?» lo agrega a la cuenta y se aplica solo cuando cumple.
 */
export const TEXTOS_REGALO = {
  es: {
    regalo: 'Regalo de Divoox',
    pagasEnMano: 'Pagas en mano',
    gratis: 'Gratis',
    soloEnMano: 'El regalo de Divoox se usa pagando en mano (efectivo o pago móvil).',
    tienesCodigo: '¿Tienes un código de regalo?',
    codigo: 'Código de regalo',
    agregar: 'Agregar',
    agregado: 'Listo: tu regalo quedó en tu cuenta y se aplica solo cuando cumple.',
    ocultar: 'Ahora no',
    devuelto: 'El viaje no se hizo: tu regalo volvió a tu cuenta para tu próximo viaje.',
  },
  en: {
    regalo: 'Divoox gift',
    pagasEnMano: 'You pay in person',
    gratis: 'Free',
    soloEnMano: 'The Divoox gift is used when you pay in person (cash or mobile payment).',
    tienesCodigo: 'Have a gift code?',
    codigo: 'Gift code',
    agregar: 'Add',
    agregado: 'Done: your gift is saved to your account and applies on its own when it qualifies.',
    ocultar: 'Not now',
    devuelto: 'The ride didn’t happen: your gift went back to your account for your next ride.',
  },
} satisfies Record<Idioma, Record<string, string>>;

/** Las dos líneas del regalo: el regalo en verde y lo que se paga en mano. */
export function LineaRegalo({
  regalo,
  total,
  moneda,
  idioma,
}: {
  regalo: Pick<RegaloDivoox, 'codigo' | 'nombreEs' | 'nombreEn' | 'monto'>;
  total: number;
  moneda: string;
  idioma: Idioma;
}) {
  const t = enIdioma(TEXTOS_REGALO, idioma);
  const resto = pagaEnMano(total, regalo);
  return (
    <View testID="regalo-divoox" style={{ gap: 2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ color: C.exito, fontWeight: '700', flex: 1 }}>
          {t.regalo} · {nombreRegalo(regalo, idioma)}
        </Text>
        <Text style={{ color: C.exito, fontWeight: '700' }}>
          −{formatearMonto(regalo.monto, moneda, idioma)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ color: C.secundario, fontWeight: '700' }}>{t.pagasEnMano}</Text>
        <Text testID="regalo-paga-en-mano" style={{ color: C.secundario, fontWeight: '700' }}>
          {resto === 0 ? t.gratis : formatearMonto(resto, moneda, idioma)}
        </Text>
      </View>
    </View>
  );
}

/** «¿Tienes un código de regalo?»: lo agrega a la cuenta y avisa para volver a calcular el precio. */
export function AgregarCodigoRegalo({ alAgregar }: { alAgregar: () => void }) {
  const { api, idioma } = useSesion();
  const t = enIdioma(TEXTOS_REGALO, idioma);
  const [abierto, setAbierto] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  async function agregar() {
    setError('');
    setTrabajando(true);
    try {
      await api.pedir('POST', '/datos/regalos-divoox/guardar', {
        codigo: normalizarCodigoRegalo(codigo),
      });
      setListo(true);
      setAbierto(false);
      setCodigo('');
      alAgregar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setTrabajando(false);
    }
  }
  if (!abierto)
    return (
      <View style={{ gap: 4 }}>
        {listo ? (
          <Text accessibilityRole="alert" style={{ color: C.exito, fontWeight: '700' }}>
            {t.agregado}
          </Text>
        ) : null}
        <Pressable
          testID="regalo-agregar-abrir"
          accessibilityRole="button"
          onPress={() => {
            setListo(false);
            setAbierto(true);
          }}
          style={{ paddingVertical: 6 }}
        >
          <Text style={{ color: C.secundario, fontWeight: '700', textDecorationLine: 'underline' }}>
            {t.tienesCodigo}
          </Text>
        </Pressable>
      </View>
    );
  return (
    <View style={{ gap: 6 }}>
      <FilaConBoton style={{ alignItems: 'flex-end' }}>
        <View style={CASILLA_EN_FILA}>
          <Campo
            etiqueta={t.codigo}
            value={codigo}
            onChangeText={(x) => setCodigo(x.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => void agregar()}
            testID="regalo-codigo"
          />
        </View>
        <Boton
          texto={t.agregar}
          alTocar={() => void agregar()}
          cargando={trabajando}
          secundario
          enFila
          testID="regalo-agregar"
        />
      </FilaConBoton>
      {error ? (
        <Text accessibilityRole="alert" style={{ color: C.primario, fontWeight: '700' }}>
          {error}
        </Text>
      ) : null}
      <Pressable accessibilityRole="button" onPress={() => setAbierto(false)}>
        <Text style={{ color: '#666B73' }}>{t.ocultar}</Text>
      </Pressable>
    </View>
  );
}
