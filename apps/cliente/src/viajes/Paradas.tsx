import { useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  ErrorApi,
  type Referencia,
  enIdioma,
  formatearMonto,
  textoReferencia,
} from '@tumbite/compartido';
import { Boton, C, CampoDireccion, useSesion, Text } from '@tumbite/movil';
import { Tarjeta } from '../comida/piezas';
import { TEXTOS_MOTO } from './textos';

/**
 * C-VIAJE-PARADAS (14 nov 2026, todos los países): paradas intermedias de un viaje, como «Agregar
 * parada» de Uber. Una sola pieza para las dos pantallas: al pedir (antes de ver el precio) y con el
 * viaje ya pedido (el servidor dice cuánto cuesta el cambio y solo se aplica al confirmar).
 */
export type ParadaEscrita = { direccion: string; lat: number | null; lng: number | null };

/** Lo que el servidor acepta mientras no diga el máximo de la ciudad. */
export const PARADAS_SIN_SABER = 3;

/** Las paradas del borrador (texto) a lista; lo dañado se descarta. */
export function leerParadasEscritas(json: string): ParadaEscrita[] {
  try {
    const v: unknown = JSON.parse(json || '[]');
    if (!Array.isArray(v)) return [];
    return v.flatMap((p) => {
      const o = p as Partial<ParadaEscrita> | null;
      return o && typeof o.direccion === 'string'
        ? [
            {
              direccion: o.direccion,
              lat: typeof o.lat === 'number' ? o.lat : null,
              lng: typeof o.lng === 'number' ? o.lng : null,
            },
          ]
        : [];
    });
  } catch {
    return [];
  }
}

/** Las paradas listas para mandar (null si alguna no tiene su punto elegido). */
export function paradasListas(paradas: readonly ParadaEscrita[]) {
  const listas = paradas.flatMap((p) =>
    p.lat != null && p.lng != null && p.direccion.trim().length >= 3
      ? [{ lat: p.lat, lng: p.lng, direccion: p.direccion.trim() }]
      : [],
  );
  return listas.length === paradas.length ? listas : null;
}

export function EditorParadas({
  paradas,
  cambiar,
  maximo,
  cerca,
  prefijo = 'parada',
}: {
  paradas: readonly ParadaEscrita[];
  cambiar: (nuevas: ParadaEscrita[]) => void;
  maximo: number;
  cerca: { lat: number; lng: number } | null;
  prefijo?: string;
}) {
  const { idioma } = useSesion();
  const t = enIdioma(TEXTOS_MOTO, idioma);
  const poner = (i: number, cambio: Partial<ParadaEscrita>) =>
    cambiar(paradas.map((p, j) => (j === i ? { ...p, ...cambio } : p)));
  return (
    <View style={{ gap: 8 }} testID={`${prefijo}-editor`}>
      {paradas.map((p, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <CampoDireccion
              etiqueta={t.parada(i + 1)}
              placeholder={t.paradaAyuda}
              valor={p.direccion}
              // Al escribir de nuevo, el punto anterior ya no vale: hay que elegir una sugerencia.
              cambiar={(x) => poner(i, { direccion: x, lat: null, lng: null })}
              alElegir={(d) =>
                poner(i, {
                  direccion: d.direccion || p.direccion,
                  lat: d.punto.lat,
                  lng: d.punto.lng,
                })
              }
              cerca={cerca}
              testID={`${prefijo}-${i + 1}`}
            />
          </View>
          <Pressable
            onPress={() => cambiar(paradas.filter((_, j) => j !== i))}
            accessibilityRole="button"
            accessibilityLabel={`${t.quitarParada} ${i + 1}`}
            testID={`${prefijo}-quitar-${i + 1}`}
            hitSlop={8}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: '#C9CDD3',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 4,
            }}
          >
            <Text style={{ fontSize: 20, color: C.secundario, fontWeight: '700' }}>×</Text>
          </Pressable>
        </View>
      ))}
      {paradas.length < maximo ? (
        <Pressable
          onPress={() => cambiar([...paradas, { direccion: '', lat: null, lng: null }])}
          accessibilityRole="button"
          testID={`${prefijo}-agregar`}
          style={{ paddingVertical: 10, minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={{ color: C.secundario, fontWeight: '700', fontSize: 16 }}>
            + {t.agregarParada}
          </Text>
        </Pressable>
      ) : (
        <Text style={{ color: '#666B73', fontSize: 13 }}>{t.paradasMaximo(maximo)}</Text>
      )}
      {paradas.length ? (
        <Text style={{ color: '#666B73', fontSize: 13 }}>{t.paradasEspera}</Text>
      ) : null}
    </View>
  );
}

export type ParadaDelViaje = {
  orden: number;
  lat: number;
  lng: number;
  direccion: string;
  estado: 'pendiente' | 'en_parada' | 'visitada';
};

type Cambio = {
  totalActual: number;
  totalNuevo: number;
  moneda: string;
  permitido: boolean;
  motivo: string | null;
  aplicado: boolean;
};

/**
 * Las paradas del viaje ya pedido: se ven con su estado y, mientras el viaje no termine, el pasajero
 * puede agregar, cambiar o quitar las que faltan. Primero ve el precio nuevo; después confirma.
 */
export function ParadasDelViaje({
  viajeId,
  paradas,
  maximo,
  puedeCambiar,
  cerca,
  alCambiar,
  sinBoton = false,
  abrirCon = 0,
}: {
  viajeId: string;
  paradas: readonly ParadaDelViaje[];
  maximo: number;
  puedeCambiar: boolean;
  cerca: { lat: number; lng: number } | null;
  alCambiar: () => void;
  /** Fase cero: en la espera, el «+ Agregar parada» es el botón «Parada» de afuera. */
  sinBoton?: boolean;
  /** Cada vez que sube, se abre el editor (lo toca el botón «Parada» de la espera). */
  abrirCon?: number;
}) {
  const { api, idioma } = useSesion();
  const t = enIdioma(TEXTOS_MOTO, idioma);
  const hechas = paradas.filter((p) => p.estado !== 'pendiente');
  const [editando, setEditando] = useState(false);
  const [escritas, setEscritas] = useState<ParadaEscrita[]>([]);
  const [vista, setVista] = useState<{ cambio: Cambio; referencia: Referencia | null } | null>(
    null,
  );
  const [error, setError] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [listo, setListo] = useState(false);

  function abrir() {
    setEscritas(
      paradas
        .filter((p) => p.estado === 'pendiente')
        .map((p) => ({ direccion: p.direccion, lat: p.lat, lng: p.lng })),
    );
    setVista(null);
    setError('');
    setListo(false);
    setEditando(true);
  }

  async function pedir(confirmar: boolean) {
    const listas = paradasListas(escritas);
    if (!listas) return setError(t.faltaParada);
    setError('');
    setTrabajando(true);
    try {
      const r = await api.pedir<{ cambio: Cambio; referencia?: Referencia | null }>(
        'POST',
        `/datos/viajes/${viajeId}/paradas`,
        {
          paradas: listas,
          confirmar,
          ...(confirmar && vista ? { totalVisto: vista.cambio.totalNuevo } : {}),
        },
      );
      if (r.cambio.aplicado) {
        setEditando(false);
        setVista(null);
        setListo(true);
        alCambiar();
      } else {
        setVista({ cambio: r.cambio, referencia: r.referencia ?? null });
      }
    } catch (x) {
      // Si el precio cambió entre medio, se vuelve a pedir la vista con el precio de ahora.
      setVista(null);
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setTrabajando(false);
    }
  }

  // El botón «Parada» de la espera abre el editor desde afuera (una vez por toque).
  const [abiertoCon, setAbiertoCon] = useState(abrirCon);
  if (abrirCon !== abiertoCon) {
    setAbiertoCon(abrirCon);
    if (abrirCon > 0 && puedeCambiar && !editando) abrir();
  }

  if (!paradas.length && !puedeCambiar) return null;
  // Sin paradas, sin editor abierto y con el botón afuera, no hay nada que mostrar.
  if (sinBoton && !paradas.length && !editando && !listo) return null;
  const monto = (m: number, moneda: string) => formatearMonto(m, moneda, idioma);
  return (
    <Tarjeta>
      <View testID="viaje-paradas" style={{ gap: 8 }}>
        {paradas.length ? (
          <Text style={{ fontWeight: '700', color: C.secundario, fontSize: 16 }}>
            {t.paradasTitulo}
          </Text>
        ) : null}
        {paradas.map((p, i) => (
          <View key={p.orden} testID={`viaje-parada-${i + 1}`} style={{ gap: 2 }}>
            <Text style={{ color: C.secundario, fontWeight: '700' }}>
              {t.parada(i + 1)} · {p.direccion}
            </Text>
            <Text
              style={{
                color: p.estado === 'visitada' ? C.exito : '#666B73',
                fontWeight: p.estado === 'pendiente' ? '400' : '700',
              }}
            >
              {t.paradaEstado[p.estado]}
            </Text>
          </View>
        ))}
        {listo ? (
          <Text testID="viaje-paradas-listo" style={{ color: C.exito, fontWeight: '700' }}>
            {t.paradasCambiadas}
          </Text>
        ) : null}
        {puedeCambiar && !editando && !sinBoton ? (
          <Pressable
            onPress={abrir}
            accessibilityRole="button"
            testID="viaje-paradas-cambiar"
            style={{ paddingVertical: 8, minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={{ color: C.secundario, fontWeight: '700', fontSize: 16 }}>
              {paradas.some((p) => p.estado === 'pendiente')
                ? t.cambiarParadas
                : `+ ${t.agregarParada}`}
            </Text>
          </Pressable>
        ) : null}
        {editando ? (
          <View style={{ gap: 8 }}>
            <EditorParadas
              paradas={escritas}
              cambiar={(n) => {
                setEscritas(n);
                setVista(null);
              }}
              maximo={Math.max(0, maximo - hechas.length)}
              cerca={cerca}
              prefijo="viaje-parada-nueva"
            />
            {vista ? (
              <View testID="viaje-paradas-precio" style={{ gap: 2 }}>
                <Text style={{ color: '#666B73', fontWeight: '700' }}>{t.precioNuevo}</Text>
                <Text style={{ fontSize: 28, fontWeight: '700', color: C.secundario }}>
                  {monto(vista.cambio.totalNuevo, vista.cambio.moneda)}
                </Text>
                {vista.referencia ? (
                  <Text style={{ color: '#666B73', fontWeight: '700' }}>
                    {textoReferencia(vista.referencia, idioma)}
                  </Text>
                ) : null}
                <Text style={{ color: '#666B73' }}>
                  {t.precioAntes} {monto(vista.cambio.totalActual, vista.cambio.moneda)}
                </Text>
                {vista.cambio.motivo ? (
                  <Text accessibilityRole="alert" style={{ color: C.primario, fontWeight: '700' }}>
                    {vista.cambio.motivo}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {error ? (
              <Text accessibilityRole="alert" style={{ color: C.primario, fontWeight: '700' }}>
                {error}
              </Text>
            ) : null}
            {vista && vista.cambio.permitido ? (
              <Boton
                texto={t.confirmarParadas}
                alTocar={() => void pedir(true)}
                cargando={trabajando}
                exito
              />
            ) : (
              <Boton
                texto={t.verPrecioNuevo}
                alTocar={() => void pedir(false)}
                cargando={trabajando}
              />
            )}
            <Pressable
              onPress={() => setEditando(false)}
              accessibilityRole="button"
              style={{ paddingVertical: 8, minHeight: 44, justifyContent: 'center' }}
            >
              <Text style={{ color: '#666B73', fontWeight: '700', textAlign: 'center' }}>
                {t.noCambiar}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Tarjeta>
  );
}
