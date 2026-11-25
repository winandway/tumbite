import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { type Api, type Idioma, formatearMonto, marcarCampanaVista } from '@tumbite/compartido';
import { DK, Icono, type NombreIcono, Text } from '@tumbite/movil';
import { textosGrandes } from './textos';

export type AvisoRep = {
  tipo: string;
  pedidoId: string | null;
  codigo: string | null;
  restaurante: string | null;
  detalle: string;
  centavos: number | null;
  /** C-MONEDA-RECORRIDO: la moneda del pedido de esa propina. */
  moneda?: string;
  en: string;
  /** C-CAMPANA-SE-VACIA: si ya lo vio (los servidores viejos no lo traen). */
  leido?: boolean;
};
export type RespuestaAvisosRep = { avisos: AvisoRep[]; pendientes: number; sinLeer?: number };

/**
 * La campana del repartidor: avisos reales de los últimos siete días, calculados al momento.
 * C-CAMPANA-SE-VACIA (23 nov 2026): abrirla deja el punto en cero y lo guarda en el servidor por
 * cuenta (una escritura como mucho). Lo nuevo lleva su punto rojo; lo leído queda apagado.
 */
export function Avisos({ api, idioma }: { api: Api; idioma: Idioma }) {
  const t = textosGrandes(idioma).avisos;
  const [d, setD] = useState<RespuestaAvisosRep | null>(null);
  useEffect(() => {
    let vivo = true;
    void api
      .pedir<RespuestaAvisosRep>('GET', '/datos/repartidor/avisos')
      .then((r) => {
        if (!vivo) return;
        setD(r);
        // El gesto de abrir la campana: «visto hasta» el aviso más nuevo (nada si no había nada nuevo).
        void marcarCampanaVista(api, 'repartidor', r.avisos);
      })
      .catch((x: unknown) => console.warn('avisos', x));
    return () => {
      vivo = false;
    };
  }, [api]);
  const titulos = new Map<string, string>(Object.entries(t));
  const avisos = d?.avisos ?? [];
  const nuevos = avisos.filter((a) => a.leido === false);
  const anteriores = avisos.filter((a) => a.leido !== false);
  const fila = (a: AvisoRep, i: number) => {
    const nuevo = a.leido === false;
    const icono = ICONOS.get(a.tipo) ?? { nombre: 'notifications-outline' as NombreIcono };
    return (
      <View
        key={`${a.tipo}-${a.pedidoId ?? i}-${a.en}`}
        testID={nuevo ? 'aviso-fila-nuevo' : 'aviso-fila'}
        style={{
          flexDirection: 'row',
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: DK.borde,
          backgroundColor: nuevo ? DK.blanco : DK.fondo,
        }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor:
              icono.tono === 'verde'
                ? DK.verdeSuave
                : icono.tono === 'ambar'
                  ? DK.ambarSuave
                  : '#ECEEF1',
          }}
        >
          <Icono
            nombre={icono.nombre}
            tamano={20}
            color={icono.tono === 'verde' ? DK.verde : icono.tono === 'ambar' ? DK.ambar : DK.negro}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{ fontWeight: nuevo ? '700' : '600', fontSize: 14.5, color: DK.negro }}
            testID={nuevo ? 'aviso-nuevo' : undefined}
          >
            {titulos.get(a.tipo) ?? a.tipo}
            {a.codigo ? ` · #${a.codigo}` : ''}
          </Text>
          <Text style={{ color: DK.gris, fontSize: 13, lineHeight: 18, marginTop: 3 }}>
            {a.restaurante ?? ''}
            {a.tipo === 'direccion_cambiada' && a.detalle ? ` · ${a.detalle}` : ''}
            {a.tipo === 'ofertas_vencidas' ? ` ${a.detalle}` : ''}
            {a.centavos != null ? ` · +${formatearMonto(a.centavos, a.moneda, idioma)}` : ''}
            {a.tipo === 'cancelado_por_restaurante' || a.tipo === 'cancelado_por_cliente'
              ? ` · ${t.quedasLibre}`
              : ''}
          </Text>
          <Text style={{ color: DK.gris2, fontSize: 12, marginTop: 4 }}>
            {new Date(`${a.en.replace(' ', 'T')}Z`).toLocaleString(
              idioma === 'en' ? 'en-US' : 'es-US',
              { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
            )}
          </Text>
        </View>
        {nuevo ? (
          <View
            style={{
              width: 9,
              height: 9,
              borderRadius: 5,
              backgroundColor: DK.negro,
              marginTop: 6,
            }}
          />
        ) : null}
      </View>
    );
  };
  const separador = (texto: string) => (
    <Text
      style={{
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 6,
        fontSize: 12,
        fontWeight: '700',
        color: DK.gris,
        letterSpacing: 0.5,
      }}
    >
      {texto.toUpperCase()}
    </Text>
  );
  // C-REDISENO-DRIVER: la lista del borrador (círculo con ícono, título, texto, hora y el punto de
  // lo nuevo); lo leído queda en gris, debajo de «Anteriores».
  return (
    <View testID="avisos-repartidor" style={{ paddingBottom: 12 }}>
      {d && avisos.length === 0 ? (
        <Text style={{ color: DK.gris, padding: 16, lineHeight: 21 }}>{t.sin}</Text>
      ) : null}
      {nuevos.length ? separador(idioma === 'en' ? 'New' : 'Nuevos') : null}
      {nuevos.map(fila)}
      {nuevos.length && anteriores.length
        ? separador(idioma === 'en' ? 'Earlier' : 'Anteriores')
        : null}
      {anteriores.map(fila)}
    </View>
  );
}

const ICONOS = new Map<string, { nombre: NombreIcono; tono?: 'verde' | 'ambar' }>([
  ['pedido_listo', { nombre: 'bag-check-outline', tono: 'verde' }],
  ['cancelado_por_restaurante', { nombre: 'close-circle-outline' }],
  ['cancelado_por_cliente', { nombre: 'close-circle-outline' }],
  ['direccion_cambiada', { nombre: 'location-outline', tono: 'ambar' }],
  ['excepcion_autorizada', { nombre: 'checkmark-circle-outline', tono: 'verde' }],
  ['propina_posterior', { nombre: 'cash-outline', tono: 'verde' }],
  ['saldo_recargado', { nombre: 'wallet-outline', tono: 'verde' }],
  ['ofertas_vencidas', { nombre: 'time-outline', tono: 'ambar' }],
  ['foto_control', { nombre: 'camera-outline', tono: 'ambar' }],
]);
