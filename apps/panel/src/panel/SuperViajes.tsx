import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  formatearMonto,
  montoATexto,
  textoAMonto,
  useBorrador,
} from '@tumbite/compartido';
import { api } from './api';
import { AvisoBorrador } from './AvisoBorrador';
import { InterruptoresViaje } from './InterruptoresViaje';

const T = {
  es: {
    titulo: 'Moto · Viajes',
    intro:
      'Moto existe solo en el sitio de pruebas hasta que Richard lo encienda con la aprobación legal. Las tarifas son de prueba.',
    emergencias: 'Emergencias abiertas',
    sinEmergencias: 'No hay emergencias abiertas.',
    pasajero: 'Pasajero',
    conductor: 'Conductor',
    atender: 'Marcar atendida',
    nota: 'Qué se hizo',
    viajes: 'Viajes recientes',
    sinViajes: 'Todavía no hay viajes.',
    estado: 'Estado',
    desde: 'Desde',
    hacia: 'Hacia',
    precio: 'Precio',
    tarifas: 'Tarifas activas',
    sinTarifas: 'Ninguna ciudad tiene tarifa de Moto todavía.',
    nueva: 'Nueva tarifa (cierra la anterior de esa ciudad)',
    ciudad: 'Código de la ciudad (por ejemplo US-FL-MIAMI)',
    moneda: 'Montos en la moneda de la ciudad',
    campos: {
      base: 'Banderazo',
      porKm: 'Por kilómetro',
      porMinuto: 'Por minuto',
      minimo: 'Precio mínimo',
      cargoFijo: 'Cargo fijo por viaje',
      porMinutoEspera: 'Por minuto de espera',
      cargoCancelacion: 'Cargo por cancelar tarde',
      cargoNoSePresento: 'Cargo si no se presenta',
    } as Record<string, string>,
    esperaGratis: 'Espera gratis (minutos)',
    cancelacionGratis: 'Cancelar gratis (minutos desde la asignación)',
    redondeo: 'Redondear a (unidad menor; 100 = de cien en cien)',
    motivo: 'Motivo del cambio',
    guardar: 'Guardar tarifa',
    guardada: 'Tarifa guardada. Las cotizaciones nuevas ya la usan.',
    dePrueba: 'de prueba',
  },
  en: {
    titulo: 'Moto · Rides',
    intro:
      'Moto exists only on the test site until Richard turns it on with legal approval. Prices are test prices.',
    emergencias: 'Open emergencies',
    sinEmergencias: 'No open emergencies.',
    pasajero: 'Rider',
    conductor: 'Driver',
    atender: 'Mark as handled',
    nota: 'What was done',
    viajes: 'Recent rides',
    sinViajes: 'No rides yet.',
    estado: 'Status',
    desde: 'From',
    hacia: 'To',
    precio: 'Price',
    tarifas: 'Active pricing',
    sinTarifas: 'No city has Moto pricing yet.',
    nueva: 'New pricing (closes the previous one for that city)',
    ciudad: 'City code (for example US-FL-MIAMI)',
    moneda: 'Amounts in the city’s currency',
    campos: {
      base: 'Base fare',
      porKm: 'Per kilometer',
      porMinuto: 'Per minute',
      minimo: 'Minimum fare',
      cargoFijo: 'Fixed fee per ride',
      porMinutoEspera: 'Per waiting minute',
      cargoCancelacion: 'Late cancellation fee',
      cargoNoSePresento: 'No-show fee',
    } as Record<string, string>,
    esperaGratis: 'Free waiting time (minutes)',
    cancelacionGratis: 'Free cancellation (minutes after assignment)',
    redondeo: 'Round to (minor unit; 100 = to the nearest hundred)',
    motivo: 'Reason for the change',
    guardar: 'Save pricing',
    guardada: 'Pricing saved. New quotes use it now.',
    dePrueba: 'test',
  },
};

const MONTOS = [
  'base',
  'porKm',
  'porMinuto',
  'minimo',
  'cargoFijo',
  'porMinutoEspera',
  'cargoCancelacion',
  'cargoNoSePresento',
] as const;

type Tarifa = Record<(typeof MONTOS)[number], number> & {
  id: string;
  zona: string;
  zonaNombre: string;
  moneda: string;
  esperaGratisS: number;
  cancelacionGratisS: number;
  redondeo: number;
  dePrueba: boolean;
  creadaEn: string;
};
type Datos = {
  emergencias: Record<string, unknown>[];
  viajes: Record<string, unknown>[];
  tarifas: Tarifa[];
};

/**
 * Divoox Moto · M9: lo que el superadmin vigila y configura. Emergencias abiertas (para atenderlas
 * ya), viajes recientes, y la tarifa de cada ciudad (cada cambio es una versión nueva con motivo).
 */
export function SuperViajes({ idioma }: { base: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const campos = new Map(Object.entries(t.campos));
  const [datos, setDatos] = useState<Datos | null>(null);
  const [falla, setFalla] = useState('');
  const [aviso, setAviso] = useState('');
  const [notas, setNotas] = useState<Map<string, string>>(() => new Map());
  const b = useBorrador({
    formulario: 'tarifa-moto',
    inicial: {
      zona: '',
      moneda: 'USD',
      base: '',
      porKm: '',
      porMinuto: '',
      minimo: '',
      cargoFijo: '0',
      porMinutoEspera: '0',
      cargoCancelacion: '0',
      cargoNoSePresento: '0',
      esperaGratis: '5',
      cancelacionGratis: '2',
      redondeo: '1',
      motivo: '',
    },
    almacen: almacenNavegador,
  });

  const cargar = useCallback(() => {
    api
      .pedir<Datos>('GET', '/datos/admin/viajes')
      .then(setDatos)
      .catch((x: unknown) => setFalla(x instanceof ErrorApi ? x.message : String(x)));
  }, []);
  useEffect(() => {
    cargar();
    const r = setInterval(cargar, 15_000);
    return () => clearInterval(r);
  }, [cargar]);

  async function atender(id: string) {
    setFalla('');
    try {
      await api.pedir('POST', `/datos/admin/viajes/emergencias/${id}/atender`, {
        nota: notas.get(id) ?? '',
      });
      cargar();
    } catch (x) {
      setFalla(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setFalla('');
    setAviso('');
    const v = b.valores;
    const m = v.moneda.trim().toUpperCase() || 'USD';
    const escritos = new Map(Object.entries(v));
    const tarifa: Record<string, number> = Object.fromEntries(
      MONTOS.map((k) => [k, textoAMonto(escritos.get(k) || '0', m)]),
    );
    tarifa.esperaGratisS = Math.round(Number(v.esperaGratis) * 60);
    tarifa.cancelacionGratisS = Math.round(Number(v.cancelacionGratis) * 60);
    tarifa.redondeo = Math.max(1, Math.round(Number(v.redondeo) || 1));
    try {
      await api.pedir('POST', '/datos/admin/viajes/tarifas', {
        servicio: 'moto',
        zona: v.zona.trim().toUpperCase(),
        tarifa,
        dePrueba: true,
        motivo: v.motivo,
      });
      await b.limpiar();
      setAviso(t.guardada);
      cargar();
    } catch (x) {
      setFalla(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  return (
    <section className="super">
      <h1>{t.titulo}</h1>
      <p>{t.intro}</p>
      {falla && (
        <p className="error-general" role="alert">
          {falla}
        </p>
      )}
      {aviso && <p role="status">{aviso}</p>}

      <h2>{t.emergencias}</h2>
      {!datos?.emergencias.length ? (
        <p>{t.sinEmergencias}</p>
      ) : (
        <ul className="tarjetas">
          {datos.emergencias.map((e) => {
            const id = String(e.id);
            return (
              <li key={id}>
                <strong>{e.rol === 'pasajero' ? t.pasajero : t.conductor}</strong>:{' '}
                {String(e.nombre)} · {String(e.correo)}{' '}
                {e.telefono ? `· ${String(e.telefono)}` : ''} · {String(e.creado_en)}
                {e.lat != null ? (
                  <>
                    {' '}
                    ·{' '}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${String(e.lat)},${String(e.lng)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Mapa
                    </a>
                  </>
                ) : null}
                <label className="campo">
                  <span>{t.nota}</span>
                  <input
                    value={notas.get(id) ?? ''}
                    onChange={(x) => setNotas((n) => new Map(n).set(id, x.target.value))}
                  />
                </label>
                <button type="button" className="boton" onClick={() => void atender(id)}>
                  {t.atender}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <h2>{t.viajes}</h2>
      {!datos?.viajes.length ? (
        <p>{t.sinViajes}</p>
      ) : (
        <div className="tabla-ancha">
          <table className="tabla">
            <thead>
              <tr>
                <th>{t.estado}</th>
                <th>{t.pasajero}</th>
                <th>{t.conductor}</th>
                <th>{t.desde}</th>
                <th>{t.hacia}</th>
                <th>{t.precio}</th>
              </tr>
            </thead>
            <tbody>
              {datos.viajes.map((v) => (
                <tr key={String(v.id)}>
                  <td>{String(v.estado)}</td>
                  <td>{String(v.pasajero ?? '—')}</td>
                  <td>{String(v.conductor ?? '—')}</td>
                  <td>{String(v.origen_direccion)}</td>
                  <td>{String(v.destino_direccion)}</td>
                  <td>
                    {v.total != null
                      ? formatearMonto(
                          Number(v.total_final_centavos ?? v.total),
                          String(v.moneda ?? 'USD'),
                          idioma,
                        )
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>{t.tarifas}</h2>
      {!datos?.tarifas.length ? (
        <p>{t.sinTarifas}</p>
      ) : (
        <ul className="tarjetas">
          {datos.tarifas.map((x) => (
            <li key={x.id}>
              <strong>{x.zonaNombre}</strong> ({x.zona}){x.dePrueba ? ` · ${t.dePrueba}` : ''}:{' '}
              {MONTOS.map(
                (k) =>
                  `${campos.get(k) ?? k} ${montoATexto(Number(new Map(Object.entries(x)).get(k) ?? 0), x.moneda)}`,
              ).join(' · ')}
            </li>
          ))}
        </ul>
      )}

      <form className="flex-form" onSubmit={(e) => void guardar(e)} noValidate>
        <h3>{t.nueva}</h3>
        <AvisoBorrador
          visible={b.recuperado}
          idioma={idioma}
          empezar={() => void b.empezarDeNuevo()}
        />
        <label className="campo">
          <span>{t.ciudad}</span>
          <input value={b.valores.zona} onChange={(e) => b.cambiar('zona', e.target.value)} />
        </label>
        <label className="campo">
          <span>{t.moneda}</span>
          <input value={b.valores.moneda} onChange={(e) => b.cambiar('moneda', e.target.value)} />
        </label>
        {MONTOS.map((k) => (
          <label className="campo" key={k}>
            <span>{campos.get(k) ?? k}</span>
            <input
              inputMode="decimal"
              value={new Map(Object.entries(b.valores)).get(k) ?? ''}
              onChange={(e) => b.cambiar(k, e.target.value)}
            />
          </label>
        ))}
        <label className="campo">
          <span>{t.esperaGratis}</span>
          <input
            inputMode="decimal"
            value={b.valores.esperaGratis}
            onChange={(e) => b.cambiar('esperaGratis', e.target.value)}
          />
        </label>
        <label className="campo">
          <span>{t.cancelacionGratis}</span>
          <input
            inputMode="decimal"
            value={b.valores.cancelacionGratis}
            onChange={(e) => b.cambiar('cancelacionGratis', e.target.value)}
          />
        </label>
        <label className="campo">
          <span>{t.redondeo}</span>
          <input
            inputMode="numeric"
            value={b.valores.redondeo}
            onChange={(e) => b.cambiar('redondeo', e.target.value)}
          />
        </label>
        <label className="campo">
          <span>{t.motivo}</span>
          <input value={b.valores.motivo} onChange={(e) => b.cambiar('motivo', e.target.value)} />
        </label>
        <button type="submit" className="boton">
          {t.guardar}
        </button>
      </form>
      <InterruptoresViaje idioma={idioma} />
    </section>
  );
}
