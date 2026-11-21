import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Modal } from './Hoja';
import { datosPais, nombrePais, type Idioma } from '@tumbite/compartido';
import { Text } from './diseno';
import { COLOR } from './tokens';
import { URL_SERVIDOR } from './sesion';

/**
 * C-TELEFONO-E164 (21 nov 2026): el país del celular en el registro, como en Uber y DoorDash. Arranca
 * en el país desde donde la persona abre la app (lo dice el servidor), y se puede cambiar. Con el
 * país puesto, la persona escribe su número como lo dice siempre («0424…») y la cuenta lo guarda con
 * su código («+58…»). Una sola pieza para las tres apps.
 */
const ORDEN = ['VE', 'CO', 'PE', 'US', 'MX', 'CL'] as const;

/** La bandera del país con sus dos letras (indicadores regionales de Unicode). */
export function banderaDe(iso: string): string {
  return iso
    .toUpperCase()
    .replace(/[A-Z]/g, (l) => String.fromCodePoint(0x1f1e6 + l.charCodeAt(0) - 65));
}

/** El país sugerido por el servidor (desde dónde se abre la app). null si no se sabe. */
export function usePaisSugerido(): string | null {
  const [pais, setPais] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    fetch(`${URL_SERVIDOR}/datos/cuentas/pais-sugerido`)
      .then((r) => (r.ok ? (r.json() as Promise<{ pais: string | null }>) : { pais: null }))
      .then((d) => {
        if (vivo && d.pais) setPais(d.pais);
      })
      .catch(() => {
        // Sin red no se sugiere nada: la persona elige el país o escribe el «+».
      });
    return () => {
      vivo = false;
    };
  }, []);
  return pais;
}

const TEXTOS = {
  es: {
    pais: 'Código de país',
    elegir: 'Elige el país',
    cerrar: 'Cerrar',
    sinPais: 'Elige el país',
  },
  en: {
    pais: 'Country code',
    elegir: 'Choose the country',
    cerrar: 'Close',
    sinPais: 'Choose the country',
  },
} as const;

export function SelectorPaisTelefono({
  pais,
  alCambiar,
  idioma,
}: {
  pais: string | null;
  alCambiar: (pais: string) => void;
  idioma: Idioma;
}) {
  const t = idioma === 'en' ? TEXTOS.en : TEXTOS.es;
  const [abierto, setAbierto] = useState(false);
  const datos = datosPais(pais);
  return (
    <View style={{ marginBottom: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t.pais}: ${datos ? nombrePais(datos.iso, idioma) : t.sinPais}`}
        testID="pais-telefono"
        onPress={() => setAbierto(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: 6,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderWidth: 1,
          borderColor: COLOR.borde,
          borderRadius: 10,
        }}
      >
        <Text style={{ color: COLOR.textoSuave, fontSize: 13 }}>{t.pais}:</Text>
        <Text style={{ fontWeight: '700', fontSize: 15 }}>
          {datos
            ? `${banderaDe(datos.iso)} ${nombrePais(datos.iso, idioma)} +${datos.prefijo}`
            : t.sinPais}
        </Text>
        <Text style={{ color: COLOR.textoSuave }}>▾</Text>
      </Pressable>
      <Modal
        visible={abierto}
        transparent
        animationType="fade"
        onRequestClose={() => setAbierto(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.35)',
            justifyContent: 'center',
            padding: 24,
          }}
          onPress={() => setAbierto(false)}
          accessibilityLabel={t.cerrar}
        >
          <Pressable
            style={{ backgroundColor: COLOR.fondo, borderRadius: 14, padding: 16, maxHeight: 420 }}
            onPress={() => {}}
          >
            <Text style={{ fontWeight: '700', fontSize: 17, marginBottom: 8 }}>{t.elegir}</Text>
            <ScrollView>
              {ORDEN.map((iso) => {
                const d = datosPais(iso);
                if (!d) return null;
                const elegido = iso === pais;
                return (
                  <Pressable
                    key={iso}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: elegido }}
                    testID={`pais-telefono-${iso}`}
                    onPress={() => {
                      alCambiar(iso);
                      setAbierto(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: COLOR.borde,
                    }}
                  >
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        borderWidth: 2,
                        borderColor: elegido ? COLOR.texto : COLOR.borde,
                        backgroundColor: elegido ? COLOR.texto : 'transparent',
                      }}
                    />
                    <Text style={{ fontSize: 15, flex: 1 }}>
                      {banderaDe(iso)} {nombrePais(iso, idioma)}
                    </Text>
                    <Text style={{ color: COLOR.textoSuave }}>+{d.prefijo}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
