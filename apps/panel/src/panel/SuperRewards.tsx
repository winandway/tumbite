import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { pedir } from './api';

/**
 * C-REWARDS-AJUSTES (30 oct 2026, R3): el equipo ajusta Divoox Rewards sin publicar de nuevo:
 * umbrales de los niveles, porcentaje del margen para los premios, tope por premio, tamaño del hito
 * y presupuesto por ciudad y mes. Sin porcentaje ni presupuesto no se paga nada.
 */
const T = {
  es: {
    titulo: 'Rewards',
    ayuda:
      'Los niveles y los premios de los repartidores. El premio es un porcentaje del margen real de las entregas que cuentan, con su tope, y nunca pasa del presupuesto del mes de esa ciudad. Con porcentaje o presupuesto en cero, no se paga nada.',
    niveles: 'Puntaje mínimo de cada nivel (0 a 100)',
    plata: 'Plata',
    oro: 'Oro',
    diamante: 'Diamante',
    premio: 'Premio',
    porcentaje: 'Porcentaje del margen (%)',
    tope: 'Tope por premio (USD)',
    hito: 'Entregas que cuentan para un premio',
    presupuesto: 'Presupuesto del mes',
    zona: 'Ciudad',
    mes: 'Mes (AAAA-MM)',
    monto: 'Monto (USD)',
    prioridad: 'Prioridad de despacho por nivel (solo participantes del piloto)',
    guardar: 'Guardar ajustes',
    guardado: 'Ajustes guardados. Se aplican desde el próximo cálculo.',
    vigentes: 'Presupuestos guardados',
  },
  en: {
    titulo: 'Rewards',
    ayuda:
      'Driver levels and rewards. A reward is a percentage of the real margin of the deliveries that count, with its cap, and it never goes over that city’s monthly budget. With the percentage or the budget at zero, nothing is paid.',
    niveles: 'Minimum score for each level (0 to 100)',
    plata: 'Silver',
    oro: 'Gold',
    diamante: 'Diamond',
    premio: 'Reward',
    porcentaje: 'Share of the margin (%)',
    tope: 'Cap per reward (USD)',
    hito: 'Deliveries that count toward a reward',
    presupuesto: 'Monthly budget',
    zona: 'City',
    mes: 'Month (YYYY-MM)',
    monto: 'Amount (USD)',
    prioridad: 'Dispatch priority by level (pilot participants only)',
    guardar: 'Save settings',
    guardado: 'Settings saved. They apply from the next calculation.',
    vigentes: 'Saved budgets',
  },
};

type Ajustes = {
  umbrales: { plata: number; oro: number; diamante: number };
  porcentajeMargen: number;
  topePremioCentavos: number;
  hitoUnidades: number;
  prioridadDespacho?: boolean;
};
type Presupuesto = { zona: string; mes: string; programa: string; centavos: number };

const mesActual = () => new Date().toISOString().slice(0, 7);

export function SuperRewards({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const b = useBorrador({
    formulario: 'rewards-ajustes',
    cuenta: 'superadmin',
    inicial: {
      plata: '',
      oro: '',
      diamante: '',
      porcentaje: '',
      tope: '',
      hito: '',
      prioridad: '',
      zona: 'US-FL-MIAMI',
      mes: mesActual(),
      monto: '',
    },
    almacen: almacenNavegador,
  });
  const { cargarBase } = b;
  const cargar = useCallback(() => {
    pedir<{ ajustes: Ajustes; presupuestos: Presupuesto[] }>('GET', '/datos/admin/rewards/ajustes')
      .then((r) => {
        cargarBase({
          plata: String(r.ajustes.umbrales.plata),
          oro: String(r.ajustes.umbrales.oro),
          diamante: String(r.ajustes.umbrales.diamante),
          porcentaje: String(r.ajustes.porcentajeMargen),
          tope: String(r.ajustes.topePremioCentavos / 100),
          hito: String(r.ajustes.hitoUnidades),
          prioridad: r.ajustes.prioridadDespacho ? 'si' : '',
          zona: 'US-FL-MIAMI',
          mes: mesActual(),
          monto: '',
        });
        setPresupuestos(r.presupuestos);
      })
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [cargarBase]);
  useEffect(cargar, [cargar]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    const v = b.valores;
    try {
      await pedir('PUT', '/datos/admin/rewards/ajustes', {
        umbrales: { plata: Number(v.plata), oro: Number(v.oro), diamante: Number(v.diamante) },
        porcentajeMargen: Number(v.porcentaje),
        topePremioCentavos: Math.round(Number(v.tope) * 100),
        hitoUnidades: Number(v.hito),
        prioridadDespacho: v.prioridad === 'si',
        ...(v.monto.trim()
          ? {
              presupuesto: {
                zona: v.zona,
                mes: v.mes,
                centavos: Math.round(Number(v.monto) * 100),
              },
            }
          : {}),
      });
      await b.limpiar();
      setOk(t.guardado);
      cargar();
    } catch (x) {
      // Lo escrito se queda en pantalla para corregirlo.
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  const campo = (k: keyof typeof b.valores, etiqueta: string, tipo = 'number') => (
    <label>
      {etiqueta}
      <input
        type={tipo}
        inputMode={tipo === 'number' ? 'decimal' : undefined}
        value={new Map(Object.entries(b.valores)).get(k) ?? ''}
        onChange={(e) => b.cambiar(k, e.target.value)}
      />
    </label>
  );

  return (
    <section className="super" data-testid="super-rewards">
      <h1>{t.titulo}</h1>
      <p className="pista">{t.ayuda}</p>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <form className="formulario tarjeta-form" onSubmit={(e) => void guardar(e)} noValidate>
        <h2>{t.niveles}</h2>
        {campo('plata', t.plata)}
        {campo('oro', t.oro)}
        {campo('diamante', t.diamante)}
        <h2>{t.premio}</h2>
        {campo('porcentaje', t.porcentaje)}
        {campo('tope', t.tope)}
        {campo('hito', t.hito)}
        <label className="casilla">
          <input
            type="checkbox"
            checked={b.valores.prioridad === 'si'}
            onChange={(e) => b.cambiar('prioridad', e.target.checked ? 'si' : '')}
          />
          {t.prioridad}
        </label>
        <h2>{t.presupuesto}</h2>
        {campo('zona', t.zona, 'text')}
        {campo('mes', t.mes, 'text')}
        {campo('monto', t.monto)}
        <button type="submit" className="boton">
          {t.guardar}
        </button>
      </form>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="texto-exito" role="status">
          {ok}
        </p>
      ) : null}
      {presupuestos.length ? (
        <>
          <h2>{t.vigentes}</h2>
          <ul className="lista">
            {presupuestos.map((p) => (
              <li key={`${p.zona}-${p.mes}-${p.programa}`}>
                <div className="lista-texto">
                  <strong>
                    {p.zona} · {p.mes}
                  </strong>
                  <span>${(p.centavos / 100).toFixed(2)}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
