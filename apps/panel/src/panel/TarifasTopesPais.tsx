import { useState } from 'react';
import {
  type Idioma,
  almacenNavegador,
  enIdioma,
  montoATexto,
  montoEscrito,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';

/**
 * C-TOPES-PAIS: tarifas y topes de un país, en SU moneda. Estados Unidos no se edita aquí (usa la
 * configuración de siempre). Sin tarifas y topes completos, el país no se puede encender: el
 * servidor lo impide y aquí se dice qué falta. Las cifras las fija Richard.
 */
export type TarifasPais = Record<string, unknown> & {
  comisionPb: { inicial: number; crece: number; elite: number };
};
export type TopesPais = Record<string, number>;

const MONTOS_TARIFA = [
  'envioBase',
  'envioPorKm',
  'envioMaximo',
  'servicioMinimo',
  'servicioMaximo',
  'pedidoMinimo',
  'cargoPedidoPequeno',
  'pagoMinimoRepartidor',
] as const;
const PORCENTAJES = [
  'comision.inicial',
  'comision.crece',
  'comision.elite',
  'servicioPb',
  'impuestoPb',
] as const;
const TOPES = [
  'bonoOfertaAbierta',
  'opcionPrecioMax',
  'propinaMax',
  'propinaExtraMin',
  'propinaExtraMax',
  'cuponMontoMax',
  'quejaReembolsoMax',
] as const;

const T = {
  es: {
    tarifas: 'Tarifas del país',
    topes: 'Topes del país',
    eeuu: 'Estados Unidos usa la configuración de siempre (Tarifas y Quejas, más arriba).',
    completo: 'Completo: tiene tarifas y topes.',
    falta: 'Incompleto: no se puede encender ningún método de pago ni activar ciudades. Falta:',
    faltaTarifas: 'las tarifas',
    faltaTopes: 'los topes',
    enMoneda: 'Montos en',
    km: 'Kilómetros incluidos en el envío',
    guardar: 'Guardar tarifas y topes',
    incompletoForm: 'Completa todos los campos de tarifas, o todos los de topes, antes de guardar.',
    nombres: {
      envioBase: 'Envío base',
      envioPorKm: 'Envío por kilómetro',
      envioMaximo: 'Envío máximo',
      servicioMinimo: 'Servicio mínimo',
      servicioMaximo: 'Servicio máximo',
      pedidoMinimo: 'Pedido mínimo',
      cargoPedidoPequeno: 'Cargo por pedido pequeño',
      pagoMinimoRepartidor: 'Pago mínimo al repartidor',
      'comision.inicial': 'Comisión al restaurante, plan inicial (%)',
      'comision.crece': 'Comisión, plan crece (%)',
      'comision.elite': 'Comisión, plan élite (%)',
      servicioPb: 'Servicio al cliente (%)',
      impuestoPb: 'Impuesto (%)',
      bonoOfertaAbierta: 'Bono de la oferta abierta',
      opcionPrecioMax: 'Precio máximo de una opción',
      propinaMax: 'Propina máxima',
      propinaExtraMin: 'Propina posterior mínima',
      propinaExtraMax: 'Propina posterior máxima',
      cuponMontoMax: 'Monto máximo de un cupón',
      quejaReembolsoMax: 'Reembolso automático máximo por queja',
    } as Record<string, string>,
  },
  en: {
    tarifas: 'Country fees',
    topes: 'Country limits',
    eeuu: 'The United States uses its usual settings (Fees and Complaints, above).',
    completo: 'Complete: it has fees and limits.',
    falta: 'Incomplete: no payment method can be turned on and no city activated. Missing:',
    faltaTarifas: 'fees',
    faltaTopes: 'limits',
    enMoneda: 'Amounts in',
    km: 'Kilometers included in delivery',
    guardar: 'Save fees and limits',
    incompletoForm: 'Fill in every fee field, or every limit field, before saving.',
    nombres: {
      envioBase: 'Base delivery',
      envioPorKm: 'Delivery per kilometer',
      envioMaximo: 'Maximum delivery',
      servicioMinimo: 'Minimum service fee',
      servicioMaximo: 'Maximum service fee',
      pedidoMinimo: 'Minimum order',
      cargoPedidoPequeno: 'Small order fee',
      pagoMinimoRepartidor: 'Minimum driver pay',
      'comision.inicial': 'Restaurant commission, starter plan (%)',
      'comision.crece': 'Commission, grow plan (%)',
      'comision.elite': 'Commission, elite plan (%)',
      servicioPb: 'Customer service fee (%)',
      impuestoPb: 'Tax (%)',
      bonoOfertaAbierta: 'Open offer bonus',
      opcionPrecioMax: 'Maximum option price',
      propinaMax: 'Maximum tip',
      propinaExtraMin: 'Minimum later tip',
      propinaExtraMax: 'Maximum later tip',
      cuponMontoMax: 'Maximum coupon amount',
      quejaReembolsoMax: 'Maximum automatic complaint refund',
    } as Record<string, string>,
  },
};

const de = (m: Record<string, unknown>, k: string) => new Map(Object.entries(m)).get(k);

function valorTarifa(t: TarifasPais | null, k: string): number | undefined {
  if (!t) return undefined;
  if (k.startsWith('comision.')) return de(t.comisionPb, k.slice('comision.'.length)) as number;
  return de(t, k) as number | undefined;
}

export function TarifasTopesPais({
  pais,
  moneda,
  tarifas,
  topes,
  idioma,
  guardar,
}: {
  pais: string;
  moneda: string;
  tarifas: TarifasPais | null;
  topes: TopesPais | null;
  idioma: Idioma;
  guardar: (cambios: { tarifas?: TarifasPais; topes?: TopesPais }) => Promise<void>;
}) {
  const t = enIdioma(T, idioma);
  const [error, setError] = useState('');
  // Lo escrito se guarda solo y vuelve si se cierra la ventana (regla de formularios).
  const b = useBorrador<Record<string, string>>({
    formulario: 'pais-tarifas-topes',
    cuenta: pais,
    inicial: {},
    almacen: almacenNavegador,
  });
  if (pais === 'US') return <p className="suave">{t.eeuu}</p>;

  const texto = (k: string, actual: number | undefined, pct: boolean) =>
    (de(b.valores, k) as string | undefined) ??
    (actual == null
      ? ''
      : pct
        ? String(actual / 100)
        : k === 'envioKmIncluidos'
          ? String(actual)
          : montoATexto(actual, moneda));
  const numero = (k: string, actual: number | undefined, pct: boolean): number | null => {
    const v = texto(k, actual, pct).trim();
    if (!v) return null;
    if (pct) {
      const n = Number(v.replace(',', '.'));
      return Number.isFinite(n) ? Math.round(n * 100) : null;
    }
    return montoEscrito(v, moneda);
  };
  const faltan = [!tarifas ? t.faltaTarifas : null, !topes ? t.faltaTopes : null].filter(Boolean);

  async function enviar() {
    setError('');
    const montos = Object.fromEntries(
      MONTOS_TARIFA.map((k) => [k, numero(k, valorTarifa(tarifas, k), false)]),
    );
    const pcts = Object.fromEntries(
      PORCENTAJES.map((k) => [k, numero(k, valorTarifa(tarifas, k), true)]),
    );
    const km = (() => {
      const v = texto('envioKmIncluidos', valorTarifa(tarifas, 'envioKmIncluidos'), false).trim();
      return v ? Number(v.replace(',', '.')) : null;
    })();
    const tps = Object.fromEntries(
      TOPES.map((k) => [k, numero(k, topes ? (de(topes, k) as number) : undefined, false)]),
    );
    const llenos = (o: Record<string, number | null>) => Object.values(o).every((x) => x != null);
    const vacios = (o: Record<string, number | null>) => Object.values(o).every((x) => x == null);
    const tarifaLlena = llenos(montos) && llenos(pcts) && km != null;
    const tarifaVacia = vacios(montos) && vacios(pcts) && km == null;
    if ((!tarifaLlena && !tarifaVacia) || (!llenos(tps) && !vacios(tps)))
      return setError(t.incompletoForm);
    const cambios: { tarifas?: TarifasPais; topes?: TopesPais } = {};
    if (tarifaLlena)
      cambios.tarifas = {
        ...montos,
        envioKmIncluidos: km,
        servicioPb: de(pcts, 'servicioPb'),
        impuestoPb: de(pcts, 'impuestoPb'),
        comisionPb: {
          inicial: de(pcts, 'comision.inicial') as number,
          crece: de(pcts, 'comision.crece') as number,
          elite: de(pcts, 'comision.elite') as number,
        },
      };
    if (llenos(tps)) cambios.topes = tps as TopesPais;
    try {
      await guardar(cambios);
      await b.limpiar();
    } catch (x) {
      // Lo escrito se queda en pantalla para corregir y reintentar.
      setError(x instanceof Error ? x.message : String(x));
    }
  }

  const campo = (k: string, actual: number | undefined, pct: boolean) => (
    <label key={k} className="campo campo-num">
      <span>{String(de(t.nombres, k) ?? k)}</span>
      <input
        inputMode="decimal"
        value={texto(k, actual, pct)}
        onChange={(ev) => b.cambiar(k, ev.target.value)}
        aria-label={String(de(t.nombres, k) ?? k)}
      />
    </label>
  );

  return (
    <div className="tarifas-topes" data-testid="tarifas-topes-pais">
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <p className={faltan.length ? 'error-general' : 'ok'} role="status">
        {faltan.length ? `${t.falta} ${faltan.join(', ')}.` : t.completo}
      </p>
      <p className="suave">
        {t.enMoneda} {moneda}
      </p>
      <h4>{t.tarifas}</h4>
      {MONTOS_TARIFA.map((k) => campo(k, valorTarifa(tarifas, k), false))}
      {PORCENTAJES.map((k) => campo(k, valorTarifa(tarifas, k), true))}
      <label className="campo campo-num">
        <span>{t.km}</span>
        <input
          inputMode="decimal"
          value={texto('envioKmIncluidos', valorTarifa(tarifas, 'envioKmIncluidos'), false)}
          onChange={(ev) => b.cambiar('envioKmIncluidos', ev.target.value)}
          aria-label={t.km}
        />
      </label>
      <h4>{t.topes}</h4>
      {TOPES.map((k) => campo(k, topes ? (de(topes, k) as number) : undefined, false))}
      {error && (
        <p className="error-general" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="boton secundario" onClick={() => void enviar()}>
        {t.guardar}
      </button>
    </div>
  );
}
