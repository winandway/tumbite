import { useState } from 'react';
import {
  ErrorApi,
  type FaltaSinEnviar,
  type Idioma,
  enIdioma,
  faltaParaAprobarSinEnviar,
  nombrePapelPais,
} from '@tumbite/compartido';
import { pedir } from './api';
import { EtiquetaEstado } from './diseno/EtiquetaEstado';
import { Insignia } from './diseno/Insignia';
import { palabra } from './diseno/palabras';
import { type Moto, T_MOTO } from './SuperMoto';

/**
 * C-FICHA-VEHICULO-SIN-ENVIAR (Richard, 25 nov 2026: «un vehículo registrado y sin enviar no aparece en
 * la ficha») — todos los países. La moto o el carro que el conductor registró y no mandó a revisión,
 * en su ficha y en la pestaña «Vehículos · Sin enviar»: fotos, placa y papeles; «Esperando que el
 * conductor la envíe»; «Recordarle» (el aviso de Camila de siempre, plantilla «vehiculo_enviar») y, si
 * ya tiene sus fotos y su placa completas, «Aprobar» (la ruta de aprobar de siempre, que lo vuelve a
 * comprobar en el servidor y deja quién y cuándo en la auditoría). Lo que espera al equipo va en rojo.
 */
export const T_SIN_ENVIAR = {
  es: {
    titulo: 'Registrado sin enviar',
    esperando: (tipo: string): string =>
      tipo === 'carro'
        ? 'Esperando que el conductor lo envíe'
        : 'Esperando que el conductor la envíe',
    puedeAprobar: 'Ya tiene fotos, placa y papeles: lo puedes aprobar',
    camila: 'Camila le recuerda enviarlo',
    recordarle: 'Recordarle',
    recordado: 'Listo: Camila le mandó el aviso para que lo envíe.',
    noLlego: 'No le pudimos mandar el aviso (no tiene la app abierta en un celular con avisos).',
    aprobar: (tipo: string): string => (tipo === 'carro' ? 'Aprobar el carro' : 'Aprobar la moto'),
    confirmar: (tipo: string): string =>
      tipo === 'carro'
        ? '¿Aprobar este carro? Miraste sus fotos y su placa: queda aprobado aunque el conductor no lo haya enviado.'
        : '¿Aprobar esta moto? Miraste sus fotos y su placa: queda aprobada aunque el conductor no la haya enviado.',
    aprobado: (tipo: string): string => (tipo === 'carro' ? 'Carro aprobado.' : 'Moto aprobada.'),
    leFalta: 'Para aprobarlo todavía le falta:',
    faltas: {
      placa: 'la placa',
      placa_estado: 'dónde se emitió la placa',
      foto_frente: 'la foto de frente',
      foto_placa: 'la foto de la placa',
      foto_interior: 'la foto del interior',
      registro: 'el registro (título) del vehículo',
      seguro: 'el seguro (fuera de su plazo de papeles la base lo exige)',
    } as Record<FaltaSinEnviar, string>,
    sinFotos: 'Todavía no subió fotos ni papeles.',
    placa: 'Placa',
    sinPlaca: 'sin placa',
    verArchivo: 'Ver en grande',
  },
  en: {
    titulo: 'Registered, not sent',
    esperando: (tipo: string): string =>
      tipo === 'carro'
        ? 'Waiting for the driver to send the car'
        : 'Waiting for the driver to send it',
    puedeAprobar: 'Photos, plate and documents are in: you can approve it',
    camila: 'Camila reminds them to send it',
    recordarle: 'Remind them',
    recordado: 'Done: Camila sent them a notification to send it.',
    noLlego: 'We couldn’t send the notification (no phone with notifications on).',
    aprobar: (tipo: string) => (tipo === 'carro' ? 'Approve the car' : 'Approve the motorcycle'),
    confirmar: (tipo: string): string =>
      `Approve this ${tipo === 'carro' ? 'car' : 'motorcycle'}? You checked its photos and plate: it stays approved even though the driver didn’t send it.`,
    aprobado: (tipo: string) => (tipo === 'carro' ? 'Car approved.' : 'Motorcycle approved.'),
    leFalta: 'To approve it, it still needs:',
    faltas: {
      placa: 'the plate number',
      placa_estado: 'where the plate was issued',
      foto_frente: 'the front photo',
      foto_placa: 'the plate photo',
      foto_interior: 'the interior photo',
      registro: 'the vehicle registration',
      seguro: 'the insurance (required outside their document grace period)',
    } as Record<FaltaSinEnviar, string>,
    sinFotos: 'No photos or documents uploaded yet.',
    placa: 'Plate',
    sinPlaca: 'no plate',
    verArchivo: 'View large',
  },
};

/** Las fotos y papeles del vehículo en miniatura (se abren en grande en otra pestaña). */
export function MiniaturasVehiculo({ v, idioma }: { v: Moto; idioma: Idioma }) {
  const tm = enIdioma(T_MOTO, idioma);
  const nombres = v.tipo === 'carro' ? tm.documentosCarro : tm.documentosMoto;
  if (!v.documentos.length) return null;
  return (
    <ul className="vehiculo-fotos" data-testid={`vehiculo-fotos-${v.id}`}>
      {v.documentos.map((d) => {
        const url = `/datos/admin/vehiculos/${encodeURIComponent(v.id)}/documentos/${encodeURIComponent(d.id)}/archivo`;
        const nombre = palabra(nombres, d.tipo);
        return (
          <li key={d.id}>
            <a href={url} target="_blank" rel="noopener noreferrer" title={nombre}>
              <img
                src={url}
                alt={nombre}
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.visibility = 'hidden';
                }}
              />
            </a>
            <span>{nombre}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function VehiculoSinEnviar({
  v,
  idioma,
  alCambiar,
  conMiniaturas = true,
}: {
  v: Moto & { conductor_id?: string; faltaParaAprobar?: FaltaSinEnviar[] };
  idioma: Idioma;
  alCambiar: () => void;
  /** En la pestaña «Vehículos» las miniaturas ya van arriba de la fila. */
  conMiniaturas?: boolean;
}) {
  const t = enIdioma(T_SIN_ENVIAR, idioma);
  const tm = enIdioma(T_MOTO, idioma);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  // La regla del servidor; si una respuesta vieja no la trae, la misma pieza compartida.
  const falta = v.faltaParaAprobar ?? faltaParaAprobarSinEnviar(v, v.documentos);
  const puede = falta.length === 0;
  const nombresDoc = v.tipo === 'carro' ? tm.documentosCarro : tm.documentosMoto;
  const servicio = v.tipo === 'carro' ? 'carro' : 'moto';
  const mensaje = (x: unknown) => (x instanceof ErrorApi ? x.message : String(x));

  async function recordarle() {
    if (!v.conductor_id || ocupado) return;
    setOcupado(true);
    setError('');
    setOk('');
    try {
      const r = await pedir<{ resultados?: { canal: string; estado: string }[] }>(
        'POST',
        `/datos/admin/camila/recordatorios/${encodeURIComponent(v.conductor_id)}/mensaje`,
        { canales: ['aviso'], plantilla: 'vehiculo_enviar' },
      );
      const llego = (r.resultados ?? []).some(
        (x) => x.estado === 'enviado' || x.estado === 'entregado',
      );
      if (llego) setOk(t.recordado);
      else setError(t.noLlego);
    } catch (x) {
      setError(mensaje(x));
    } finally {
      setOcupado(false);
    }
  }

  async function aprobar() {
    if (!puede || ocupado) return;
    if (!window.confirm(t.confirmar(v.tipo))) return;
    setOcupado(true);
    setError('');
    setOk('');
    try {
      // Lo que se miró (fotos y papeles subidos) queda aprobado, y después el vehículo.
      for (const d of v.documentos.filter((x) => x.estado === 'pendiente'))
        await pedir('PUT', `/datos/admin/vehiculos/${v.id}/documentos/${d.id}`, {
          estado: 'aprobado',
          venceEn: d.venceEn?.slice(0, 10) || null,
        });
      await pedir('PUT', `/datos/admin/vehiculos/${v.id}`, { estado: 'aprobado' });
      setOk(t.aprobado(v.tipo));
      alCambiar();
    } catch (x) {
      setError(mensaje(x));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="vehiculo-sin-enviar" data-testid={`sin-enviar-${v.id}`}>
      <p className="lista-texto">
        <strong>
          {[v.marca, v.modelo, v.anio ? String(v.anio) : ''].filter(Boolean).join(' ') ||
            palabra(tm.tiposVehiculo, v.tipo)}
          {v.color ? ` · ${v.color}` : ''}
        </strong>
        <span>
          {palabra(tm.tiposVehiculo, v.tipo)} · {t.placa}: {v.placa || t.sinPlaca}
          {v.placa_estado ? ` (${v.placa_estado})` : ''}
        </span>
      </p>
      <ul className="kyc-comprobaciones">
        <li>
          {puede ? (
            <Insignia tono="problema" testId={`puede-aprobar-${v.id}`}>
              {t.puedeAprobar}
            </Insignia>
          ) : (
            <EtiquetaEstado estado="registrado" quien="conductor">
              {t.esperando(v.tipo)}
            </EtiquetaEstado>
          )}
        </li>
        <li>
          <Insignia tono="apagado">{t.camila}</Insignia>
        </li>
      </ul>
      {conMiniaturas ? <MiniaturasVehiculo v={v} idioma={idioma} /> : null}
      {v.documentos.length ? (
        <ul className="lista">
          {v.documentos.map((d) => (
            <li key={d.id}>
              <div className="lista-texto">
                <strong>
                  {nombrePapelPais(v.pais, servicio, d.tipo, idioma) ?? palabra(nombresDoc, d.tipo)}{' '}
                  <EtiquetaEstado estado={d.estado} quien="conductor">
                    {palabra(tm.estadosPapel, d.estado)}
                  </EtiquetaEstado>
                </strong>
                <a
                  href={`/datos/admin/vehiculos/${v.id}/documentos/${d.id}/archivo`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t.verArchivo}
                </a>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pista">{t.sinFotos}</p>
      )}
      {!puede ? (
        <p className="pista" data-testid={`falta-aprobar-${v.id}`}>
          {t.leFalta} {falta.map((f) => palabra(t.faltas, f)).join(', ')}.
        </p>
      ) : null}
      <div className="fila-botones">
        {puede ? (
          <button
            type="button"
            className="boton"
            disabled={ocupado}
            onClick={() => void aprobar()}
            data-testid={`aprobar-sin-enviar-${v.id}`}
          >
            {t.aprobar(v.tipo)}
          </button>
        ) : null}
        {v.conductor_id ? (
          <button
            type="button"
            className="boton secundario"
            disabled={ocupado}
            onClick={() => void recordarle()}
            data-testid={`recordarle-${v.id}`}
          >
            {t.recordarle}
          </button>
        ) : null}
      </div>
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
    </div>
  );
}
