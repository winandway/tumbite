import { useEffect, useState } from 'react';
import { type Idioma, nombrePais } from '@tumbite/compartido';
import { pedir } from './api';

/**
 * C-TELEFONO-POR-PAIS (22 nov 2026, orden de Richard por Gerencia): el código por SMS al registrarse,
 * país por país. Se ve si el SMS sale hoy, se apaga o se enciende la exigencia, el gasto del día contra
 * el presupuesto y las últimas cuentas que confirmaron su celular (o que todavía no). El teléfono, solo
 * con sus últimos cuatro números.
 */
const T = {
  es: {
    titulo: 'Código por SMS al registrarse',
    detalle:
      'Las cuentas nuevas de clientes y conductores confirman su celular con un código por SMS. Si en un país lo apagas, nadie queda esperando: la exigencia se quita al momento. Las cuentas que ya existían nunca se bloquean.',
    exigir: (p: string) => `Exigir el código en ${p}`,
    saleHoy: 'El SMS sale hoy',
    noSale: 'Hoy el SMS no sale: no se exige a nadie',
    gasto: (sms: number, usd: number, tope: number) =>
      `SMS cobrados en 24 horas: ${sms} (unos ${usd.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} de ${tope} dólares de presupuesto)`,
    codigos: (n: number, tope: number) => `Códigos enviados en 24 horas: ${n} de ${tope}`,
    pendientes: (n: number) => `Cuentas nuevas sin confirmar: ${n}`,
    verificadas: (n: number) => `Confirmadas en los últimos 7 días: ${n}`,
    lista: 'Últimas cuentas',
    nombre: 'Nombre',
    tipo: 'Tipo',
    celular: 'Celular',
    estado: 'Estado',
    confirmado: (f: string) => `Confirmó el ${f}`,
    falta: 'Falta confirmar',
    cliente: 'Cliente',
    conductor: 'Conductor',
    vacio: 'Todavía no hay cuentas con el código.',
    guardado: 'Guardado.',
  },
  en: {
    titulo: 'Text code at sign-up',
    detalle:
      'New customer and driver accounts confirm their cell phone with a text code. If you turn it off in a country, nobody is left waiting: the requirement is lifted right away. Accounts that already existed are never blocked.',
    exigir: (p: string) => `Require the code in ${p}`,
    saleHoy: 'Texts are going out today',
    noSale: 'Texts can’t go out today: nobody is required to confirm',
    gasto: (sms: number, usd: number, tope: number) =>
      `Texts billed in 24 hours: ${sms} (about ${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} of a ${tope}-dollar budget)`,
    codigos: (n: number, tope: number) => `Codes sent in 24 hours: ${n} of ${tope}`,
    pendientes: (n: number) => `New accounts not confirmed yet: ${n}`,
    verificadas: (n: number) => `Confirmed in the last 7 days: ${n}`,
    lista: 'Latest accounts',
    nombre: 'Name',
    tipo: 'Type',
    celular: 'Cell phone',
    estado: 'Status',
    confirmado: (f: string) => `Confirmed on ${f}`,
    falta: 'Not confirmed yet',
    cliente: 'Customer',
    conductor: 'Driver',
    vacio: 'No accounts with the code yet.',
    guardado: 'Saved.',
  },
};

type Datos = {
  paises: { pais: string; exigido: boolean; smsSale: boolean }[];
  codigosHoy: number;
  topeCodigos: number;
  pendientes: number;
  verificadas7Dias: number;
  gasto: { smsHoy: number; usdHoy: number; presupuestoUsd: number };
  cuentas: {
    id: string;
    nombre: string;
    rol: string;
    ultimos: string | null;
    exigido: string | null;
    verificado: string | null;
  }[];
};

const fecha = (iso: string, idioma: Idioma) =>
  new Date(`${iso.replace(' ', 'T')}Z`).toLocaleDateString(idioma === 'en' ? 'en-US' : 'es', {
    day: 'numeric',
    month: 'short',
  });

export function VerificacionCelular({ idioma }: { idioma: Idioma }) {
  const t = idioma === 'en' ? T.en : T.es;
  const [datos, setDatos] = useState<Datos | null>(null);
  const [aviso, setAviso] = useState('');
  const cargar = () =>
    pedir<Datos>('GET', '/datos/admin/telefono-codigo')
      // Una respuesta sin la forma esperada no rompe la página de Configuración: el bloque no sale.
      .then((r) => setDatos(Array.isArray(r?.paises) && Array.isArray(r.cuentas) ? r : null))
      .catch((e: unknown) => setAviso(e instanceof Error ? e.message : String(e)));
  useEffect(() => {
    void cargar();
  }, []);
  const cambiar = (pais: string, exigido: boolean) => {
    setAviso('');
    pedir('PUT', '/datos/admin/telefono-codigo', { pais, exigido })
      .then(() => {
        setAviso(t.guardado);
        return cargar();
      })
      .catch((e: unknown) => setAviso(e instanceof Error ? e.message : String(e)));
  };
  if (!datos) return aviso ? <p role="alert">{aviso}</p> : null;
  return (
    <fieldset className="tarjeta" data-testid="verificacion-celular">
      <legend>{t.titulo}</legend>
      <p className="suave">{t.detalle}</p>
      {datos.paises.map((p) => (
        <div key={p.pais}>
          <label>
            <input
              type="checkbox"
              checked={p.exigido}
              onChange={(e) => cambiar(p.pais, e.target.checked)}
            />{' '}
            {t.exigir(nombrePais(p.pais, idioma))}
          </label>
          <p className="suave">{p.smsSale ? t.saleHoy : t.noSale}</p>
        </div>
      ))}
      <p>{t.gasto(datos.gasto.smsHoy, datos.gasto.usdHoy, datos.gasto.presupuestoUsd)}</p>
      <p>{t.codigos(datos.codigosHoy, datos.topeCodigos)}</p>
      <p>
        {t.pendientes(datos.pendientes)} · {t.verificadas(datos.verificadas7Dias)}
      </p>
      <h4>{t.lista}</h4>
      {datos.cuentas.length ? (
        <table className="tabla">
          <thead>
            <tr>
              <th>{t.nombre}</th>
              <th>{t.tipo}</th>
              <th>{t.celular}</th>
              <th>{t.estado}</th>
            </tr>
          </thead>
          <tbody>
            {datos.cuentas.map((c) => (
              <tr key={c.id}>
                <td>{c.nombre}</td>
                <td>{c.rol === 'repartidor' ? t.conductor : t.cliente}</td>
                <td>{c.ultimos ? `•••• ${c.ultimos}` : '—'}</td>
                <td>{c.verificado ? t.confirmado(fecha(c.verificado, idioma)) : t.falta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="suave">{t.vacio}</p>
      )}
      {aviso ? (
        <p className="suave" role="status">
          {aviso}
        </p>
      ) : null}
    </fieldset>
  );
}
