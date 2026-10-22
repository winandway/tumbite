import { useState } from 'react';
import {
  type Idioma,
  type Plan,
  SERVICIO_DOORDASH_PCT,
  SUPUESTOS_MERCADO,
  ahorroCliente,
  almacenNavegador,
  compararRestaurante,
  enIdioma,
  formatearDolares,
  planesEquivalentes,
  proyectarCiudad,
  proyectarRepartidor,
  useBorrador,
} from '@tumbite/compartido';
import { Enlace } from '../Enlace';

/**
 * Calculadora pública (/calculator): cuánto gana o ahorra cada quien con Divoox. Restaurante,
 * repartidor, cliente y franquicia. Son proyecciones con supuestos públicos a la vista, NO
 * promesas (decisión de Richard, 13 oct 2026). La cuenta vive en packages/compartido/src/calculadora.ts.
 */
type Pestana = 'restaurants' | 'drivers' | 'customers' | 'franchises';
const PESTANAS: Pestana[] = ['restaurants', 'drivers', 'customers', 'franchises'];
const CIUDADES = ['Miami', 'Orlando', 'Tampa', 'Ocala'];

const T = {
  es: {
    etiqueta: 'Calculadora',
    titulo: 'Calcula cuánto ganas y cuánto ahorras con Divoox',
    intro:
      'Elige quién eres y mueve los números. Todo se calcula con los precios que Divoox usa hoy en la app y con datos públicos del mercado.',
    aviso:
      'Son proyecciones, no promesas: dependen de cuánta gente pida en tu ciudad y de cómo crezca Divoox allí. Los supuestos están abajo y los puedes cambiar.',
    pestanas: {
      restaurants: 'Restaurante',
      drivers: 'Repartidor',
      customers: 'Cliente',
      franchises: 'Franquicia',
    },
    recuperado: 'Recuperamos los números que tenías.',
    empezar: 'Empezar de nuevo',
    // Restaurante
    ventasMes: 'Tus ventas por apps de reparto al mes (dólares)',
    plan: 'Plan de Divoox',
    planes: { inicial: 'Inicial (7,5 %)', crece: 'Crece (12,5 %)', elite: 'Élite (15 %)' },
    teQueda: 'Lo que te queda al mes',
    conTumbite: 'Con Divoox',
    masAlMes: (a: string, b: string) =>
      `Con Divoox te quedan ${a} más al mes que con DoorDash y ${b} más que con Uber Eats.`,
    masAlAno: (a: string) => `En un año: ${a} más que con DoorDash.`,
    pedidosNuevos: 'Pedidos que Divoox te puede traer',
    pedidosNuevosAyuda:
      'Con el tamaño de tu ciudad, cuántos restaurantes hay en Divoox y qué parte del mercado logramos allí.',
    poblacion: 'Habitantes de la ciudad',
    restaurantes: 'Restaurantes en Divoox en la ciudad',
    cuota: 'Parte del mercado de apps que logra Divoox (%)',
    porRestaurante: (n: string) => `Unos ${n} pedidos al mes para tu restaurante`,
    ventasExtra: (v: string) =>
      `Unos ${v} en ventas al mes con esos pedidos (antes de la comisión).`,
    // Repartidor
    ciudad: 'Ciudad',
    ciudadAyuda:
      'Divoox paga lo mismo en todas las ciudades; lo que cambia es cuántos pedidos hay por hora.',
    horas: 'Horas por día',
    dias: 'Días por semana',
    ritmo: 'Entregas por hora',
    ritmos: { 1: '1 (hora tranquila)', 2: '2 (normal)', 3: '3 (hora pico)' } as Record<
      string,
      string
    >,
    propina: 'Propina promedio por entrega (dólares)',
    km: 'Distancia promedio de cada entrega (km)',
    porEntrega: (total: string, base: string) =>
      `Por entrega: ${total} (${base} de Divoox más la propina, que es 100 % tuya)`,
    porDia: 'Por día',
    porSemana: 'Por semana',
    porMes: 'Por mes',
    porHora: (h: string) => `Unos ${h} por hora.`,
    // Cliente
    pedidosMes: 'Pedidos al mes',
    ticket: 'Comida promedio por pedido (dólares)',
    servicio: (t: string, o: string) =>
      `Tarifa de servicio por pedido: ${t} en Divoox, frente a ${o} con el ${SERVICIO_DOORDASH_PCT} % que DoorDash publica en varias ciudades.`,
    ahorrasMes: 'Ahorras al mes',
    ahorrasAno: 'Ahorras al año',
    clienteNota:
      'Solo comparamos la tarifa de servicio, que es la que esas apps publican como porcentaje. El envío de las otras apps cambia por restaurante y por zona, así que no lo sumamos.',
    // Franquicia
    usuarios: 'Personas que piden por apps',
    pedidosMercado: 'Pedidos por apps en la ciudad al mes',
    pedidosTumbite: 'Pedidos de Divoox al mes',
    pedidosRest: 'Pedidos por restaurante al mes',
    ventasRest: 'Lo que reciben los restaurantes al mes',
    pagoRep: 'Lo que ganan los repartidores al mes',
    repartidores: 'Repartidores de tiempo completo necesarios',
    plataforma: 'Lo que le queda a la plataforma al mes (después de la tarjeta)',
    franquiciaNota:
      'La parte que le corresponde al franquiciado se acuerda en su contrato. Para conocerla, escríbenos desde «Cómo funciona», sección Franquicias.',
    supuestos: 'Supuestos del mercado (puedes cambiarlos)',
    usuariosPct: 'Personas que piden comida por app (%)',
    pedidosUsuario: 'Pedidos al mes por persona',
    // Fuentes
    fuentesTitulo: 'De dónde salen los números',
    fuentes: [
      'Precios de Divoox: los de la app hoy (envío desde 3,99 dólares, servicio del 5 % con mínimo de 1,99, pago mínimo de 5 dólares por entrega al repartidor y comisión del 7,5 al 15 % al restaurante).',
      'Comisiones de DoorDash y Uber Eats y la tarifa de servicio del 15 % de DoorDash: sus páginas oficiales, consultadas en octubre de 2026.',
      'Personas que piden por apps: encuesta de YouGov de enero de 2025 (28,2 % de los adultos de EE.UU. las usa al menos una vez por semana).',
      'Pedidos al mes y valor del pedido: informe anual 2025 de DoorDash (3.172 millones de pedidos, 56 millones de usuarios activos al mes, unos 32 dólares por pedido con tarifas y propina).',
      'Un repartidor de tiempo completo: supuesto nuestro de 16 entregas al día.',
    ],
  },
  en: {
    etiqueta: 'Calculator',
    titulo: 'See how much you earn and save with Divoox',
    intro:
      'Pick who you are and move the numbers. Everything is calculated with the prices Divoox uses in the app today and with public market data.',
    aviso:
      'These are projections, not promises: they depend on how many people order in your city and how Divoox grows there. The assumptions are below and you can change them.',
    pestanas: {
      restaurants: 'Restaurant',
      drivers: 'Driver',
      customers: 'Customer',
      franchises: 'Franchise',
    },
    recuperado: 'We restored the numbers you had.',
    empezar: 'Start over',
    ventasMes: 'Your monthly sales on delivery apps (dollars)',
    plan: 'Divoox plan',
    planes: { inicial: 'Starter (7.5%)', crece: 'Growth (12.5%)', elite: 'Elite (15%)' },
    teQueda: 'What you keep each month',
    conTumbite: 'With Divoox',
    masAlMes: (a: string, b: string) =>
      `With Divoox you keep ${a} more per month than with DoorDash and ${b} more than with Uber Eats.`,
    masAlAno: (a: string) => `Over a year: ${a} more than with DoorDash.`,
    pedidosNuevos: 'Orders Divoox can bring you',
    pedidosNuevosAyuda:
      'Based on your city’s size, how many restaurants are on Divoox, and the share of the market we reach there.',
    poblacion: 'City population',
    restaurantes: 'Restaurants on Divoox in the city',
    cuota: 'Share of the app market Divoox reaches (%)',
    porRestaurante: (n: string) => `About ${n} orders a month for your restaurant`,
    ventasExtra: (v: string) =>
      `About ${v} in monthly sales from those orders (before commission).`,
    ciudad: 'City',
    ciudadAyuda:
      'Divoox pays the same in every city; what changes is how many orders there are per hour.',
    horas: 'Hours per day',
    dias: 'Days per week',
    ritmo: 'Deliveries per hour',
    ritmos: { 1: '1 (slow hour)', 2: '2 (normal)', 3: '3 (rush hour)' } as Record<string, string>,
    propina: 'Average tip per delivery (dollars)',
    km: 'Average distance per delivery (km)',
    porEntrega: (total: string, base: string) =>
      `Per delivery: ${total} (${base} from Divoox plus the tip, which is 100% yours)`,
    porDia: 'Per day',
    porSemana: 'Per week',
    porMes: 'Per month',
    porHora: (h: string) => `About ${h} per hour.`,
    pedidosMes: 'Orders per month',
    ticket: 'Average food per order (dollars)',
    servicio: (t: string, o: string) =>
      `Service fee per order: ${t} on Divoox, versus ${o} at the ${SERVICIO_DOORDASH_PCT}% DoorDash publishes in several cities.`,
    ahorrasMes: 'You save per month',
    ahorrasAno: 'You save per year',
    clienteNota:
      'We only compare the service fee, which those apps publish as a percentage. Other apps’ delivery fees change by restaurant and area, so we don’t add them.',
    usuarios: 'People who order on apps',
    pedidosMercado: 'App orders in the city per month',
    pedidosTumbite: 'Divoox orders per month',
    pedidosRest: 'Orders per restaurant per month',
    ventasRest: 'What restaurants receive per month',
    pagoRep: 'What drivers earn per month',
    repartidores: 'Full-time drivers needed',
    plataforma: 'What the platform keeps per month (after card fees)',
    franquiciaNota:
      'The franchisee’s share is set in their contract. To learn it, write to us from “How it works,” Franchises section.',
    supuestos: 'Market assumptions (you can change them)',
    usuariosPct: 'People who order food on apps (%)',
    pedidosUsuario: 'Orders per person per month',
    fuentesTitulo: 'Where the numbers come from',
    fuentes: [
      'Divoox prices: the ones in the app today (delivery from $3.99, a 5% service fee with a $1.99 minimum, a $5 minimum per delivery for drivers, and a 7.5% to 15% commission for restaurants).',
      'DoorDash and Uber Eats commissions and DoorDash’s 15% service fee: their official pages, checked in October 2026.',
      'People who order on apps: YouGov survey, January 2025 (28.2% of US adults use them at least once a week).',
      'Orders per month and order value: DoorDash 2025 annual report (3,172 million orders, 56 million monthly active users, about $32 per order with fees and tip).',
      'A full-time driver: our assumption of 16 deliveries per day.',
    ],
  },
};

const INICIAL = {
  ventasMes: '10000',
  plan: 'inicial',
  poblacion: '100000',
  restaurantes: '100',
  cuota: '5',
  ciudad: 'Miami',
  horas: '8',
  dias: '5',
  ritmo: '2',
  propina: '4',
  km: '3',
  pedidosMes: '6',
  ticket: '28',
  usuariosPct: String(SUPUESTOS_MERCADO.usuariosAppsPct),
  pedidosUsuario: String(SUPUESTOS_MERCADO.pedidosPorUsuarioMes),
};

const num = (x: string) => {
  const n = Number(String(x).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const aCentavos = (x: string) => Math.round(num(x) * 100);

export function Calculadora({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const b = useBorrador({ formulario: 'calculadora', inicial: INICIAL, almacen: almacenNavegador });
  const v = b.valores;
  // La pestaña viaja en la dirección (#drivers…), para pasarle el enlace a alguien.
  const [pestana, setPestana] = useState<Pestana>(() => {
    const h = typeof window === 'undefined' ? '' : window.location.hash.slice(1);
    return PESTANAS.find((p) => p === h) ?? 'restaurants';
  });
  const elegir = (p: Pestana) => {
    setPestana(p);
    window.history.replaceState(null, '', `#${p}`);
  };
  const $ = (c: number) => formatearDolares(c, idioma);
  const nombrePestana = (p: Pestana) => new Map(Object.entries(t.pestanas)).get(p) ?? p;
  const nombrePlan = (p: Plan) => new Map(Object.entries(t.planes)).get(p) ?? p;
  const n = (x: number) => new Intl.NumberFormat(idioma === 'en' ? 'en-US' : 'es-US').format(x);
  const campo = (
    clave: keyof typeof INICIAL,
    etiqueta: string,
    extra: Record<string, unknown> = {},
  ) => (
    <label className="campo">
      <span>{etiqueta}</span>
      <input
        inputMode="decimal"
        value={new Map(Object.entries(v)).get(clave) ?? ''}
        onChange={(e) => b.cambiar(clave, e.target.value)}
        {...extra}
      />
    </label>
  );
  const plan = (['inicial', 'crece', 'elite'].includes(v.plan) ? v.plan : 'inicial') as Plan;
  const ciudad = proyectarCiudad({
    poblacion: num(v.poblacion),
    restaurantes: num(v.restaurantes),
    cuotaPct: num(v.cuota),
    usuariosAppsPct: num(v.usuariosPct),
    pedidosPorUsuarioMes: num(v.pedidosUsuario),
    ticket: aCentavos(v.ticket),
    plan,
  });

  return (
    <main className="como calculadora">
      <Enlace a="/" className="docs-volver">
        {idioma === 'en' ? '← Back to home' : '← Volver al inicio'}
      </Enlace>
      <span className="ld-etiqueta">{t.etiqueta}</span>
      <h1>{t.titulo}</h1>
      <p className="ld-entrada">{t.intro}</p>
      <p className="calc-aviso">{t.aviso}</p>

      <div className="calc-pestanas" role="tablist">
        {PESTANAS.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={pestana === p}
            className={pestana === p ? 'activa' : undefined}
            onClick={() => elegir(p)}
          >
            {nombrePestana(p)}
          </button>
        ))}
      </div>

      {b.recuperado && (
        <p className="aviso-borrador">
          {t.recuperado}{' '}
          <button type="button" className="enlace" onClick={() => void b.empezarDeNuevo()}>
            {t.empezar}
          </button>
        </p>
      )}

      <section className="calc-panel" role="tabpanel" aria-label={nombrePestana(pestana)}>
        {pestana === 'restaurants' &&
          (() => {
            const c = compararRestaurante(aCentavos(v.ventasMes), plan);
            const eq = planesEquivalentes(plan);
            const ventasExtra = ciudad.pedidosPorRestauranteMes * aCentavos(v.ticket);
            return (
              <>
                <div className="calc-campos">
                  {campo('ventasMes', t.ventasMes)}
                  <label className="campo">
                    <span>{t.plan}</span>
                    <select value={plan} onChange={(e) => b.cambiar('plan', e.target.value)}>
                      {(['inicial', 'crece', 'elite'] as const).map((p) => (
                        <option key={p} value={p}>
                          {nombrePlan(p)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <h2>{t.teQueda}</h2>
                <ul className="calc-lista">
                  <li className="propio">
                    <span>{t.conTumbite}</span>
                    <strong>{$(c.tumbite)}</strong>
                  </li>
                  <li>
                    <span>DoorDash {eq.doordash}</span>
                    <strong>{$(c.doordash)}</strong>
                  </li>
                  <li>
                    <span>Uber Eats {eq.ubereats}</span>
                    <strong>{$(c.ubereats)}</strong>
                  </li>
                </ul>
                <p className="calc-resultado">
                  {t.masAlMes($(c.tumbite - c.doordash), $(c.tumbite - c.ubereats))}{' '}
                  {t.masAlAno($((c.tumbite - c.doordash) * 12))}
                </p>
                <h2>{t.pedidosNuevos}</h2>
                <p>{t.pedidosNuevosAyuda}</p>
                <div className="calc-campos">
                  {campo('poblacion', t.poblacion)}
                  {campo('restaurantes', t.restaurantes)}
                  {campo('cuota', t.cuota)}
                  {campo('ticket', t.ticket)}
                </div>
                <p className="calc-resultado">
                  {t.porRestaurante(n(ciudad.pedidosPorRestauranteMes))}.{' '}
                  {t.ventasExtra($(ventasExtra))}
                </p>
              </>
            );
          })()}

        {pestana === 'drivers' &&
          (() => {
            const r = proyectarRepartidor({
              horasDia: num(v.horas),
              diasSemana: num(v.dias),
              entregasPorHora: num(v.ritmo),
              propina: aCentavos(v.propina),
              km: num(v.km),
            });
            return (
              <>
                <div className="calc-campos">
                  <label className="campo">
                    <span>{t.ciudad}</span>
                    <select value={v.ciudad} onChange={(e) => b.cambiar('ciudad', e.target.value)}>
                      {CIUDADES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  {campo('horas', t.horas)}
                  {campo('dias', t.dias)}
                  <label className="campo">
                    <span>{t.ritmo}</span>
                    <select value={v.ritmo} onChange={(e) => b.cambiar('ritmo', e.target.value)}>
                      {['1', '2', '3'].map((x) => (
                        <option key={x} value={x}>
                          {new Map(Object.entries(t.ritmos)).get(x)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {campo('propina', t.propina)}
                  {campo('km', t.km)}
                </div>
                <p className="ayuda">{t.ciudadAyuda}</p>
                <p>{t.porEntrega($(r.porEntrega), $(r.sinPropina))}</p>
                <ul className="calc-lista">
                  <li>
                    <span>{t.porDia}</span>
                    <strong>{$(r.dia)}</strong>
                  </li>
                  <li>
                    <span>{t.porSemana}</span>
                    <strong>{$(r.semana)}</strong>
                  </li>
                  <li className="propio">
                    <span>{t.porMes}</span>
                    <strong>{$(r.mes)}</strong>
                  </li>
                </ul>
                <p className="calc-resultado">{t.porHora($(r.porHora))}</p>
              </>
            );
          })()}

        {pestana === 'customers' &&
          (() => {
            const a = ahorroCliente(num(v.pedidosMes), aCentavos(v.ticket));
            return (
              <>
                <div className="calc-campos">
                  {campo('pedidosMes', t.pedidosMes)}
                  {campo('ticket', t.ticket)}
                </div>
                <p>{t.servicio($(a.servicioTumbite), $(a.servicioOtra))}</p>
                <ul className="calc-lista">
                  <li>
                    <span>{t.ahorrasMes}</span>
                    <strong>{$(a.mes)}</strong>
                  </li>
                  <li className="propio">
                    <span>{t.ahorrasAno}</span>
                    <strong>{$(a.ano)}</strong>
                  </li>
                </ul>
                <p className="ayuda">{t.clienteNota}</p>
              </>
            );
          })()}

        {pestana === 'franchises' && (
          <>
            <div className="calc-campos">
              {campo('poblacion', t.poblacion)}
              {campo('restaurantes', t.restaurantes)}
              {campo('cuota', t.cuota)}
            </div>
            <ul className="calc-lista">
              <li>
                <span>{t.usuarios}</span>
                <strong>{n(ciudad.usuariosApps)}</strong>
              </li>
              <li>
                <span>{t.pedidosMercado}</span>
                <strong>{n(ciudad.pedidosMercadoMes)}</strong>
              </li>
              <li>
                <span>{t.pedidosTumbite}</span>
                <strong>{n(ciudad.pedidosTumbiteMes)}</strong>
              </li>
              <li>
                <span>{t.pedidosRest}</span>
                <strong>{n(ciudad.pedidosPorRestauranteMes)}</strong>
              </li>
              <li>
                <span>{t.ventasRest}</span>
                <strong>{$(ciudad.ventasRestaurantesMes)}</strong>
              </li>
              <li>
                <span>{t.pagoRep}</span>
                <strong>{$(ciudad.pagoRepartidoresMes)}</strong>
              </li>
              <li>
                <span>{t.repartidores}</span>
                <strong>{n(ciudad.repartidoresNecesarios)}</strong>
              </li>
              <li className="propio">
                <span>{t.plataforma}</span>
                <strong>{$(ciudad.netoPlataformaMes)}</strong>
              </li>
            </ul>
            <p className="ayuda">{t.franquiciaNota}</p>
            <h2>{t.supuestos}</h2>
            <div className="calc-campos">
              {campo('usuariosPct', t.usuariosPct)}
              {campo('pedidosUsuario', t.pedidosUsuario)}
              {campo('ticket', t.ticket)}
            </div>
          </>
        )}
      </section>

      <section className="calc-fuentes">
        <h2>{t.fuentesTitulo}</h2>
        <ul>
          {t.fuentes.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
