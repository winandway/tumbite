import { type CruceDocumento, type Idioma, enIdioma } from '@tumbite/compartido';
import { Insignia } from './diseno/Insignia';

/**
 * C-CRUCES-DOCUMENTO (Richard, 25 nov 2026) — todos los países. Lo que no cuadra entre lo leído del
 * documento y la cuenta, en ámbar y con su motivo, en la ficha y en la bandeja de Verificaciones.
 */
const T = {
  es: {
    titulo: 'Revisar',
    nombre: (leido: string, escrito: string) =>
      `El nombre leído («${leido}») no es el que escribió («${escrito}»)`,
    numero: (doc: string, lic: string) =>
      `El número del documento (${doc}) no es el de su licencia (${lic})`,
    vencido: (vence: string) => `Su documento venció el ${vence}`,
    edad: (edad: string, minima: string) =>
      `Tiene ${edad} años y la edad mínima de su país es ${minima}`,
    sin_fecha: 'Sin fecha de nacimiento: la edad no se puede calcular',
  },
  en: {
    titulo: 'Check',
    nombre: (leido: string, escrito: string) =>
      `The name read (“${leido}”) isn’t the one they typed (“${escrito}”)`,
    numero: (doc: string, lic: string) =>
      `The ID number (${doc}) isn’t the one on their license (${lic})`,
    vencido: (vence: string) => `Their ID expired on ${vence}`,
    edad: (edad: string, minima: string) =>
      `They’re ${edad} and the minimum age in their country is ${minima}`,
    sin_fecha: 'No date of birth: the age can’t be worked out',
  },
};

export function motivoCruce(c: CruceDocumento, idioma: Idioma): string {
  const t = enIdioma(T, idioma);
  switch (c.clave) {
    case 'nombre':
      return t.nombre(c.leido, c.escrito);
    case 'numero':
      return t.numero(c.leido, c.escrito);
    case 'vencido':
      return t.vencido(c.leido);
    case 'edad':
      return t.edad(c.leido, c.escrito);
    default:
      return t.sin_fecha;
  }
}

export function CrucesDocumento({
  cruces,
  idioma,
  sinFecha = true,
}: {
  cruces: readonly CruceDocumento[] | null | undefined;
  idioma: Idioma;
  /** En la ficha la falta de fecha ya sale en rojo con su botón: aquí no se repite. */
  sinFecha?: boolean;
}) {
  const lista = (cruces ?? []).filter((c) => sinFecha || c.clave !== 'sin_fecha');
  if (!lista.length) return null;
  const t = enIdioma(T, idioma);
  return (
    <ul className="kyc-comprobaciones" aria-label={t.titulo} data-testid="cruces-documento">
      {lista.map((c) => (
        <li key={c.clave}>
          <Insignia tono="pendiente" testId={`cruce-${c.clave}`}>
            {t.titulo}: {motivoCruce(c, idioma)}
          </Insignia>
        </li>
      ))}
    </ul>
  );
}
