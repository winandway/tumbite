import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  ErrorApi,
  type TipoPromocion,
  TIPOS_PROMOCION,
  enIdioma,
  formatearMonto,
  insigniaPromocion,
  textoAMonto,
  useBorrador,
  diaDeHoyLocal,
} from '@tumbite/compartido';
import { C, Campo, alSalirTelefono, almacenTelefono, e, useSesion } from '@tumbite/movil';
import { BotonGrande, Tarjeta } from './piezas/ui';

/**
 * C-PROMO-RESTAURANTE (BRE-5, como «Promotions» de DoorDash Merchant): el restaurante arma su
 * promoción desde el celular y la paga él. Lo escrito se guarda solo (borrador).
 */
const T = {
  es: {
    titulo: 'Promociones',
    ayuda:
      'Tu promoción sale con su insignia y se aplica sola en los pedidos con tarjeta. La pagas tú: el descuento se resta de lo que te toca de cada pedido.',
    pronto: 'Las promociones llegan muy pronto.',
    tipos: {
      porcentaje: '% de descuento',
      envio_gratis: 'Envío gratis',
      gasta_ahorra: 'Gasta y ahorra',
    } as Record<TipoPromocion, string>,
    porcentaje: 'Descuento (%)',
    tope: 'Descuento máximo por pedido (opcional)',
    ahorro: 'Lo que ahorra el cliente',
    minimo: 'Pedido mínimo (opcional)',
    minimoGasta: 'Lo que tiene que gastar',
    usos: 'Máximo de pedidos (opcional)',
    inicia: 'Empieza (AAAA-MM-DD)',
    vence: 'Termina (AAAA-MM-DD)',
    crear: 'Crear promoción',
    creada: 'Promoción creada.',
    terminar: 'Terminar',
    activa: 'Activa',
    sinEfecto: 'Sin efecto',
    costo: (n: number, c: string) => `${n} pedidos · te costó ${c}`,
    volver: 'Volver',
  },
  en: {
    titulo: 'Promotions',
    ayuda:
      'Your promotion shows with its badge and applies automatically to card orders. You fund it: the discount comes out of what you earn on each order.',
    pronto: 'Promotions are coming very soon.',
    tipos: {
      porcentaje: '% off',
      envio_gratis: 'Free delivery',
      gasta_ahorra: 'Spend and save',
    } as Record<TipoPromocion, string>,
    porcentaje: 'Discount (%)',
    tope: 'Maximum discount per order (optional)',
    ahorro: 'What the customer saves',
    minimo: 'Minimum order (optional)',
    minimoGasta: 'What they need to spend',
    usos: 'Maximum orders (optional)',
    inicia: 'Starts (YYYY-MM-DD)',
    vence: 'Ends (YYYY-MM-DD)',
    crear: 'Create promotion',
    creada: 'Promotion created.',
    terminar: 'End',
    activa: 'Active',
    sinEfecto: 'Not running',
    costo: (n: number, c: string) => `${n} orders · cost to you ${c}`,
    volver: 'Back',
  },
};

type Promo = {
  id: string;
  tipo: TipoPromocion;
  valor: number;
  minimoSubtotal: number;
  topeCentavos: number;
  iniciaEn: string;
  venceEn: string;
  vigente: boolean;
  usos: number;
  costoCentavos: number;
};
type Resumen = { disponible: boolean; moneda: string; promociones: Promo[] };

// BRF-2: el día en la hora de quien lo ve, no el de Londres.
const dia = (ms: number) => diaDeHoyLocal(ms);
const hoy = () => dia(Date.now());
const enUnMes = () => dia(Date.now() + 30 * 86_400_000);
const nombreTipo = (t: Record<TipoPromocion, string>, k: TipoPromocion) =>
  k === 'porcentaje' ? t.porcentaje : k === 'envio_gratis' ? t.envio_gratis : t.gasta_ahorra;

export function Promociones({ alVolver }: { alVolver: () => void }) {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(T, idioma);
  const [datos, setDatos] = useState<Resumen | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const b = useBorrador({
    formulario: 'app-promocion',
    cuenta: usuario?.id,
    inicial: {
      tipo: 'porcentaje' as TipoPromocion,
      porcentaje: '',
      monto: '',
      minimo: '',
      tope: '',
      usos: '',
      inicia: hoy(),
      vence: enUnMes(),
    },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const cargar = useCallback(() => {
    api
      .pedir<Resumen>('GET', '/datos/mi-restaurante/promociones')
      .then(setDatos)
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [api]);
  useEffect(cargar, [cargar]);
  const moneda = datos?.moneda ?? 'USD';
  const v = b.valores;
  const monto = (s: string) => (s.trim() ? textoAMonto(s, moneda) : 0);

  async function crear() {
    setError('');
    setAviso('');
    try {
      const r = await api.pedir<{ promociones: Promo[] }>(
        'POST',
        '/datos/mi-restaurante/promociones',
        {
          tipo: v.tipo,
          valor:
            v.tipo === 'porcentaje'
              ? Math.round(Number(v.porcentaje || 0) * 100)
              : v.tipo === 'gasta_ahorra'
                ? monto(v.monto)
                : 0,
          minimoSubtotal: monto(v.minimo),
          topeCentavos: v.tipo === 'porcentaje' ? monto(v.tope) : 0,
          usosMax: v.usos.trim() ? Math.round(Number(v.usos)) : null,
          iniciaEn: v.inicia,
          venceEn: v.vence,
        },
      );
      await b.limpiar();
      setDatos((x) => (x ? { ...x, promociones: r.promociones } : x));
      setAviso(t.creada);
    } catch (x) {
      // Lo escrito se queda en pantalla si falla (regla de formularios).
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function terminar(id: string) {
    setError('');
    try {
      const r = await api.pedir<{ promociones: Promo[] }>(
        'PATCH',
        `/datos/mi-restaurante/promociones/${id}`,
        { activa: false },
      );
      setDatos((x) => (x ? { ...x, promociones: r.promociones } : x));
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  return (
    <View testID="app-promociones">
      <Text
        accessibilityRole="header"
        style={{ fontSize: 22, fontWeight: '800', color: C.secundario, marginBottom: 6 }}
      >
        {t.titulo}
      </Text>
      <Text style={{ color: '#5E5E5E', marginBottom: 10 }}>{t.ayuda}</Text>
      {error ? (
        <Text style={e.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {aviso ? <Text style={{ color: C.exito, fontWeight: '700' }}>{aviso}</Text> : null}
      {datos && !datos.disponible ? <Text>{t.pronto}</Text> : null}
      {datos?.disponible ? (
        <>
          <Tarjeta>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {TIPOS_PROMOCION.map((k) => (
                <Pressable
                  key={k}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: v.tipo === k }}
                  onPress={() => b.cambiar('tipo', k)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: v.tipo === k ? C.primario : '#D0D0D0',
                    backgroundColor: v.tipo === k ? '#FFF4F1' : '#fff',
                  }}
                >
                  <Text style={{ color: C.secundario, fontWeight: '700' }}>
                    {nombreTipo(t.tipos, k)}
                  </Text>
                </Pressable>
              ))}
            </View>
            {v.tipo === 'porcentaje' ? (
              <>
                <Campo
                  etiqueta={t.porcentaje}
                  value={v.porcentaje}
                  keyboardType="number-pad"
                  onChangeText={(x) => b.cambiar('porcentaje', x.replace(/\D/g, ''))}
                />
                <Campo
                  etiqueta={t.tope}
                  value={v.tope}
                  keyboardType="decimal-pad"
                  onChangeText={(x) => b.cambiar('tope', x)}
                />
              </>
            ) : null}
            {v.tipo === 'gasta_ahorra' ? (
              <Campo
                etiqueta={t.ahorro}
                value={v.monto}
                keyboardType="decimal-pad"
                onChangeText={(x) => b.cambiar('monto', x)}
              />
            ) : null}
            <Campo
              etiqueta={v.tipo === 'gasta_ahorra' ? t.minimoGasta : t.minimo}
              value={v.minimo}
              keyboardType="decimal-pad"
              onChangeText={(x) => b.cambiar('minimo', x)}
            />
            <Campo
              etiqueta={t.usos}
              value={v.usos}
              keyboardType="number-pad"
              onChangeText={(x) => b.cambiar('usos', x.replace(/\D/g, ''))}
            />
            <Campo
              etiqueta={t.inicia}
              value={v.inicia}
              onChangeText={(x) => b.cambiar('inicia', x)}
            />
            <Campo etiqueta={t.vence} value={v.vence} onChangeText={(x) => b.cambiar('vence', x)} />
            <BotonGrande texto={t.crear} alTocar={() => void crear()} />
          </Tarjeta>
          {datos.promociones.map((p) => (
            <Tarjeta key={p.id}>
              <Text style={{ fontWeight: '800', color: C.secundario }}>
                {insigniaPromocion(p, moneda, idioma)}
              </Text>
              <Text style={{ color: p.vigente ? C.exito : '#5E5E5E', fontWeight: '700' }}>
                {p.vigente ? t.activa : t.sinEfecto} · {p.iniciaEn.slice(0, 10)} →{' '}
                {p.venceEn.slice(0, 10)}
              </Text>
              <Text style={{ color: '#5E5E5E' }}>
                {t.costo(p.usos, formatearMonto(p.costoCentavos, moneda, idioma))}
              </Text>
              {p.vigente ? (
                <BotonGrande texto={t.terminar} tipo="claro" alTocar={() => void terminar(p.id)} />
              ) : null}
            </Tarjeta>
          ))}
        </>
      ) : null}
      <BotonGrande texto={t.volver} tipo="claro" alTocar={alVolver} />
    </View>
  );
}
