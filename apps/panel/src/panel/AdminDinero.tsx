import { useEffect, useState } from 'react';
import {
  type ConfigDinero,
  ErrorApi,
  type Idioma,
  calcularPedido,
  centavosATexto,
  dolaresACentavos,
  enIdioma,
  formatearDolares,
} from '@tumbite/compartido';
import { pedir } from './api';

const T = {
  es: {
    titulo: 'Dinero',
    ayuda:
      'Estos valores mandan sobre todos los pedidos nuevos. Los porcentajes van en %, los montos en dólares.',
    comision: 'Comisión al restaurante',
    inicial: 'Plan Inicial',
    crece: 'Plan Crece',
    elite: 'Plan Élite',
    envio: 'Envío',
    envioBase: 'Envío base',
    envioKm: 'Km incluidos en el envío base',
    envioPorKm: 'Por cada km extra',
    envioMax: 'Envío máximo',
    servicio: 'Tarifa de servicio (cliente)',
    servicioPct: 'Porcentaje',
    servicioMin: 'Mínimo',
    servicioMax: 'Máximo',
    pequeno: 'Pedido pequeño',
    pedidoMin: 'Pedido mínimo sin cargo',
    cargo: 'Cargo por pedido pequeño',
    repartidor: 'Repartidor',
    pagoMin: 'Pago mínimo por entrega (sin contar propina)',
    guardar: 'Guardar',
    guardado: 'Guardado',
    ejemplo: 'Ejemplo: pedido de $30, 2 km, propina $4, plan Inicial',
    cliente: 'Paga el cliente',
    rest: 'Recibe el restaurante',
    rep: 'Recibe el repartidor',
    plat: 'Gana Tumbite',
    malo: 'Revisa este valor.',
  },
  en: {
    titulo: 'Money',
    ayuda: 'These values apply to every new order. Percentages in %, amounts in dollars.',
    comision: 'Restaurant commission',
    inicial: 'Starter plan',
    crece: 'Growth plan',
    elite: 'Pro plan',
    envio: 'Delivery',
    envioBase: 'Base delivery fee',
    envioKm: 'Miles-free km included',
    envioPorKm: 'Per extra km',
    envioMax: 'Maximum delivery fee',
    servicio: 'Service fee (customer)',
    servicioPct: 'Percentage',
    servicioMin: 'Minimum',
    servicioMax: 'Maximum',
    pequeno: 'Small order',
    pedidoMin: 'Minimum order without fee',
    cargo: 'Small order fee',
    repartidor: 'Driver',
    pagoMin: 'Minimum pay per delivery (excluding tip)',
    guardar: 'Save',
    guardado: 'Saved',
    ejemplo: 'Example: $30 order, 2 km, $4 tip, Starter plan',
    cliente: 'Customer pays',
    rest: 'Restaurant receives',
    rep: 'Driver receives',
    plat: 'Tumbite earns',
    malo: 'Check this value.',
  },
};

type Texto = Record<string, string>;
/** Lee un valor por nombre sin indexar con variables. */
const leer = (o: Texto, k: string): string => new Map(Object.entries(o)).get(k) ?? '';
const pct = (pb: number) => String(pb / 100);
const aPb = (s: string) => Math.round(Number(s.replace(',', '.')) * 100);

function aTextos(c: ConfigDinero): Texto {
  return {
    inicial: pct(c.comisionPb.inicial),
    crece: pct(c.comisionPb.crece),
    elite: pct(c.comisionPb.elite),
    envioBase: centavosATexto(c.envioBase),
    envioKm: String(c.envioKmIncluidos),
    envioPorKm: centavosATexto(c.envioPorKm),
    envioMax: centavosATexto(c.envioMaximo),
    servicioPct: pct(c.servicioPb),
    servicioMin: centavosATexto(c.servicioMinimo),
    servicioMax: centavosATexto(c.servicioMaximo),
    pedidoMin: centavosATexto(c.pedidoMinimo),
    cargo: centavosATexto(c.cargoPedidoPequeno),
    pagoMin: centavosATexto(c.pagoMinimoRepartidor),
  };
}

function aConfig(t: Texto): ConfigDinero | null {
  const d = (k: string) => dolaresACentavos(leer(t, k));
  const c = {
    comisionPb: {
      inicial: aPb(t.inicial ?? ''),
      crece: aPb(t.crece ?? ''),
      elite: aPb(t.elite ?? ''),
    },
    envioBase: d('envioBase'),
    envioKmIncluidos: Number(t.envioKm),
    envioPorKm: d('envioPorKm'),
    envioMaximo: d('envioMax'),
    servicioPb: aPb(t.servicioPct ?? ''),
    servicioMinimo: d('servicioMin'),
    servicioMaximo: d('servicioMax'),
    pedidoMinimo: d('pedidoMin'),
    cargoPedidoPequeno: d('cargo'),
    pagoMinimoRepartidor: d('pagoMin'),
  };
  const numeros = [
    c.comisionPb.inicial,
    c.comisionPb.crece,
    c.comisionPb.elite,
    c.envioKmIncluidos,
    c.servicioPb,
  ];
  if (numeros.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (
    [
      c.envioBase,
      c.envioPorKm,
      c.envioMaximo,
      c.servicioMinimo,
      c.servicioMaximo,
      c.pedidoMinimo,
      c.cargoPedidoPequeno,
      c.pagoMinimoRepartidor,
    ].some((n) => n === null)
  )
    return null;
  return c as ConfigDinero;
}

export function AdminDinero({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [valores, setValores] = useState<Texto | null>(null);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    pedir<{ config: ConfigDinero }>('GET', '/datos/config-dinero')
      .then((r) => setValores(aTextos(r.config)))
      .catch((e: unknown) => setError(e instanceof ErrorApi ? e.message : String(e)));
  }, []);

  if (!valores) return error ? <p className="error-general">{error}</p> : null;
  const config = aConfig(valores);
  const ejemplo = config
    ? calcularPedido({
        lineas: [{ precioCentavos: 3000, cantidad: 1 }],
        plan: 'inicial',
        propina: 400,
        distanciaKm: 2,
        config,
      })
    : null;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setAviso('');
    setError('');
    if (!config) return setError(t.malo);
    try {
      await pedir('PUT', '/datos/admin/config-dinero', config);
      setAviso(t.guardado);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  const campo = (clave: string, etiqueta: string, sufijo: string) => (
    <label className="campo campo-num" key={clave}>
      <span>{etiqueta}</span>
      <span className="con-sufijo">
        <input
          inputMode="decimal"
          value={leer(valores, clave)}
          onChange={(e) => setValores({ ...valores, [clave]: e.target.value })}
          aria-label={etiqueta}
        />
        <em>{sufijo}</em>
      </span>
    </label>
  );

  return (
    <section>
      <h1>{t.titulo}</h1>
      <p>{t.ayuda}</p>
      <form onSubmit={guardar} className="dinero">
        <fieldset>
          <legend>{t.comision}</legend>
          {campo('inicial', t.inicial, '%')}
          {campo('crece', t.crece, '%')}
          {campo('elite', t.elite, '%')}
        </fieldset>
        <fieldset>
          <legend>{t.envio}</legend>
          {campo('envioBase', t.envioBase, '$')}
          {campo('envioKm', t.envioKm, 'km')}
          {campo('envioPorKm', t.envioPorKm, '$')}
          {campo('envioMax', t.envioMax, '$')}
        </fieldset>
        <fieldset>
          <legend>{t.servicio}</legend>
          {campo('servicioPct', t.servicioPct, '%')}
          {campo('servicioMin', t.servicioMin, '$')}
          {campo('servicioMax', t.servicioMax, '$')}
        </fieldset>
        <fieldset>
          <legend>{t.pequeno}</legend>
          {campo('pedidoMin', t.pedidoMin, '$')}
          {campo('cargo', t.cargo, '$')}
        </fieldset>
        <fieldset>
          <legend>{t.repartidor}</legend>
          {campo('pagoMin', t.pagoMin, '$')}
        </fieldset>
        {ejemplo && (
          <div className="ejemplo">
            <strong>{t.ejemplo}</strong>
            <span>
              {t.cliente}: {formatearDolares(ejemplo.totalCliente, idioma)}
            </span>
            <span>
              {t.rest}: {formatearDolares(ejemplo.pagoRestaurante, idioma)}
            </span>
            <span>
              {t.rep}: {formatearDolares(ejemplo.pagoRepartidor, idioma)}
            </span>
            <span>
              {t.plat}: {formatearDolares(ejemplo.gananciaPlataforma, idioma)}
            </span>
          </div>
        )}
        {error && (
          <p className="error-general" role="alert">
            {error}
          </p>
        )}
        {aviso && (
          <p className="ok" role="status">
            {aviso}
          </p>
        )}
        <button type="submit" className="boton">
          {t.guardar}
        </button>
      </form>
    </section>
  );
}
