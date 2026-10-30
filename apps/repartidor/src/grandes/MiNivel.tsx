import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { type Api, ErrorApi, type Idioma, enIdioma, useBorrador } from '@tumbite/compartido';
import { AvisoBorrador, Boton, C, Campo, almacenTelefono, e } from '@tumbite/movil';

/**
 * C-REWARDS-MI-NIVEL (30 oct 2026, R2): el puntaje explicado, como «Ratings» de Dasher: cada parte
 * con lo que suma, la experiencia por servicio y el avance al próximo premio.
 */
const T = {
  es: {
    titulo: 'Cómo se forma tu puntaje',
    componentes: {
      finalizacion: ['Entregas completadas', 'Las que terminas de las que aceptas.'],
      puntualidad: ['Puntualidad', 'Las que llegan a tiempo.'],
      calidad: ['Pedidos sin problemas', 'Sin faltantes, daños ni errores tuyos.'],
      satisfaccion: ['Calificación de clientes', 'Tus estrellas de las últimas entregas.'],
      aceptacion: ['Ofertas aceptadas', 'Las ofertas que tomas (las excusadas no cuentan).'],
    },
    experiencia: 'Tu experiencia',
    servicios: {
      comida: 'Comida',
      tiendas: 'Tiendas',
      express: 'Viajes y envíos',
      flexPaquetes: 'Paquetes Flex',
    },
    hito: (a: number, b: number) => `Próximo premio: ${a} de ${b} entregas que cuentan`,
    riesgo: 'Cuidado: tu finalización o tus estrellas están por debajo del mínimo.',
    apelar: '¿Algo no fue tu culpa? Pide revisar una entrega',
    elegir: 'Elige la entrega',
    motivo: 'Qué pasó (mínimo 10 letras)',
    enviar: 'Pedir revisión',
    enviada: 'Listo. Soporte la revisa; si tienes razón, esa entrega deja de contar.',
    mias: 'Tus revisiones',
    estados: { abierta: 'En revisión', aceptada: 'Aceptada', rechazada: 'No aceptada' },
  },
  en: {
    titulo: 'How your score is built',
    componentes: {
      finalizacion: ['Completed deliveries', 'The ones you finish out of those you accept.'],
      puntualidad: ['On time', 'The ones that arrive on time.'],
      calidad: ['Problem-free orders', 'No missing items, damage or mistakes on your side.'],
      satisfaccion: ['Customer rating', 'Your stars from your latest deliveries.'],
      aceptacion: ['Offers accepted', 'The offers you take (excused ones don’t count).'],
    },
    experiencia: 'Your experience',
    servicios: {
      comida: 'Food',
      tiendas: 'Stores',
      express: 'Rides and sends',
      flexPaquetes: 'Flex packages',
    },
    hito: (a: number, b: number) => `Next reward: ${a} of ${b} deliveries that count`,
    riesgo: 'Careful: your completion or your stars are below the minimum.',
    apelar: 'Something wasn’t your fault? Ask us to review a delivery',
    elegir: 'Choose the delivery',
    motivo: 'What happened (at least 10 letters)',
    enviar: 'Ask for a review',
    enviada: 'Done. Support reviews it; if you’re right, that delivery stops counting.',
    mias: 'Your reviews',
    estados: { abierta: 'Under review', aceptada: 'Accepted', rechazada: 'Not accepted' },
  },
};

type Detalle = {
  elegibilidad: string;
  componentes: Record<string, { puntos: number; maximo: number }>;
  experiencia: Record<string, number>;
  hito: { meta: number; contadas: number } | null;
};

export function MiNivel({ api, idioma }: { api: Api; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [d, setD] = useState<Detalle | null>(null);
  useEffect(() => {
    let vivo = true;
    void api
      .pedir<Detalle>('GET', '/datos/repartidor/mi-nivel')
      .then((r) => {
        if (vivo) setD(r);
      })
      .catch((x: unknown) => console.warn('mi nivel', x));
    return () => {
      vivo = false;
    };
  }, [api]);
  const [ap, setAp] = useState<{
    apelaciones: { id: string; unidadId: string; estado: string; motivo: string }[];
    entregas: { id: string; restaurante: string | null; entregadoEn: string }[];
  } | null>(null);
  const [elegida, setElegida] = useState('');
  const [aviso, setAviso] = useState('');
  const b = useBorrador({
    formulario: 'apelacion',
    cuenta: 'repartidor',
    inicial: { motivo: '' },
    almacen: almacenTelefono,
  });
  const cargarAp = useCallback(() => {
    void api
      .pedir<NonNullable<typeof ap>>('GET', '/datos/repartidor/apelaciones')
      .then(setAp)
      .catch((x: unknown) => console.warn('apelaciones', x));
  }, [api]);
  useEffect(cargarAp, [cargarAp]);
  async function enviar() {
    setAviso('');
    try {
      await api.pedir('POST', '/datos/repartidor/apelaciones', {
        unidadTipo: 'pedido',
        unidadId: elegida,
        motivo: b.valores.motivo,
      });
      await b.limpiar();
      setElegida('');
      setAviso(t.enviada);
      cargarAp();
    } catch (x) {
      // Lo escrito se queda para reintentar.
      setAviso(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  if (!d) return null;
  const nombres = new Map(Object.entries(t.componentes));
  const servicios = new Map(Object.entries(t.servicios));
  return (
    <View style={e.tarjeta} testID="mi-nivel">
      <Text style={{ fontWeight: '800', marginBottom: 6 }}>{t.titulo}</Text>
      {d.elegibilidad === 'en_riesgo' ? (
        <Text style={{ color: C.primario, marginBottom: 6 }}>{t.riesgo}</Text>
      ) : null}
      {Object.entries(d.componentes).map(([k, c]) => {
        const [nombre, ayuda] = nombres.get(k) ?? [k, ''];
        return (
          <View key={k} style={{ marginBottom: 8 }}>
            <Text style={{ fontWeight: '600' }}>
              {nombre}: {c.puntos.toFixed(1)} / {c.maximo}
            </Text>
            <Text style={{ color: '#5E5E5E' }}>{ayuda}</Text>
          </View>
        );
      })}
      <Text style={{ fontWeight: '800', marginTop: 4 }}>{t.experiencia}</Text>
      {Object.entries(d.experiencia)
        .filter(([k, n]) => servicios.has(k) && n > 0)
        .map(([k, n]) => (
          <Text key={k}>
            {servicios.get(k)}: {n}
          </Text>
        ))}
      {ap ? (
        <View style={{ marginTop: 12 }} testID="apelaciones">
          <Text style={{ fontWeight: '800' }}>{t.apelar}</Text>
          <AvisoBorrador
            visible={b.recuperado}
            idioma={idioma}
            empezar={() => void b.empezarDeNuevo()}
          />
          <Text style={{ marginTop: 6 }}>{t.elegir}</Text>
          {ap.entregas.map((x) => (
            <Pressable
              key={x.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: elegida === x.id }}
              onPress={() => setElegida(x.id)}
              style={{ paddingVertical: 6 }}
            >
              <Text style={{ fontWeight: elegida === x.id ? '800' : '400' }}>
                {elegida === x.id ? '● ' : '○ '}
                {x.restaurante ?? ''} · {x.entregadoEn.slice(0, 16)}
              </Text>
            </Pressable>
          ))}
          <Campo
            etiqueta={t.motivo}
            value={b.valores.motivo}
            onChangeText={(v) => b.cambiar('motivo', v)}
            multiline
          />
          <Boton texto={t.enviar} alTocar={() => void enviar()} secundario />
          {aviso ? <Text style={{ marginTop: 6 }}>{aviso}</Text> : null}
          {ap.apelaciones.length ? (
            <Text style={{ fontWeight: '800', marginTop: 8 }}>{t.mias}</Text>
          ) : null}
          {ap.apelaciones.map((x) => (
            <Text key={x.id}>
              {new Map(Object.entries(t.estados)).get(x.estado) ?? x.estado} · {x.motivo}
            </Text>
          ))}
        </View>
      ) : null}
      {d.hito ? (
        <Text style={{ marginTop: 8, color: C.exito, fontWeight: '600' }}>
          {t.hito(d.hito.contadas, d.hito.meta)}
        </Text>
      ) : null}
    </View>
  );
}
