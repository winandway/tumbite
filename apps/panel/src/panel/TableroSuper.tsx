import { useEffect, useState } from 'react';
import { fechaSuper } from './horario';
import type { Idioma } from '@tumbite/compartido';
import { pedir } from './api';
import {
  Dona,
  EstadoVacio,
  GraficaBarras,
  ListaActividad,
  Metricas,
  Tarjeta,
  TarjetaAvance,
  TarjetaMetrica,
  type Tono,
} from './armazon/Piezas';

const T = {
  es: {
    semana: 'Pedidos de los últimos 7 días',
    frente: (n: number) =>
      n === 0
        ? 'Igual que la semana anterior'
        : `${n > 0 ? '+' : ''}${n} frente a la semana anterior`,
    tickets: 'Tickets abiertos',
    clientes: 'Clientes',
    restaurantes: 'Restaurantes aprobados',
    porAprobar: (n: number) => `${n} por aprobar`,
    repartidores: 'Repartidores',
    conectados: (n: number) => `${n} conectados ahora`,
    franquicias: 'Franquicias',
    activas: (n: number, v: number) => `${n} activas · ${v} vendidas`,
    interesados: 'Interesados en franquicia',
    motos: 'Motos de las franquicias',
    dinero: 'Dinero de ayer',
    porDia: 'Pedidos por día (últimos 14 días)',
    sinPedidos: 'Todavía no hay pedidos en estos 14 días.',
    viajesDia: 'Viajes por día (últimos 14 días)',
    sinViajes: 'Todavía no hay viajes en estos 14 días.',
    pedidos30: 'Pedidos de los últimos 30 días',
    sinPedidos30: 'Todavía no hay pedidos en estos 30 días.',
    viajes30: 'Viajes de los últimos 30 días',
    sinViajes30: 'Todavía no hay viajes en estos 30 días.',
    entregados: 'Entregados',
    terminados: 'Terminados',
    enCurso: 'En curso',
    cancelados: 'Cancelados',
    ahora: 'Ahora mismo',
    abiertos: 'Restaurantes abiertos',
    deTotal: (a: number, b: number) => `${a} de ${b}`,
    enLinea: 'Repartidores conectados',
    cumplidos: 'Pedidos entregados sin cancelarse (30 días)',
    sinAhora: 'Aparece cuando haya restaurantes, repartidores o pedidos.',
    actividad: 'Últimos tickets',
    verTodos: 'Ver todos',
    sinActividad: 'No hay tickets todavía.',
    estados: { abierto: 'Abierto', respondido: 'Respondido', cerrado: 'Cerrado' } as Record<
      string,
      string
    >,
    sinTablero: 'No se pudieron leer las gráficas. Recarga la página.',
  },
  en: {
    semana: 'Orders in the last 7 days',
    frente: (n: number) =>
      n === 0 ? 'Same as the week before' : `${n > 0 ? '+' : ''}${n} vs. the week before`,
    tickets: 'Open tickets',
    clientes: 'Customers',
    restaurantes: 'Approved restaurants',
    porAprobar: (n: number) => `${n} to approve`,
    repartidores: 'Drivers',
    conectados: (n: number) => `${n} online now`,
    franquicias: 'Franchises',
    activas: (n: number, v: number) => `${n} active · ${v} sold`,
    interesados: 'Franchise leads',
    motos: 'Franchise motorbikes',
    dinero: 'Yesterday’s money',
    porDia: 'Orders per day (last 14 days)',
    sinPedidos: 'No orders in these 14 days yet.',
    viajesDia: 'Rides per day (last 14 days)',
    sinViajes: 'No rides in these 14 days yet.',
    pedidos30: 'Orders in the last 30 days',
    sinPedidos30: 'No orders in these 30 days yet.',
    viajes30: 'Rides in the last 30 days',
    sinViajes30: 'No rides in these 30 days yet.',
    entregados: 'Delivered',
    terminados: 'Completed',
    enCurso: 'In progress',
    cancelados: 'Canceled',
    ahora: 'Right now',
    abiertos: 'Open restaurants',
    deTotal: (a: number, b: number) => `${a} of ${b}`,
    enLinea: 'Drivers online',
    cumplidos: 'Orders delivered without canceling (30 days)',
    sinAhora: 'It shows up once there are restaurants, drivers or orders.',
    actividad: 'Latest tickets',
    verTodos: 'View all',
    sinActividad: 'No tickets yet.',
    estados: { abierto: 'Open', respondido: 'Answered', cerrado: 'Closed' } as Record<
      string,
      string
    >,
    sinTablero: 'We couldn’t load the charts. Reload the page.',
  },
};

type Tablero = {
  porDia: { dia: string; pedidos: number; viajes: number }[];
  pedidos30: { entregados: number; enCurso: number; cancelados: number };
  semana: { pedidos: number; anterior: number };
  viajes30: { terminados: number; enCurso: number; cancelados: number };
  personas: {
    clientes: number;
    restaurantes: number;
    restaurantesAbiertos: number;
    restaurantesPorAprobar: number;
    repartidores: number;
    repartidoresConectados: number;
  };
  actividad: {
    id: string;
    codigo: string;
    tipo: string;
    estado: string;
    asunto: string;
    fecha: string;
  }[];
};

export type TotalesSuper = {
  franquicias: number;
  vendidas: number;
  activas: number;
  interesados: number;
  ticketsAbiertos: number;
  motos: number;
};

const TONO_TICKET: Record<string, Tono> = {
  abierto: 'espera',
  respondido: 'exito',
  cerrado: 'suave',
};

/**
 * C-PANEL-ARMAZON: el tablero del resumen del superadmin. Todo sale del servidor
 * (/datos/admin/resumen y /datos/admin/tablero); si no hay datos, cada pieza lo dice.
 */
export function TableroSuper({
  base,
  idioma,
  totales,
  dinero,
}: {
  base: string;
  idioma: Idioma;
  totales: TotalesSuper;
  /** La tarjeta del dinero de ayer (cuadra o no), que arma el resumen. */
  dinero: { texto: string; tono: Tono; extra?: React.ReactNode };
}) {
  const t = idioma === 'en' ? T.en : T.es;
  const [x, setX] = useState<Tablero | null>(null);
  const [fallo, setFallo] = useState(false);
  useEffect(() => {
    pedir<{ tablero?: Tablero }>('GET', '/datos/admin/tablero')
      .then((r) => (r?.tablero?.porDia ? setX(r.tablero) : setFallo(true)))
      .catch(() => setFallo(true));
  }, []);
  const dia = (iso: string) => String(Number(iso.slice(8, 10)));
  const hora = (fecha: string) => fechaSuper(fecha, idioma, { estilo: 'fecha', vacio: '' });
  const diferencia = x ? x.semana.pedidos - x.semana.anterior : 0;
  const avances = x
    ? [
        {
          titulo: t.abiertos,
          a: x.personas.restaurantesAbiertos,
          b: x.personas.restaurantes,
        },
        { titulo: t.enLinea, a: x.personas.repartidoresConectados, b: x.personas.repartidores },
        {
          titulo: t.cumplidos,
          a: x.pedidos30.entregados,
          b: x.pedidos30.entregados + x.pedidos30.cancelados,
        },
      ].filter((v) => v.b > 0)
    : [];
  return (
    <>
      <Metricas>
        {x ? (
          <TarjetaMetrica
            icono="orders"
            tono="marca"
            etiqueta={t.semana}
            valor={x.semana.pedidos}
            variacion={{
              texto: t.frente(diferencia),
              sentido: diferencia > 0 ? 'sube' : diferencia < 0 ? 'baja' : 'igual',
            }}
            a={`${base}/orders`}
          />
        ) : null}
        <TarjetaMetrica
          icono="tickets"
          tono={totales.ticketsAbiertos > 0 ? 'espera' : 'exito'}
          etiqueta={t.tickets}
          valor={totales.ticketsAbiertos}
          a={`${base}/tickets`}
        />
        {x ? (
          <>
            <TarjetaMetrica
              icono="customers"
              etiqueta={t.clientes}
              valor={x.personas.clientes}
              a={`${base}/customers`}
            />
            <TarjetaMetrica
              icono="restaurants"
              etiqueta={t.restaurantes}
              valor={x.personas.restaurantes}
              detalle={t.porAprobar(x.personas.restaurantesPorAprobar)}
              a={`${base}/restaurants`}
            />
            <TarjetaMetrica
              icono="drivers"
              etiqueta={t.repartidores}
              valor={x.personas.repartidores}
              detalle={t.conectados(x.personas.repartidoresConectados)}
              a={`${base}/drivers`}
            />
          </>
        ) : null}
        <TarjetaMetrica
          icono="franchises"
          etiqueta={t.franquicias}
          valor={totales.franquicias}
          detalle={t.activas(totales.activas, totales.vendidas)}
          a={`${base}/franchises`}
        />
        <TarjetaMetrica
          icono="waitlist"
          etiqueta={t.interesados}
          valor={totales.interesados}
          a={`${base}/tickets?tipo=franquicia`}
        />
        <TarjetaMetrica icono="moto" etiqueta={t.motos} valor={totales.motos} />
        <TarjetaMetrica
          icono="money"
          tono={dinero.tono}
          etiqueta={t.dinero}
          valor={dinero.texto}
          detalle={dinero.extra}
        />
      </Metricas>
      {fallo ? (
        <p className="error-general" role="alert">
          {t.sinTablero}
        </p>
      ) : null}
      {x ? (
        <>
          <div className="pd-rejilla">
            <Tarjeta titulo={t.porDia} className="pd-ancho-8">
              <GraficaBarras
                titulo={t.porDia}
                vacio={t.sinPedidos}
                datos={x.porDia.map((d) => ({ etiqueta: dia(d.dia), valor: d.pedidos }))}
              />
            </Tarjeta>
            <Tarjeta titulo={t.pedidos30} className="pd-ancho-4">
              <Dona
                titulo={t.pedidos30}
                vacio={t.sinPedidos30}
                partes={[
                  { etiqueta: t.entregados, valor: x.pedidos30.entregados, tono: 'exito' },
                  { etiqueta: t.enCurso, valor: x.pedidos30.enCurso, tono: 'neutro' },
                  { etiqueta: t.cancelados, valor: x.pedidos30.cancelados, tono: 'problema' },
                ]}
              />
            </Tarjeta>
          </div>
          <div className="pd-rejilla">
            <Tarjeta titulo={t.viajesDia} className="pd-ancho-8">
              <GraficaBarras
                titulo={t.viajesDia}
                vacio={t.sinViajes}
                tono="suave"
                datos={x.porDia.map((d) => ({ etiqueta: dia(d.dia), valor: d.viajes }))}
              />
            </Tarjeta>
            <Tarjeta titulo={t.viajes30} className="pd-ancho-4">
              <Dona
                titulo={t.viajes30}
                vacio={t.sinViajes30}
                partes={[
                  { etiqueta: t.terminados, valor: x.viajes30.terminados, tono: 'exito' },
                  { etiqueta: t.enCurso, valor: x.viajes30.enCurso, tono: 'neutro' },
                  { etiqueta: t.cancelados, valor: x.viajes30.cancelados, tono: 'problema' },
                ]}
              />
            </Tarjeta>
          </div>
          <div className="pd-rejilla">
            <Tarjeta titulo={t.ahora} className="pd-ancho-5">
              {avances.length === 0 ? (
                <EstadoVacio titulo={t.sinAhora} />
              ) : (
                avances.map((v) => (
                  <TarjetaAvance
                    key={v.titulo}
                    titulo={v.titulo}
                    detalle={t.deTotal(v.a, v.b)}
                    porcentaje={(v.a / v.b) * 100}
                  />
                ))
              )}
            </Tarjeta>
            <Tarjeta
              titulo={t.actividad}
              accion={{ texto: t.verTodos, a: `${base}/tickets` }}
              className="pd-ancho-7"
            >
              <ListaActividad
                vacio={t.sinActividad}
                items={x.actividad.map((a) => ({
                  id: a.id,
                  titulo: a.asunto,
                  detalle: t.estados[a.estado] ?? a.estado,
                  hora: hora(a.fecha),
                  tono: TONO_TICKET[a.estado] ?? 'neutro',
                  a: `${base}/tickets/${a.id}`,
                }))}
              />
            </Tarjeta>
          </div>
        </>
      ) : null}
    </>
  );
}
