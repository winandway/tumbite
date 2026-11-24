import { useEffect, useState } from 'react';
import type { Idioma } from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { pedir } from './api';

/**
 * C-APROBADOS-NO-ELEGIBLES (23 nov 2026, Richard): conductores con su vehículo aprobado que el reparto
 * NO tomaría aunque abran Driver, con el motivo en palabras. Se ve en rojo (es un problema) y se va
 * solo cuando se arregla: es un contador de tarea, no de lectura. Todos los países.
 */
type Fila = { conductorId: string; codigo: string | null; motivo: string };

const TEXTOS = {
  es: {
    titulo: (n: number) =>
      n === 1
        ? 'Un conductor aprobado no puede recibir viajes:'
        : `${n} conductores aprobados no pueden recibir viajes:`,
    motivos: {
      sin_vehiculo_activo: 'no tiene vehículo en uso',
      vehiculo_activo_sin_aprobar: 'el vehículo en uso no está aprobado',
      servicio_cerrado_en_zona: 'su servicio no está abierto en su zona',
      servicio_apagado: 'tiene apagado su servicio en Driver',
      bloqueado: 'tiene un bloqueo activo',
      papeles_o_habilitacion: 'le faltan papeles o la aprobación del servicio',
    } as Record<string, string>,
  },
  en: {
    titulo: (n: number) =>
      n === 1 ? 'One approved driver can’t get rides:' : `${n} approved drivers can’t get rides:`,
    motivos: {
      sin_vehiculo_activo: 'no vehicle in use',
      vehiculo_activo_sin_aprobar: 'the vehicle in use isn’t approved',
      servicio_cerrado_en_zona: 'their service isn’t open in their zone',
      servicio_apagado: 'they turned their service off in Driver',
      bloqueado: 'they have an active block',
      papeles_o_habilitacion: 'missing documents or service approval',
    } as Record<string, string>,
  },
};

export function AvisoNoElegibles({ base, idioma }: { base: string; idioma: Idioma }) {
  const t = idioma === 'en' ? TEXTOS.en : TEXTOS.es;
  const [filas, setFilas] = useState<Fila[]>([]);
  useEffect(() => {
    let vivo = true;
    pedir<{ conductores: Fila[] }>('GET', '/datos/admin/repartidores/no-elegibles')
      .then((r) => {
        if (vivo) setFilas(Array.isArray(r?.conductores) ? r.conductores : []);
      })
      // Si falla, no se inventa nada: la lista sigue vacía y el canario de salud lo dice.
      .catch((e: unknown) => console.error('panel: aprobados no elegibles', e));
    return () => {
      vivo = false;
    };
  }, []);
  if (!filas.length) return null;
  return (
    <div className="aviso-alarma" role="alert" data-testid="aviso-no-elegibles">
      <strong>{t.titulo(filas.length)}</strong>
      <ul>
        {filas.map((f) => (
          <li key={f.conductorId}>
            <Enlace a={`${base}/drivers/${f.conductorId}`}>{f.codigo || '—'}</Enlace>
            {' · '}
            {t.motivos[f.motivo] ?? f.motivo}
          </li>
        ))}
      </ul>
    </div>
  );
}
