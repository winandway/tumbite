import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ErrorApi, formatearMonto } from '@tumbite/compartido';
import { C, Text, useSesion } from '@tumbite/movil';
import { type SubidaDisponible, estadoBotonesSubida, textoPaso, textosSubida } from './subirTarifa';

/**
 * C-SUBIR-TARIFA (app del cliente; versión siguiente): en «Buscando…», si en unos segundos nadie
 * acepta, «¿Nadie acepta todavía? Sube la tarifa» con los botones de la ciudad (+0,25, +0,50, +1,00
 * en Venezuela), como «Aumentar tarifa» de inDrive y DiDi. Cada toque lleva su clave: dos toques
 * seguidos no suben dos veces (el servidor también lo impide). Subir no cancela el viaje.
 */
/** La clave de un toque (idempotencia): una por toque, fuera del render. */
function nuevaClave() {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function SubirTarifaBotones({
  viajeId,
  subida,
  recibidoEn,
  alSubir,
}: {
  viajeId: string;
  subida: SubidaDisponible | null;
  /** Cuándo llegó `subida` del servidor (para contar sus segundos). */
  recibidoEn: number;
  alSubir: () => void;
}) {
  const { api, idioma } = useSesion();
  const t = textosSubida(idioma);
  const [ahora, setAhora] = useState(() => Date.now());
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const estado = estadoBotonesSubida(subida, recibidoEn, ahora);
  useEffect(() => {
    if (!subida || estado.visible) return;
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(reloj);
  }, [subida, estado.visible]);
  if (!subida || !estado.visible)
    return aviso ? <Text style={{ marginTop: 12 }}>{aviso}</Text> : null;

  async function subir(monto: number) {
    if (subiendo) return;
    setSubiendo(true);
    setError('');
    const clave = nuevaClave();
    try {
      const r = await api.pedir<{ total: number }>(
        'POST',
        `/datos/viajes/${viajeId}/subir-tarifa`,
        {
          monto,
          clave,
        },
      );
      setAviso(
        t.listo(formatearMonto(r.total, subida?.moneda ?? 'USD', idioma === 'en' ? 'en' : 'es')),
      );
      alSubir();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <View
      testID="subir-tarifa"
      style={{
        marginTop: 16,
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#2a2a2a',
        backgroundColor: '#FFFFFF',
        gap: 10,
      }}
    >
      <Text style={{ fontWeight: '700', fontSize: 16, color: C.secundario }}>{t.titulo}</Text>
      <Text style={{ color: '#666B73' }}>{t.ayuda}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {subida.pasos.map((monto) => {
          const texto = textoPaso(monto, subida.moneda, idioma);
          return (
            <Pressable
              key={monto}
              onPress={() => void subir(monto)}
              disabled={subiendo}
              accessibilityRole="button"
              accessibilityLabel={t.etiqueta(texto)}
              accessibilityState={{ disabled: subiendo, busy: subiendo }}
              testID={`subir-tarifa-${monto}`}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 48,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed ? C.acento : C.primario,
                opacity: subiendo ? 0.6 : 1,
              })}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>{texto}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ color: '#666B73', fontSize: 13 }}>
        {subiendo ? t.subiendo : t.quedan(subida.quedan)}
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={{ color: C.acento, fontWeight: '700' }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
