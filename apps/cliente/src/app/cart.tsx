import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  CONFIG_DINERO_INICIAL,
  type ConfigDinero,
  calcularPedido,
  distanciaKm,
  dolaresACentavos,
  enIdioma,
  formatearDolares,
  nombrePlato,
  porcentajeDe,
  useBorrador,
} from '@tumbite/compartido';
import {
  Boton,
  C,
  Campo,
  Pantalla,
  alSalirTelefono,
  almacenTelefono,
  e,
  useSesion,
} from '@tumbite/movil';
import { useCarrito } from '../carrito';
import { TEXTOS } from '../textos';
import { type Punto, miUbicacion } from '../ubicacion';
import { ElegirEnMapa } from '../ElegirEnMapa';
import { PagoTarjeta } from '../PagoTarjeta';
import type { Cobro } from '../pagoTipos';

const PROPINAS = [0, 1500, 2000, 2500]; // puntos básicos: 0 %, 15 %, 20 %, 25 %

type Regalo = { tipo: 'cumpleanos' | 'sellos' | 'vuelve'; valorCentavos: number };
const NOMBRE_REGALO = {
  es: {
    cumpleanos: 'Regalo de cumpleaños',
    sellos: 'Tu tarjeta de sellos está completa',
    vuelve: '¡Qué bueno verte de nuevo!',
  },
  en: {
    cumpleanos: 'Birthday gift',
    sellos: 'Your punch card is complete',
    vuelve: 'Great to see you again!',
  },
};

export default function PantallaCarrito() {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(TEXTOS, idioma);
  const { carrito, cambiarCantidad, vaciar } = useCarrito();
  const [config, setConfig] = useState<ConfigDinero>(CONFIG_DINERO_INICIAL);
  const [punto, setPunto] = useState<Punto | null>(null);
  const [propinaPb, setPropinaPb] = useState<number | 'otra'>(2000);
  const [error, setError] = useState('');
  const [pagando, setPagando] = useState(false);
  const [regalos, setRegalos] = useState<Regalo[]>([]);
  const [regaloElegido, setRegaloElegido] = useState<Regalo['tipo'] | null>(null);
  // El pedido ya creado y esperando la tarjeta. El formulario de pago aparece aquí mismo.
  const [cobroGuardado, setCobro] = useState<(Cobro & { total: number }) | null>(null);
  const b = useBorrador({
    formulario: 'entrega',
    cuenta: usuario?.id,
    inicial: { direccion: '', notas: '', propinaOtra: '' },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });

  // Si la persona escribió su dirección en la portada de tumbite.com, llega por la URL.
  const { direccion: direccionUrl } = useLocalSearchParams<{ direccion?: string }>();
  const { cambiar: cambiarBorrador } = b;
  useEffect(() => {
    if (direccionUrl && !b.valores.direccion) cambiarBorrador('direccion', String(direccionUrl));
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direccionUrl]);

  useEffect(() => {
    api
      .pedir<{ config: ConfigDinero }>('GET', '/datos/config-dinero')
      .then((r) => setConfig(r.config))
      .catch(() => {
        // Si no responde, se muestra con los valores de siempre; el servidor recalcula al pagar.
      });
    void miUbicacion().then(setPunto);
  }, [api]);

  // ¿Le toca algún regalo de este restaurante con este carrito?
  const llaveCarrito = carrito.lineas.map((l) => `${l.platoId}:${l.cantidad}`).join(',');
  useEffect(() => {
    if (!carrito.restauranteId || !llaveCarrito) return;
    api
      .pedir<{ regalos: Regalo[] }>(
        'POST',
        `/datos/restaurantes/${carrito.restauranteId}/mis-regalos`,
        { lineas: carrito.lineas.map((l) => ({ platoId: l.platoId, cantidad: l.cantidad })) },
      )
      .then((r) => {
        setRegalos(r.regalos);
        setRegaloElegido((actual) =>
          r.regalos.some((x) => x.tipo === actual) ? actual : (r.regalos[0]?.tipo ?? null),
        );
      })
      .catch(() => setRegalos([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, carrito.restauranteId, llaveCarrito]);
  const regalo = regalos.find((r) => r.tipo === regaloElegido)?.valorCentavos ?? 0;

  const subtotal = carrito.lineas.reduce((s, l) => s + l.precioCentavos * l.cantidad, 0);
  const propina =
    propinaPb === 'otra'
      ? (dolaresACentavos(b.valores.propinaOtra) ?? 0)
      : porcentajeDe(subtotal, propinaPb);
  const km =
    punto && carrito.restLat != null && carrito.restLng != null
      ? distanciaKm(punto, { lat: carrito.restLat, lng: carrito.restLng })
      : null;
  const d = useMemo(
    () =>
      carrito.lineas.length
        ? calcularPedido({
            lineas: carrito.lineas,
            plan: carrito.plan,
            propina,
            distanciaKm: km,
            config,
            regalo,
          })
        : null,
    [carrito, propina, km, config, regalo],
  );

  async function pagar() {
    if (!d || !carrito.restauranteId) return;
    setError('');
    setPagando(true);
    try {
      const r = await api.pedir<Cobro>('POST', '/datos/pedidos', {
        restauranteId: carrito.restauranteId,
        lineas: carrito.lineas.map((l) => ({ platoId: l.platoId, cantidad: l.cantidad })),
        propinaCentavos: propina,
        direccion: b.valores.direccion,
        notas: b.valores.notas,
        lat: punto?.lat ?? null,
        lng: punto?.lng ?? null,
        regalo: regalo > 0 ? regaloElegido : null,
      });
      // La tarjeta se pide aquí mismo, sin salir de la app.
      if (!r.clavePublica) throw new Error(t.pagoNoDisponible);
      setCobro({ ...r, total: d.totalCliente });
    } catch (x) {
      setError(x instanceof Error ? x.message : String(x));
    } finally {
      setPagando(false);
    }
  }

  // Si el total cambió después de crear el cobro, ese cobro ya no sirve: se crea otro.
  const cobro = cobroGuardado && d && cobroGuardado.total === d.totalCliente ? cobroGuardado : null;

  if (!d) {
    return (
      <Pantalla titulo={t.carrito}>
        <Text style={e.enlace} onPress={() => router.back()}>
          {t.volver}
        </Text>
        <Text style={e.tarjeta}>{t.vacio}</Text>
      </Pantalla>
    );
  }

  const fila = (texto: string, monto: number, fuerte = false) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 3 }}>
      <Text style={fuerte ? { fontWeight: '800', fontSize: 17 } : undefined}>{texto}</Text>
      <Text style={fuerte ? { fontWeight: '800', fontSize: 17 } : undefined}>
        {formatearDolares(monto, idioma)}
      </Text>
    </View>
  );

  return (
    <Pantalla titulo={t.carrito}>
      <Text style={e.enlace} onPress={() => router.back()} accessibilityRole="button">
        {t.volver}
      </Text>
      <Text style={{ fontWeight: '800', fontSize: 18, color: C.secundario, marginBottom: 8 }}>
        {carrito.restauranteNombre}
      </Text>
      {carrito.lineas.map((l) => (
        <View
          key={l.platoId}
          style={[e.tarjeta, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700' }}>{nombrePlato(l, idioma)}</Text>
            <Text>{formatearDolares(l.precioCentavos * l.cantidad, idioma)}</Text>
          </View>
          <Pressable
            onPress={() => cambiarCantidad(l.platoId, l.cantidad - 1)}
            accessibilityRole="button"
            accessibilityLabel={t.menos}
            style={{ padding: 8 }}
          >
            <Text style={{ fontSize: 22 }}>−</Text>
          </Pressable>
          <Text style={{ fontWeight: '700', minWidth: 20, textAlign: 'center' }}>{l.cantidad}</Text>
          <Pressable
            onPress={() => cambiarCantidad(l.platoId, Math.min(99, l.cantidad + 1))}
            accessibilityRole="button"
            accessibilityLabel={t.mas}
            style={{ padding: 8 }}
          >
            <Text style={{ fontSize: 22 }}>+</Text>
          </Pressable>
        </View>
      ))}

      <ElegirEnMapa
        punto={punto}
        cambiarPunto={setPunto}
        cambiarDireccion={(x) => b.cambiar('direccion', x)}
        textos={{ ayuda: t.mapaAyuda, buscando: t.mapaBuscando, pin: t.mapaPin }}
      />
      <Campo
        etiqueta={t.direccion}
        value={b.valores.direccion}
        onChangeText={(x) => b.cambiar('direccion', x)}
        placeholder={t.direccionAyuda}
        autoComplete="street-address"
      />
      <Campo
        etiqueta={t.notas}
        value={b.valores.notas}
        onChangeText={(x) => b.cambiar('notas', x)}
        placeholder={t.notas}
      />

      <Text style={{ fontWeight: '700', marginBottom: 6 }}>{t.propina}</Text>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        {[...PROPINAS, 'otra' as const].map((pb) => (
          <Pressable
            key={String(pb)}
            onPress={() => setPropinaPb(pb)}
            accessibilityRole="button"
            accessibilityLabel={`${t.propina}: ${pb === 'otra' ? t.otra : `${pb / 100}%`}`}
            accessibilityState={{ selected: propinaPb === pb }}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: propinaPb === pb ? C.primario : '#D6D6D6',
              backgroundColor: propinaPb === pb ? C.primario : '#fff',
            }}
          >
            <Text style={{ color: propinaPb === pb ? '#fff' : C.texto, fontWeight: '700' }}>
              {pb === 'otra' ? t.otra : `${pb / 100}%`}
            </Text>
          </Pressable>
        ))}
      </View>
      {propinaPb === 'otra' && (
        <Campo
          etiqueta={t.propina}
          value={b.valores.propinaOtra}
          onChangeText={(x) => b.cambiar('propinaOtra', x)}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
      )}
      <Text style={{ color: '#5E5E5E', marginBottom: 12 }}>{t.propinaNota}</Text>

      {regalos.map((r) => (
        <Pressable
          key={r.tipo}
          onPress={() => setRegaloElegido(regaloElegido === r.tipo ? null : r.tipo)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: regaloElegido === r.tipo }}
          style={[
            e.tarjeta,
            {
              borderWidth: 2,
              // Regalo aplicado = salió bien: verde (C-VERDE-EXITO).
              borderColor: regaloElegido === r.tipo ? C.exito : '#2a2a2a',
              backgroundColor: regaloElegido === r.tipo ? '#E8F5EC' : '#fff',
            },
          ]}
        >
          <Text style={{ fontWeight: '800' }}>{enIdioma(NOMBRE_REGALO, idioma)[r.tipo]}</Text>
          <Text
            style={{ color: regaloElegido === r.tipo ? C.exito : undefined, fontWeight: '700' }}
          >
            −{formatearDolares(r.valorCentavos, idioma)} {regaloElegido === r.tipo ? '✓' : ''}
          </Text>
        </Pressable>
      ))}
      <View style={e.tarjeta}>
        {fila(t.subtotal, d.subtotal)}
        {regalo > 0 && fila(idioma === 'en' ? 'Gift' : 'Regalo', -regalo)}
        {fila(t.envio, d.envio)}
        {fila(t.servicio, d.servicio)}
        {d.cargoPedidoPequeno > 0 && fila(t.pequeno, d.cargoPedidoPequeno)}
        {fila(t.propina, d.propina)}
        <View style={{ borderTopWidth: 1, borderTopColor: '#eee', marginTop: 6, paddingTop: 6 }}>
          {fila(t.total, d.totalCliente, true)}
        </View>
      </View>
      {error ? (
        <Text style={[e.error, { marginBottom: 8 }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {cobro?.clavePublica ? (
        <>
          <Text style={{ fontWeight: '800', fontSize: 17, marginBottom: 8 }}>{t.tarjeta}</Text>
          <PagoTarjeta
            cobro={cobro}
            clavePublica={cobro.clavePublica}
            idioma={idioma}
            textos={{
              pagar: `${t.pagar} ${formatearDolares(d.totalCliente, idioma)}`,
              cargando: t.cargandoTarjeta,
              sinFormulario: t.pagoNoDisponible,
              reintentar: t.reintentarPago,
            }}
            alPagar={() => {
              void b.limpiar();
              vaciar();
              router.replace(`/order/${cobro.pedidoId}`);
            }}
          />
        </>
      ) : (
        <Boton
          texto={`${t.continuarPago} · ${formatearDolares(d.totalCliente, idioma)}`}
          alTocar={() => void pagar()}
          cargando={pagando}
        />
      )}
    </Pantalla>
  );
}
