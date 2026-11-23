import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ErrorApi,
  almacenNavegador,
  formatearMonto,
  montoATexto,
  textoAMonto,
  useBorrador,
} from '@tumbite/compartido';
import { AyudaAqui } from './AyudaAqui';
import { pedir } from './api';

/**
 * C-COMIDA-VE-QUIEN-PAGA (23 nov 2026, modelo aprobado por Richard) — Venezuela y todo país con el
 * pago directo de la comida al restaurante. La palanca «Comida: quién paga qué»: lo que paga el
 * cliente (tarifa de servicio y cargo por pedido pequeño), la comisión de Divoox que paga el
 * restaurante de su saldo y lo que se le descuenta al conductor del envío. Habla con
 * `GET/PUT /datos/admin/finanzas/comida-quien-paga` (servidor: `finanzas/comidaQuienPaga.ts`).
 */
type Cliente = {
  servicioPb: number;
  servicioMinimo: number;
  servicioMaximo: number;
  pedidoMinimo: number;
  cargoPedidoPequeno: number;
};
export type VistaComidaQuienPaga = {
  pais: string;
  moneda: string;
  pagoDirecto: boolean;
  tarifasEscritas: boolean;
  cliente: Cliente | null;
  restaurante: {
    comisionPb: number | null;
    regla: unknown;
    preparadaPb: number;
    revisionLegalAprobada: boolean;
    politicaId: string | null;
    global: boolean;
  };
  conductor: { comisionEnvioPb: number };
  deFabrica: { restaurante: { preparadaPb: number } };
  paises?: { pais: string; moneda: string }[];
};

type Formulario = {
  pais: string;
  servicioPct: string;
  servicioMin: string;
  servicioMax: string;
  pedidoMin: string;
  cargoPequeno: string;
  restPct: string;
  notaLegal: string;
  conductorPct: string;
  motivo: string;
};

const VACIO: Formulario = {
  pais: 'VE',
  servicioPct: '',
  servicioMin: '',
  servicioMax: '',
  pedidoMin: '',
  cargoPequeno: '',
  restPct: '',
  notaLegal: '',
  conductorPct: '',
  motivo: '',
};

/** Puntos base a texto de porcentaje («1000» → «10»; «250» → «2.5»). */
const pctTexto = (pb: number) => String(pb / 100);
/** Texto de porcentaje a puntos base; NaN si no es un número. */
const pctAPb = (t: string) => {
  const n = Number(t.trim().replace(',', '.'));
  return t.trim() === '' || !Number.isFinite(n) ? Number.NaN : Math.round(n * 100);
};
const de = (monto: number, pb: number) => Math.round((monto * pb) / 10_000);

function formularioDe(v: VistaComidaQuienPaga, motivo = ''): Formulario {
  const c = v.cliente;
  const m = v.moneda;
  return {
    pais: v.pais,
    servicioPct: c ? pctTexto(c.servicioPb) : '',
    servicioMin: c ? montoATexto(c.servicioMinimo, m) : '',
    servicioMax: c ? montoATexto(c.servicioMaximo, m) : '',
    pedidoMin: c ? montoATexto(c.pedidoMinimo, m) : '',
    cargoPequeno: c ? montoATexto(c.cargoPedidoPequeno, m) : '',
    restPct: v.restaurante.comisionPb == null ? '' : pctTexto(v.restaurante.comisionPb),
    notaLegal: '',
    conductorPct: pctTexto(v.conductor.comisionEnvioPb),
    motivo,
  };
}

const T = {
  es: {
    titulo: 'Comida: quién paga qué',
    ayuda:
      'Solo países donde el cliente le paga la comida directo al restaurante (Venezuela). Cada cambio vale para los pedidos que se hagan desde ahora; un pedido ya hecho sigue con lo que tenía.',
    pais: 'País',
    cliente: 'Lo que paga el cliente',
    clientePista:
      'El cliente paga la comida al restaurante y el envío al conductor. Aquí se le puede sumar una tarifa de servicio o un cargo por pedido pequeño; en el modelo de hoy los dos van en 0.',
    servicioPct: 'Tarifa de servicio (%)',
    servicioMin: 'Tarifa de servicio mínima',
    servicioMax: 'Tarifa de servicio máxima',
    pedidoMin: 'Pedido mínimo sin cargo',
    cargoPequeno: 'Cargo por pedido pequeño',
    avisoServicio:
      'Ojo: con pago directo, la tarifa de servicio y el cargo por pedido pequeño los cobra el conductor en la mano junto con el envío.',
    restaurante: 'Lo que paga el restaurante',
    restPista:
      'La comisión de Divoox sale del saldo del restaurante cuando confirma «Me llegó». Con más de 0 % y sin saldo no recibe pedidos; con 0 % no se le pide saldo.',
    restPct: 'Comisión del restaurante (%)',
    vigente: (x: string) => `Vigente hoy: ${x}`,
    reglaRara: 'una regla que no es un porcentaje parejo (se ve en Finanzas → Políticas)',
    usarPreparado: (x: string) => `Usar el valor preparado (${x} %)`,
    global:
      'La que rige es una política de todos los países: para volver a 0 % ciérrala primero en Finanzas → Políticas.',
    nota: 'Referencia de la revisión legal aprobada',
    notaPista: 'Obligatoria para cobrarle comisión al restaurante (al menos 10 letras).',
    conductor: 'Lo que se le descuenta al conductor',
    conductorPista:
      'Porcentaje del envío que Divoox le aparta de su saldo. Con 0 % cobra el envío entero y no necesita saldo para la comida.',
    conductorPct: 'Comisión sobre el envío (%)',
    motivo: 'Motivo (queda en el registro)',
    motivoEjemplo: 'Por qué se cambia',
    ejemploTitulo: (comida: string, envio: string) =>
      `Ejemplo con un pedido de ${comida} de comida y ${envio} de envío`,
    paga: (total: string, comida: string, resto: string) =>
      `El cliente paga ${total}: ${comida} de comida directo al restaurante y ${resto} al conductor.`,
    rest: (recibe: string, saldo: string) =>
      `El restaurante recibe ${recibe} y le salen ${saldo} de su saldo.`,
    restGratis: (recibe: string) =>
      `El restaurante recibe ${recibe} y no le sale nada de su saldo.`,
    cond: (recibe: string) => `El conductor recibe ${recibe}.`,
    divoox: (gana: string) => `Divoox gana ${gana}.`,
    guardar: 'Guardar',
    guardado: 'Guardado. Vale para los pedidos que se hagan desde ahora.',
    nada: 'No cambiaste nada.',
    numero: 'Revisa los números: hay una casilla vacía o que no es un número.',
    sinTarifas:
      'Este país todavía no tiene las tarifas de comida escritas: abre Comida en una ciudad primero.',
    recuperado: 'Recuperamos lo que estabas escribiendo.',
    deNuevo: 'Empezar de nuevo',
    alta: 'Alta del primer restaurante',
  },
  en: {
    titulo: 'Food: who pays what',
    ayuda:
      'Only countries where the customer pays the restaurant directly for the food (Venezuela). Every change applies to orders placed from now on; an order already placed keeps what it had.',
    pais: 'Country',
    cliente: 'What the customer pays',
    clientePista:
      'The customer pays the restaurant for the food and the driver for the delivery. Here you can add a service fee or a small-order fee; in today’s model both are 0.',
    servicioPct: 'Service fee (%)',
    servicioMin: 'Minimum service fee',
    servicioMax: 'Maximum service fee',
    pedidoMin: 'Minimum order with no fee',
    cargoPequeno: 'Small-order fee',
    avisoServicio:
      'Heads up: with direct payment, the driver collects the service fee and the small-order fee in hand along with the delivery.',
    restaurante: 'What the restaurant pays',
    restPista:
      'The Divoox fee comes out of the restaurant balance when it confirms “I got it.” Above 0% and with no balance it gets no orders; at 0% no balance is required.',
    restPct: 'Restaurant fee (%)',
    vigente: (x: string) => `In effect today: ${x}`,
    reglaRara: 'a rule that is not a flat percentage (see Finance → Policies)',
    usarPreparado: (x: string) => `Use the prepared value (${x}%)`,
    global:
      'The one in effect is an all-countries policy: to go back to 0%, close it first in Finance → Policies.',
    nota: 'Approved legal review reference',
    notaPista: 'Required to charge the restaurant a fee (at least 10 characters).',
    conductor: 'What is taken from the driver',
    conductorPista:
      'Percentage of the delivery fee Divoox sets aside from their balance. At 0% they keep the whole delivery fee and need no balance for food.',
    conductorPct: 'Fee on delivery (%)',
    motivo: 'Reason (kept in the log)',
    motivoEjemplo: 'Why it changes',
    ejemploTitulo: (comida: string, envio: string) =>
      `Example with a ${comida} food order and a ${envio} delivery fee`,
    paga: (total: string, comida: string, resto: string) =>
      `The customer pays ${total}: ${comida} for the food directly to the restaurant and ${resto} to the driver.`,
    rest: (recibe: string, saldo: string) =>
      `The restaurant receives ${recibe} and ${saldo} comes out of its balance.`,
    restGratis: (recibe: string) =>
      `The restaurant receives ${recibe} and nothing comes out of its balance.`,
    cond: (recibe: string) => `The driver receives ${recibe}.`,
    divoox: (gana: string) => `Divoox earns ${gana}.`,
    guardar: 'Save',
    guardado: 'Saved. It applies to orders placed from now on.',
    nada: 'You did not change anything.',
    numero: 'Check the numbers: a box is empty or is not a number.',
    sinTarifas: 'This country does not have its food fees written yet: open Food in a city first.',
    recuperado: 'We recovered what you were typing.',
    deNuevo: 'Start over',
    alta: 'First restaurant sign-up',
  },
};

const COMIDA_EJEMPLO = 1000;
const ENVIO_EJEMPLO = 150;

/** El ejemplo vivo: lo que paga y recibe cada uno con los valores escritos en el formulario. */
export function ejemploComida(v: {
  servicioPb: number;
  servicioMinimo: number;
  servicioMaximo: number;
  pedidoMinimo: number;
  cargoPedidoPequeno: number;
  restPb: number;
  conductorPb: number;
}) {
  const servicio =
    v.servicioPb > 0 || v.servicioMinimo > 0
      ? Math.min(Math.max(de(COMIDA_EJEMPLO, v.servicioPb), v.servicioMinimo), v.servicioMaximo)
      : 0;
  const pequeno = COMIDA_EJEMPLO < v.pedidoMinimo ? v.cargoPedidoPequeno : 0;
  const alConductor = ENVIO_EJEMPLO + servicio + pequeno;
  const comisionRest = de(COMIDA_EJEMPLO, v.restPb);
  const comisionEnvio = de(ENVIO_EJEMPLO, v.conductorPb);
  return {
    total: COMIDA_EJEMPLO + alConductor,
    comida: COMIDA_EJEMPLO,
    alConductor,
    comisionRest,
    conductorRecibe: alConductor - comisionEnvio,
    divoox: comisionRest + comisionEnvio,
  };
}

const mensaje = (x: unknown) => (x instanceof ErrorApi ? x.message : String(x));
const RUTA = '/datos/admin/finanzas/comida-quien-paga';

export function ComidaQuienPaga({ idioma }: { idioma: 'es' | 'en' }) {
  const t = idioma === 'en' ? T.en : T.es;
  const [vista, setVista] = useState<VistaComidaQuienPaga | null>(null);
  const [paises, setPaises] = useState<{ pais: string; moneda: string }[]>([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [enviando, setEnviando] = useState(false);
  const b = useBorrador<Formulario>({
    formulario: 'super-fin-comida-quien-paga',
    inicial: VACIO,
    almacen: almacenNavegador,
  });
  const v = b.valores;
  const primera = useRef(true);

  const cargar = useCallback(
    (pais: string) => {
      pedir<VistaComidaQuienPaga>('GET', `${RUTA}?pais=${encodeURIComponent(pais)}`)
        .then((r) => {
          setVista(r);
          if (r.paises) setPaises(r.paises);
          if (primera.current) {
            primera.current = false;
            // Si había algo a medio escribir, eso manda (useBorrador lo deja encima).
            b.cargarBase(formularioDe(r));
          } else {
            // Otro país elegido a mano: sus valores, conservando el motivo escrito.
            b.setValores((x) => ({ ...formularioDe(r, x.motivo) }));
          }
        })
        .catch((x: unknown) => setError(mensaje(x)));
    },
    // b.cargarBase y b.setValores son estables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(() => cargar(v.pais || 'VE'), [cargar, v.pais]);

  const moneda = vista?.moneda ?? 'USD';
  const m = (monto: number) => formatearMonto(monto, moneda, idioma);
  const num = {
    servicioPb: pctAPb(v.servicioPct),
    servicioMinimo: textoAMonto(v.servicioMin, moneda),
    servicioMaximo: textoAMonto(v.servicioMax, moneda),
    pedidoMinimo: textoAMonto(v.pedidoMin, moneda),
    cargoPedidoPequeno: textoAMonto(v.cargoPequeno, moneda),
    restPb: pctAPb(v.restPct),
    conductorPb: pctAPb(v.conductorPct),
  };
  const numerosBien = Object.values(num).every((n) => Number.isInteger(n) && n >= 0);
  const ej = numerosBien ? ejemploComida(num) : null;
  const restVigente = vista?.restaurante.comisionPb ?? null;
  const restCambia = vista ? restVigente !== num.restPb || vista.restaurante.regla != null : false;
  const pideNota = restCambia && num.restPb > 0;
  const preparada = vista?.restaurante.preparadaPb ?? 1000;
  const conServicio = numerosBien && (num.servicioPb > 0 || num.servicioMinimo > 0);
  const conPequeno = numerosBien && num.pedidoMinimo > 0 && num.cargoPedidoPequeno > 0;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    if (!vista) return;
    if (!numerosBien) {
      setError(t.numero);
      return;
    }
    const c = vista.cliente;
    const cliente =
      c &&
      (c.servicioPb !== num.servicioPb ||
        c.servicioMinimo !== num.servicioMinimo ||
        c.servicioMaximo !== num.servicioMaximo ||
        c.pedidoMinimo !== num.pedidoMinimo ||
        c.cargoPedidoPequeno !== num.cargoPedidoPequeno)
        ? {
            servicioPb: num.servicioPb,
            servicioMinimo: num.servicioMinimo,
            servicioMaximo: num.servicioMaximo,
            pedidoMinimo: num.pedidoMinimo,
            cargoPedidoPequeno: num.cargoPedidoPequeno,
          }
        : undefined;
    const conductor =
      vista.conductor.comisionEnvioPb !== num.conductorPb
        ? { comisionEnvioPb: num.conductorPb }
        : undefined;
    const restaurante = restCambia
      ? {
          comisionPb: num.restPb,
          ...(num.restPb > 0 ? { revisionLegalNota: v.notaLegal.trim() } : {}),
        }
      : undefined;
    if (!cliente && !conductor && !restaurante) {
      setError(t.nada);
      return;
    }
    setEnviando(true);
    try {
      const r = await pedir<VistaComidaQuienPaga>('PUT', RUTA, {
        pais: v.pais,
        motivo: v.motivo,
        ...(cliente ? { cliente } : {}),
        ...(restaurante ? { restaurante } : {}),
        ...(conductor ? { conductor } : {}),
      });
      setVista(r);
      // Guardado con éxito: el borrador se va y el formulario queda con lo que ya rige.
      b.cargar(formularioDe(r));
      setOk(t.guardado);
    } catch (x) {
      // Lo escrito se queda en pantalla para reintentar.
      setError(mensaje(x));
    } finally {
      setEnviando(false);
    }
  }

  const casilla = (id: string, etiqueta: string, valor: string, campo: keyof Formulario) => (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <input
        id={id}
        inputMode="decimal"
        value={valor}
        onChange={(e) => b.cambiar(campo, e.target.value)}
      />
    </div>
  );

  const vigenteTexto =
    vista == null
      ? ''
      : vista.restaurante.regla != null
        ? t.reglaRara
        : `${pctTexto(vista.restaurante.comisionPb ?? 0)}${idioma === 'en' ? '' : ' '}%`;

  return (
    <section data-testid="comida-quien-paga" className="comida-qp">
      <h2>
        {t.titulo} <AyudaAqui guia="food-who-pays-what" idioma={idioma} />
      </h2>
      <p className="pista">{t.ayuda}</p>
      <form className="comida-qp-form" noValidate onSubmit={(e) => void guardar(e)}>
        {b.recuperado ? (
          <p className="aviso-borrador">
            {t.recuperado}{' '}
            <button type="button" className="enlace" onClick={() => void b.empezarDeNuevo()}>
              {t.deNuevo}
            </button>
          </p>
        ) : null}
        <div className="campo">
          <label htmlFor="cqp-pais">{t.pais}</label>
          <select
            id="cqp-pais"
            value={v.pais}
            onChange={(e) => {
              setOk('');
              setError('');
              b.cambiar('pais', e.target.value);
            }}
          >
            {(paises.length ? paises : [{ pais: v.pais || 'VE', moneda }]).map((p) => (
              <option key={p.pais} value={p.pais}>
                {p.pais} · {p.moneda}
              </option>
            ))}
          </select>
        </div>
        {vista && !vista.cliente ? <p className="pista">{t.sinTarifas}</p> : null}

        <fieldset className="comida-qp-bloque" data-testid="cqp-cliente">
          <legend>{t.cliente}</legend>
          <p className="pista">{t.clientePista}</p>
          <div className="comida-qp-casillas">
            {casilla('cqp-servicio', t.servicioPct, v.servicioPct, 'servicioPct')}
            {casilla('cqp-servicio-min', t.servicioMin, v.servicioMin, 'servicioMin')}
            {casilla('cqp-servicio-max', t.servicioMax, v.servicioMax, 'servicioMax')}
            {casilla('cqp-pedido-min', t.pedidoMin, v.pedidoMin, 'pedidoMin')}
            {casilla('cqp-pequeno', t.cargoPequeno, v.cargoPequeno, 'cargoPequeno')}
          </div>
          {conServicio || conPequeno ? (
            <p className="pista" role="note">
              {t.avisoServicio}
            </p>
          ) : null}
        </fieldset>

        <fieldset className="comida-qp-bloque" data-testid="cqp-restaurante">
          <legend>{t.restaurante}</legend>
          <p className="pista">{t.restPista}</p>
          {vista ? (
            <p data-testid="cqp-rest-vigente">
              <strong>{t.vigente(vigenteTexto)}</strong>
            </p>
          ) : null}
          {vista?.restaurante.global ? (
            <p className="pista" data-testid="cqp-global">
              {t.global}
            </p>
          ) : null}
          <div className="comida-qp-casillas">
            {casilla('cqp-rest', t.restPct, v.restPct, 'restPct')}
          </div>
          <div className="fila-botones">
            <button
              type="button"
              className="boton secundario"
              onClick={() => b.cambiar('restPct', pctTexto(preparada))}
            >
              {t.usarPreparado(pctTexto(preparada))}
            </button>
          </div>
          {pideNota ? (
            <div className="campo">
              <label htmlFor="cqp-nota">{t.nota}</label>
              <input
                id="cqp-nota"
                value={v.notaLegal}
                maxLength={1000}
                onChange={(e) => b.cambiar('notaLegal', e.target.value)}
              />
              <span className="pista">{t.notaPista}</span>
            </div>
          ) : null}
        </fieldset>

        <fieldset className="comida-qp-bloque" data-testid="cqp-conductor">
          <legend>{t.conductor}</legend>
          <p className="pista">{t.conductorPista}</p>
          <div className="comida-qp-casillas">
            {casilla('cqp-conductor', t.conductorPct, v.conductorPct, 'conductorPct')}
          </div>
        </fieldset>

        {ej ? (
          <div className="comida-qp-ejemplo" data-testid="cqp-ejemplo">
            <strong>{t.ejemploTitulo(m(COMIDA_EJEMPLO), m(ENVIO_EJEMPLO))}</strong>
            <p>{t.paga(m(ej.total), m(ej.comida), m(ej.alConductor))}</p>
            <p>
              {ej.comisionRest > 0
                ? t.rest(m(ej.comida), m(ej.comisionRest))
                : t.restGratis(m(ej.comida))}
            </p>
            <p>{t.cond(m(ej.conductorRecibe))}</p>
            <p>{t.divoox(m(ej.divoox))}</p>
          </div>
        ) : null}

        <div className="campo">
          <label htmlFor="cqp-motivo">{t.motivo}</label>
          <input
            id="cqp-motivo"
            value={v.motivo}
            maxLength={500}
            placeholder={t.motivoEjemplo}
            onChange={(e) => b.cambiar('motivo', e.target.value)}
          />
        </div>
        {error ? (
          <p className="texto-error" role="alert">
            {error}
          </p>
        ) : null}
        {ok ? (
          <p className="texto-exito" role="status">
            {ok}
          </p>
        ) : null}
        <div className="fila-botones">
          <button type="submit" className="boton" disabled={enviando || !vista?.cliente}>
            {t.guardar}
          </button>
        </div>
        <p className="pista">
          {t.alta} <AyudaAqui guia="first-restaurant-venezuela" idioma={idioma} />
        </p>
      </form>
    </section>
  );
}
