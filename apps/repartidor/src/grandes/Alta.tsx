import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Api, Idioma } from '@tumbite/compartido';
import { C, e } from '@tumbite/movil';
import { textosGrandes } from './textos';

type Paso = { id: 'datos' | 'documentos' | 'antecedentes' | 'banco'; estado: string };

/**
 * El alta guiada de Dasher y Uber: cuatro pasos con su estado, con las rutas que ya existen
 * (datos y vehículo, documento y selfie, antecedentes, banco). Tocar un paso abre su sección.
 */
export function Alta({
  api,
  idioma,
  abrir,
}: {
  api: Api;
  idioma: Idioma;
  abrir: (paso: Paso['id']) => void;
}) {
  const t = textosGrandes(idioma).alta;
  const [pasos, setPasos] = useState<Paso[] | null>(null);
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [datos, kyc, billetera] = await Promise.all([
        api
          .pedir<{ datos: { vehiculoTipo?: string } | null }>('GET', '/datos/repartidor/datos')
          .catch(() => null),
        api
          .pedir<{ kyc: { estado: string; antecedentes?: { estado: string } } }>(
            'GET',
            '/datos/kyc',
          )
          .catch(() => null),
        api.pedir<{ cuentaConectada: boolean }>('GET', '/datos/billetera').catch(() => null),
      ]);
      if (!vivo) return;
      const k = kyc?.kyc.estado ?? 'sin_enviar';
      const a = kyc?.kyc.antecedentes?.estado ?? 'sin_pedir';
      setPasos([
        { id: 'datos', estado: datos?.datos?.vehiculoTipo ? 'listo' : 'pendiente' },
        {
          id: 'documentos',
          estado:
            k === 'aprobado'
              ? 'listo'
              : k === 'pendiente'
                ? 'revision'
                : k === 'rechazado'
                  ? 'rechazado'
                  : 'pendiente',
        },
        {
          id: 'antecedentes',
          estado:
            a === 'aprobado'
              ? 'listo'
              : a === 'en_proceso' || a === 'invitado'
                ? 'revision'
                : a === 'revisar'
                  ? 'rechazado'
                  : 'pendiente',
        },
        { id: 'banco', estado: billetera?.cuentaConectada ? 'listo' : 'pendiente' },
      ]);
    })();
    return () => {
      vivo = false;
    };
  }, [api]);
  const nombres = new Map(Object.entries(t.pasos));
  const estados = new Map(Object.entries(t.estado));
  const todo = pasos?.every((p) => p.estado === 'listo');
  return (
    <View style={{ padding: 16, gap: 12 }} testID="alta-guiada">
      <Text style={{ fontSize: 22, fontWeight: '900', color: C.secundario }}>{t.titulo}</Text>
      <Text style={{ color: '#5E5E5E' }}>{todo ? t.completo : t.intro}</Text>
      {(pasos ?? []).map((p, i) => {
        const listo = p.estado === 'listo';
        return (
          <Pressable
            key={p.id}
            onPress={() => abrir(p.id)}
            accessibilityRole="button"
            accessibilityLabel={`${nombres.get(p.id)} · ${estados.get(p.estado)}`}
            style={[e.tarjeta, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: listo ? C.exito : '#E9ECF1',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: listo ? '#fff' : C.secundario, fontWeight: '800' }}>
                {listo ? '✓' : i + 1}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', color: C.secundario }}>{nombres.get(p.id)}</Text>
              <Text
                style={{
                  color: listo ? C.exito : p.estado === 'rechazado' ? C.primario : '#5E5E5E',
                  fontSize: 13,
                  fontWeight: '700',
                }}
              >
                {estados.get(p.estado)}
              </Text>
            </View>
            {!listo ? <Text style={{ color: C.primario, fontWeight: '800' }}>{t.ir} ›</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
