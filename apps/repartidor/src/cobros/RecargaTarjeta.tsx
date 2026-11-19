import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, View } from 'react-native';
import { ErrorApi, type Idioma, enIdioma, formatearMonto } from '@tumbite/compartido';
import { Boton, C, Campo, Text, useSesion } from '@tumbite/movil';
import { aUnidadMenor, falloRecarga, montosRapidos } from './logica';
import { T_COBROS } from './textos';

/**
 * C-RECARGA-TARJETA-ALOJADA (19 nov 2026 — Perú; sirve a cualquier país con la recarga con tarjeta
 * encendida): el conductor elige un monto y paga en la página segura del procesador, en el navegador
 * del teléfono. Al volver a la app el saldo se refresca. La app nunca ve la tarjeta. El mínimo con
 * tarjeta lo manda el servidor (C-RECARGA-TARJETA-MINIMO): por debajo no se abre ningún cobro.
 */
export function RecargaTarjeta({
  moneda,
  min,
  max,
  idioma,
  alVolver,
}: {
  moneda: string;
  min: number;
  max: number;
  idioma: Idioma;
  alVolver: () => void;
}) {
  const { api } = useSesion();
  const t = enIdioma(T_COBROS, idioma);
  const rapidos = montosRapidos(min, max);
  const [elegido, setElegido] = useState<number | null>(rapidos.at(0) ?? null);
  const [otro, setOtro] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [abriendo, setAbriendo] = useState(false);
  const fuera = useRef(false);
  const dinero = (n: number) => formatearMonto(n, moneda, idioma);

  // Al volver del navegador se refresca el saldo (el aviso del procesador puede tardar unos segundos).
  useEffect(() => {
    let otraVez: ReturnType<typeof setTimeout> | null = null;
    const s = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active' || !fuera.current) return;
      fuera.current = false;
      setAviso(t.volviste);
      alVolver();
      otraVez = setTimeout(alVolver, 6000);
    });
    return () => {
      s.remove();
      if (otraVez) clearTimeout(otraVez);
    };
  }, [alVolver, t.volviste]);

  const monto = otro.trim() ? aUnidadMenor(otro) : elegido;

  async function pagar() {
    setAviso('');
    const fallo = falloRecarga(monto, min, max);
    if (fallo) {
      setError(
        fallo === 'minimo'
          ? t.minimo(dinero(min))
          : fallo === 'maximo'
            ? t.maximo(dinero(max))
            : t.montoMalo,
      );
      return;
    }
    setError('');
    setAbriendo(true);
    try {
      const r = await api.pedir<{ url: string }>('POST', '/datos/repartidor/recargas/stripe', {
        monto,
        alojada: true,
      });
      fuera.current = true;
      await Linking.openURL(r.url);
    } catch (x) {
      fuera.current = false;
      setError(x instanceof ErrorApi ? x.message : t.noAbre);
    } finally {
      setAbriendo(false);
    }
  }

  return (
    <View testID="recarga-tarjeta" style={{ gap: 8 }}>
      <Text style={{ fontWeight: '800', color: C.secundario }}>{t.recargaTitulo}</Text>
      <View
        accessibilityRole="radiogroup"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
      >
        {rapidos.map((n) => {
          const activa = !otro.trim() && elegido === n;
          return (
            <Pressable
              key={n}
              testID={`recarga-monto-${n}`}
              onPress={() => {
                setElegido(n);
                setOtro('');
                setError('');
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: activa }}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: activa ? C.secundario : '#C9CCD1',
                backgroundColor: activa ? C.secundario : '#fff',
              }}
            >
              <Text style={{ fontWeight: '700', color: activa ? '#fff' : C.secundario }}>
                {dinero(n)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Campo
        etiqueta={t.otroMonto}
        value={otro}
        onChangeText={(x) => {
          setOtro(x);
          setError('');
        }}
        placeholder={t.otroMonto}
        keyboardType="decimal-pad"
        error={error || undefined}
      />
      <Text style={{ color: '#666B73', fontSize: 12 }}>
        {t.minimo(dinero(min))} {t.recargaAyuda}
      </Text>
      {aviso ? (
        <Text accessibilityRole="alert" style={{ color: C.exito, fontWeight: '700' }}>
          {aviso}
        </Text>
      ) : null}
      <Boton
        texto={abriendo ? t.abriendo : t.pagar(monto && monto > 0 ? dinero(monto) : '')}
        cargando={abriendo}
        alTocar={() => void pagar()}
      />
    </View>
  );
}
