import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { api } from './api';
import { AvisoBorrador } from './AvisoBorrador';
import { pasosDeTexto } from './pasosSubida';

/**
 * C-MOTO-CIUDAD (30 oct 2026): los interruptores de cada ciudad, como Uber en cada mercado: el código
 * para empezar el viaje (siempre, solo de noche o nunca) y la selfie del conductor con el casco.
 */
const T = {
  es: {
    titulo: 'Interruptores por ciudad',
    ayuda: 'Sin ajuste, cada ciudad pide el código siempre y no pide la selfie con casco.',
    ninguno: 'Ninguna ciudad tiene ajustes todavía.',
    ciudad: 'Código de la ciudad (por ejemplo US-FL-MIAMI)',
    codigo: 'Código para empezar el viaje',
    modos: { siempre: 'Siempre', noche: 'Solo de noche (9 p. m. a 6 a. m.)', nunca: 'Nunca' },
    casco: 'Pedir la selfie con el casco puesto antes de aceptar (vale 12 horas)',
    guardar: 'Guardar interruptores',
    guardado: 'Interruptores guardados. Los viajes nuevos ya los usan.',
    si: 'selfie con casco',
    servicio: 'Servicio',
    servicios: { moto: 'Moto', carro: 'Carro', envios: 'Envíos' },
    subida: 'Subir la tarifa (si nadie acepta)',
    subidaModos: { igual: 'Dejar como está', encender: 'Encender', apagar: 'Apagar' },
    pasos: 'Botones, en la moneda de la ciudad, separados por coma (por ejemplo 0.25, 0.50, 1.00)',
    espera: 'Segundos buscando antes de ofrecerlo',
    veces: 'Veces que se puede subir un viaje',
    tope: 'Precio máximo (veces la cotización original, por ejemplo 1.5)',
    pasosMal: 'Escribe de 1 a 3 montos mayores que cero, separados por coma.',
    subidaSi: (p: string) => `subir la tarifa: ${p}`,
  },
  en: {
    titulo: 'Switches by city',
    ayuda:
      'With no settings, each city always asks for the code and doesn’t ask for the helmet selfie.',
    ninguno: 'No city has settings yet.',
    ciudad: 'City code (for example US-FL-MIAMI)',
    codigo: 'Code to start the ride',
    modos: { siempre: 'Always', noche: 'Only at night (9 p.m. to 6 a.m.)', nunca: 'Never' },
    casco: 'Require a selfie with the helmet on before accepting (valid for 12 hours)',
    guardar: 'Save switches',
    guardado: 'Switches saved. New rides use them now.',
    si: 'helmet selfie',
    servicio: 'Service',
    servicios: { moto: 'Moto', carro: 'Car', envios: 'Deliveries' },
    subida: 'Raise the fare (when nobody accepts)',
    subidaModos: { igual: 'Leave as is', encender: 'Turn on', apagar: 'Turn off' },
    pasos: 'Buttons, in the city’s currency, separated by commas (for example 0.25, 0.50, 1.00)',
    espera: 'Seconds searching before offering it',
    veces: 'Times a ride can be raised',
    tope: 'Maximum price (times the original quote, for example 1.5)',
    pasosMal: 'Enter 1 to 3 amounts above zero, separated by commas.',
    subidaSi: (p: string) => `raise the fare: ${p}`,
  },
};

type Ajuste = {
  zona: string;
  servicio: string;
  pin: string;
  selfieCasco: boolean;
  subida?: { pasos: number[]; esperaS: number; maxVeces: number; topePb: number } | null;
};

export function InterruptoresViaje({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const modos = new Map(Object.entries(t.modos));
  const servicios = new Map(Object.entries(t.servicios));
  const modosSubida = new Map(Object.entries(t.subidaModos));
  const [ajustes, setAjustes] = useState<Ajuste[]>([]);
  const [falla, setFalla] = useState('');
  const [aviso, setAviso] = useState('');
  const b = useBorrador({
    formulario: 'interruptores-moto',
    inicial: {
      zona: '',
      servicio: 'moto',
      pin: 'siempre',
      selfieCasco: false,
      subida: 'igual',
      pasos: '0.25, 0.50, 1.00',
      espera: '40',
      veces: '3',
      tope: '1.5',
    },
    almacen: almacenNavegador,
  });
  const cargar = useCallback(() => {
    api
      .pedir<{ ajustes: Ajuste[] }>('GET', '/datos/admin/viajes/ajustes')
      .then((r) => setAjustes(r.ajustes))
      .catch((x: unknown) => setFalla(x instanceof ErrorApi ? x.message : String(x)));
  }, []);
  useEffect(cargar, [cargar]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setFalla('');
    setAviso('');
    const v = b.valores;
    const pasos = v.subida === 'encender' ? pasosDeTexto(v.pasos) : null;
    if (v.subida === 'encender' && !pasos) return setFalla(t.pasosMal);
    try {
      await api.pedir('PUT', '/datos/admin/viajes/ajustes', {
        zona: v.zona.trim().toUpperCase(),
        servicio: v.servicio,
        pin: v.pin,
        selfieCasco: v.selfieCasco,
        ...(v.subida === 'apagar' ? { subida: null } : {}),
        ...(v.subida === 'encender' && pasos
          ? {
              subida: {
                pasos,
                esperaS: Number(v.espera),
                maxVeces: Number(v.veces),
                topePb: Math.round(Number(v.tope) * 10_000),
              },
            }
          : {}),
      });
      await b.limpiar();
      setAviso(t.guardado);
      cargar();
    } catch (x) {
      setFalla(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  return (
    <>
      <h2>{t.titulo}</h2>
      <p>{t.ayuda}</p>
      {falla && (
        <p className="error-general" role="alert">
          {falla}
        </p>
      )}
      {aviso && <p role="status">{aviso}</p>}
      {ajustes.length ? (
        <ul className="tarjetas">
          {ajustes.map((a) => (
            <li key={`${a.zona}-${a.servicio}`}>
              <strong>{a.zona}</strong> · {servicios.get(a.servicio) ?? a.servicio} · {t.codigo}:{' '}
              {modos.get(a.pin) ?? a.pin}
              {a.selfieCasco ? ` · ${t.si}` : ''}
              {a.subida
                ? ` · ${t.subidaSi(a.subida.pasos.map((x) => (x / 100).toFixed(2)).join(', '))}`
                : ''}
            </li>
          ))}
        </ul>
      ) : (
        <p>{t.ninguno}</p>
      )}
      <form className="flex-form" onSubmit={(e) => void guardar(e)} noValidate>
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
          <span>{t.servicio}</span>
          <select
            value={b.valores.servicio}
            onChange={(e) => b.cambiar('servicio', e.target.value)}
          >
            {[...servicios].map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>{t.codigo}</span>
          <select value={b.valores.pin} onChange={(e) => b.cambiar('pin', e.target.value)}>
            {[...modos].map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>
            <input
              type="checkbox"
              checked={b.valores.selfieCasco}
              onChange={(e) => b.cambiar('selfieCasco', e.target.checked)}
            />{' '}
            {t.casco}
          </span>
        </label>
        <label className="campo">
          <span>{t.subida}</span>
          <select value={b.valores.subida} onChange={(e) => b.cambiar('subida', e.target.value)}>
            {[...modosSubida].map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        {b.valores.subida === 'encender' ? (
          <>
            <label className="campo">
              <span>{t.pasos}</span>
              <input value={b.valores.pasos} onChange={(e) => b.cambiar('pasos', e.target.value)} />
            </label>
            <label className="campo">
              <span>{t.espera}</span>
              <input
                inputMode="numeric"
                value={b.valores.espera}
                onChange={(e) => b.cambiar('espera', e.target.value)}
              />
            </label>
            <label className="campo">
              <span>{t.veces}</span>
              <input
                inputMode="numeric"
                value={b.valores.veces}
                onChange={(e) => b.cambiar('veces', e.target.value)}
              />
            </label>
            <label className="campo">
              <span>{t.tope}</span>
              <input
                inputMode="decimal"
                value={b.valores.tope}
                onChange={(e) => b.cambiar('tope', e.target.value)}
              />
            </label>
          </>
        ) : null}
        <button type="submit" className="boton">
          {t.guardar}
        </button>
      </form>
    </>
  );
}
