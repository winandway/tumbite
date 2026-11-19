import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';
import { ErrorApi, type Idioma, enIdioma, formatearMonto } from '@tumbite/compartido';
import { Boton, C, Campo, Text, abrirPagina, useSesion } from '@tumbite/movil';
import { aUnidadMenor, falloRecarga, montosRapidos } from './logica';
import { T_COBROS } from './textos';

/**
 * C-RECARGA-TARJETA-ALOJADA (19 nov 2026 — Perú; sirve a cualquier país con la recarga con tarjeta
 * encendida): el conductor elige un monto y paga en la página segura del procesador, que se abre dentro
 * de la app. El saldo se refresca solo mientras tanto. La app nunca ve la tarjeta. El mínimo con
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

  // La página de pago se abre DENTRO de la app (C-PAGINA-EN-APP). Mientras está abierta y un rato
  // después, el saldo se vuelve a leer cada pocos segundos: el aviso del procesador tarda un poco.
  // Solo lee; al volver a la app (en la web, al volver a la pestaña) se refresca de una vez.
  const [esperando, setEsperando] = useState(0);
  useEffect(() => {
    if (esperando <= 0) return;
    const r = setTimeout(() => {
      alVolver();
      setEsperando((n) => n - 1);
    }, 6000);
    return () => clearTimeout(r);
  }, [esperando, alVolver]);
  useEffect(() => {
    const s = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active' || !fuera.current) return;
      fuera.current = false;
      alVolver();
    });
    return () => s.remove();
  }, [alVolver]);

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
      abrirPagina(r.url);
      setAviso(t.volviste);
      setEsperando(20);
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
