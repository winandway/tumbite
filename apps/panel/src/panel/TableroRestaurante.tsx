import { useEffect, useState } from 'react';
import { ErrorApi, type Idioma, enIdioma, formatearMonto } from '@tumbite/compartido';
import { pedir } from './api';
import { PlanillaPedidos } from './PlanillaPedidos';
import {
  Dona,
  EncabezadoPagina,
  EstadoVacio,
  GraficaBarras,
  Metricas,
  Tarjeta,
  TarjetaAvance,
  TarjetaMetrica,
} from './armazon/Piezas';

const T = {
  es: {
    hola: 'Hola',
    detalle: 'Así va tu restaurante en Divoox.',
    sinDatos: 'Aparece con tus primeros pedidos entregados.',
    sinCocina: 'Todavía no hay pedidos para medirlo.',
    ahora: 'Pedidos esperando ahora',
    verPedidos: 'Ver pedidos',
    semana: 'Últimos 7 días',
    mes: 'Últimos 30 días',
    pedidos: 'Pedidos',
    ventas: 'Ventas',
    neto: 'Lo que recibes',
    ticket: 'Ticket promedio',
    top: 'Lo que más se vende (30 días)',
    sinTop: 'Cuando entreguemos tus primeros pedidos, aquí verás tus platos estrella.',
    cocina: 'Tiempo real de cocina',
    prometido: 'prometido',
    min: 'min',
    calificacion: 'Calificación de tus clientes',
    sinCalificacion: 'Todavía no hay calificaciones.',
    opiniones: 'opiniones',
    opinion: 'opinión',
  },
  en: {
    hola: 'Hi',
    detalle: 'How your restaurant is doing on Divoox.',
    sinDatos: 'It shows up with your first delivered orders.',
    sinCocina: 'No orders to measure yet.',
    ahora: 'Orders waiting now',
    verPedidos: 'See orders',
    semana: 'Last 7 days',
    mes: 'Last 30 days',
    pedidos: 'Orders',
    ventas: 'Sales',
    neto: 'What you receive',
    ticket: 'Average order',
    top: 'Best sellers (30 days)',
    sinTop: 'Once we deliver your first orders, your star dishes will show up here.',
    cocina: 'Real kitchen time',
    prometido: 'promised',
    min: 'min',
    calificacion: 'Your customers’ rating',
    sinCalificacion: 'No ratings yet.',
    opiniones: 'reviews',
    opinion: 'review',
  },
};

type Periodo = { pedidos: number; ventas: number; neto: number; ticketPromedio: number };
type Tablero = {
  /** C-MONEDA-RECORRIDO: la moneda del restaurante (todas las cifras van en ella). */
  moneda?: string;
  semana: Periodo;
  mes: Periodo;
  topPlatos: { nombreEs: string; nombreEn: string; cantidad: number }[];
  minutosCocina: number | null;
  minutosPrometidos: number | null;
  calificacion: number | null;
  calificaciones: number;
  pedidosAhora: number;
  /** C-RENDIMIENTO-REST (últimos 30 días, hora del restaurante). */
  porHora?: { pedidos: number; ventas: number }[];
  porDia?: { pedidos: number; ventas: number }[];
  clientes?: { nuevos: number; recurrentes: number; nuevosQueVolvieron: number };
  canceladosMes?: number;
  /** C-PRECISION-PEDIDOS: quejas de plato faltante, equivocado o dañado y lo devuelto (30 días). */
  pedidosConProblemasMes?: number;
  precisionPct?: number | null;
  reembolsosMes?: { cantidad: number; monto: number };
};

const TR = {
  es: {
    porHora: 'Pedidos por hora (últimos 30 días)',
    porDia: 'Pedidos por día (últimos 30 días)',
    dias: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    clientes: 'Clientes (últimos 30 días)',
    nuevos: 'Nuevos',
    repiten: 'Repiten',
    cancelados: 'Cancelados',
    precision: 'Pedidos sin problemas',
    conProblemas: 'Con problemas',
    reembolsos: 'Reembolsado',
  },
  en: {
    porHora: 'Orders by hour (last 30 days)',
    porDia: 'Orders by day (last 30 days)',
    dias: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    clientes: 'Customers (last 30 days)',
    nuevos: 'New',
    repiten: 'Returning',
    cancelados: 'Canceled',
    precision: 'Orders without issues',
    conProblemas: 'With issues',
    reembolsos: 'Refunded',
  },
};

/** Inicio del panel del restaurante: cómo le va, de un vistazo (C-TABLERO-REST, C-PANEL-ARMAZON). */
export function TableroRestaurante({ nombre, idioma }: { nombre: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const tr = enIdioma(TR, idioma);
  const [x, setX] = useState<Tablero | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    pedir<{ tablero: Tablero }>('GET', '/datos/restaurante/tablero')
      .then((r) => setX(r.tablero))
      .catch((e: unknown) => setError(e instanceof ErrorApi ? e.message : String(e)));
  }, []);
  const d = (c: number) => formatearMonto(c, x?.moneda ?? 'USD', idioma);
  const periodo = (titulo: string, p: Periodo) => (
    <>
      <h2>{titulo}</h2>
      <Metricas>
        <TarjetaMetrica icono="orders" etiqueta={t.pedidos} valor={p.pedidos} />
        <TarjetaMetrica icono="reports" etiqueta={t.ventas} valor={d(p.ventas)} />
        <TarjetaMetrica icono="earnings" tono="exito" etiqueta={t.neto} valor={d(p.neto)} />
        <TarjetaMetrica icono="promotions" etiqueta={t.ticket} valor={d(p.ticketPromedio)} />
      </Metricas>
    </>
  );
  const horas = (() => {
    const con = (x?.porHora ?? []).map((h, i) => (h.pedidos ? i : -1)).filter((i) => i >= 0);
    if (!x?.porHora || con.length === 0) return [];
    const desde = Math.min(...con);
    return x.porHora
      .slice(desde, Math.max(...con) + 1)
      .map((h, i) => ({ etiqueta: String(desde + i), valor: h.pedidos }));
  })();
  const maxTop = Math.max(1, ...(x?.topPlatos ?? []).map((p) => p.cantidad));
  return (
    <section className="super tablero">
      <EncabezadoPagina titulo={`${t.hola}, ${nombre}`} detalle={t.detalle} />
      {error && (
        <p className="error-general" role="alert">
          {error}
        </p>
      )}
      {x && (
        <>
          <Metricas>
            <TarjetaMetrica
              icono="orders"
              tono={x.pedidosAhora > 0 ? 'marca' : 'suave'}
              etiqueta={t.ahora}
              valor={x.pedidosAhora}
              detalle={t.verPedidos}
              a="/panel/orders"
            />
          </Metricas>
          {periodo(t.semana, x.semana)}
          {periodo(t.mes, x.mes)}
          <div className="pd-rejilla">
            <Tarjeta titulo={tr.porHora} className="pd-ancho-7">
              <GraficaBarras titulo={tr.porHora} vacio={t.sinDatos} datos={horas} />
            </Tarjeta>
            <Tarjeta titulo={tr.porDia} className="pd-ancho-5">
              <GraficaBarras
                titulo={tr.porDia}
                vacio={t.sinDatos}
                datos={(x.porDia ?? []).map((dia, i) => ({
                  etiqueta: tr.dias.at(i) ?? String(i),
                  valor: dia.pedidos,
                }))}
              />
            </Tarjeta>
          </div>
          <div className="pd-rejilla">
            <Tarjeta titulo={t.top} className="pd-ancho-5">
              {x.topPlatos.length === 0 ? (
                <EstadoVacio titulo={t.sinTop} />
              ) : (
                x.topPlatos.map((p) => (
                  <TarjetaAvance
                    key={p.nombreEs}
                    titulo={idioma === 'en' && p.nombreEn ? p.nombreEn : p.nombreEs}
                    detalle={`× ${p.cantidad}`}
                    porcentaje={(p.cantidad / maxTop) * 100}
                    tono="neutro"
                    sinPorcentaje
                  />
                ))
              )}
            </Tarjeta>
            <Tarjeta titulo={tr.clientes} className="pd-ancho-4">
              <Dona
                titulo={tr.clientes}
                vacio={t.sinDatos}
                partes={[
                  {
                    etiqueta: tr.repiten,
                    valor: (x.clientes?.recurrentes ?? 0) + (x.clientes?.nuevosQueVolvieron ?? 0),
                    tono: 'exito',
                  },
                  { etiqueta: tr.nuevos, valor: x.clientes?.nuevos ?? 0, tono: 'neutro' },
                ]}
              />
            </Tarjeta>
            <Tarjeta titulo={t.cocina} className="pd-ancho-3">
              <p className="tablero-grande">
                {x.minutosCocina == null ? (
                  <small>{t.sinCocina}</small>
                ) : (
                  `${x.minutosCocina} ${t.min}`
                )}
                {x.minutosCocina != null && x.minutosPrometidos != null && (
                  <small>
                    {' '}
                    ({t.prometido}: {x.minutosPrometidos} {t.min})
                  </small>
                )}
              </p>
              <h2>{t.calificacion}</h2>
              <p className="tablero-grande">
                {x.calificacion == null ? (
                  <small>{t.sinCalificacion}</small>
                ) : (
                  <>
                    {x.calificacion} / 5{' '}
                    <small>
                      ({x.calificaciones} {x.calificaciones === 1 ? t.opinion : t.opiniones})
                    </small>
                  </>
                )}
              </p>
            </Tarjeta>
          </div>
          {x.clientes ? (
            <>
              <Metricas>
                <TarjetaMetrica
                  icono="incidents"
                  tono={(x.canceladosMes ?? 0) > 0 ? 'problema' : 'suave'}
                  etiqueta={tr.cancelados}
                  valor={x.canceladosMes ?? 0}
                />
                <TarjetaMetrica
                  icono="complaints"
                  tono={(x.pedidosConProblemasMes ?? 0) > 0 ? 'problema' : 'suave'}
                  etiqueta={tr.conProblemas}
                  valor={x.pedidosConProblemasMes ?? 0}
                />
                <TarjetaMetrica
                  icono="returns"
                  etiqueta={tr.reembolsos}
                  valor={d(x.reembolsosMes?.monto ?? 0)}
                />
              </Metricas>
              {x.precisionPct != null ? (
                <Tarjeta>
                  <TarjetaAvance titulo={tr.precision} porcentaje={x.precisionPct} />
                </Tarjeta>
              ) : null}
            </>
          ) : null}
          <PlanillaPedidos idioma={idioma} />
        </>
      )}
    </section>
  );
}
