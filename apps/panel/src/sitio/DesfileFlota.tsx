import type { CSSProperties } from 'react';

/**
 * C-DESFILE-FLOTA (4 nov 2026, Richard: «que se aprecien, casi del tamaño original… algo bonito,
 * vistoso», de prueba en la calculadora). Un desfile de vitrina, sin carretera: un piso blanco con una
 * línea fina roja, y la flota real de Divoox pasando de a uno, grande, alternando el sentido. Cada
 * vehículo entra, se detiene un momento en el centro y sale por el otro lado, con su sombra y su
 * reflejo en el piso. Con «reducir movimiento» queda uno quieto en el centro.
 */
/** `proporcion` = ancho / alto de su foto: así cada uno sabe su ancho y sale entero de la vista. */
const ORDEN: { nombre: string; sentido: 'izq' | 'der'; proporcion: number }[] = [
  { nombre: 'sedan', sentido: 'izq', proporcion: 707 / 239 },
  { nombre: 'moto', sentido: 'der', proporcion: 419 / 300 },
  { nombre: 'camioneta', sentido: 'izq', proporcion: 645 / 300 },
  { nombre: 'robot', sentido: 'der', proporcion: 370 / 300 },
  { nombre: 'compacto', sentido: 'izq', proporcion: 547 / 290 },
  { nombre: 'moto2', sentido: 'der', proporcion: 447 / 300 },
];
/** Segundos que tiene cada vehículo para pasar (entrar, detenerse y salir). */
const TURNO_S = 5;

export function DesfileFlota({ lema, servicios }: { lema?: string; servicios?: string } = {}) {
  return (
    <div
      className={lema ? 'desfile desfile-con-lema' : 'desfile'}
      role={lema ? 'img' : undefined}
      aria-label={lema ? `${lema}. ${servicios ?? ''}` : undefined}
      aria-hidden={lema ? undefined : true}
    >
      {lema ? (
        <div className="desfile-lema" aria-hidden="true">
          <strong>{lema}</strong>
          {servicios ? <span>{servicios}</span> : null}
        </div>
      ) : null}
      <div className="desfile-piso" />
      {ORDEN.map((v, i) => (
        <div
          key={v.nombre}
          className={`desfile-auto desfile-${v.sentido}`}
          data-vehiculo={v.nombre}
          style={
            {
              animationDuration: `${TURNO_S * ORDEN.length}s`,
              animationDelay: `${i * TURNO_S}s`,
              '--proporcion': v.proporcion,
            } as CSSProperties
          }
        >
          <span className="desfile-sombra" />
          <img src={`/marca/vehiculos/grande/${v.nombre}-${v.sentido}.webp`} alt="" />
          <img
            className="desfile-reflejo"
            src={`/marca/vehiculos/grande/${v.nombre}-${v.sentido}.webp`}
            alt=""
          />
        </div>
      ))}
    </div>
  );
}
