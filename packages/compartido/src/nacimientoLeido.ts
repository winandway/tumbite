/**
 * C-NACIMIENTO-DEL-DOCUMENTO (Richard, 25 nov 2026) — todos los países. La comprobación automática del
 * documento (la MISMA llamada que ya lee nombre, número y vencimiento; ninguna llamada más) también lee
 * la fecha de nacimiento con su confianza. Aquí se elige la propuesta: la del frente del documento de
 * identidad primero, después su reverso y la licencia. Se guarda sola al aprobar la identidad solo si
 * la confianza llega al verde; si no, la decide una persona. Pieza pura (lleva su prueba).
 */
export const CONFIANZA_NACIMIENTO = 80;

/** Dónde se busca, en orden: la cédula manda; la licencia, si la cédula no la trae. */
const ORDEN_PASOS = ['doc_frente', 'doc_reverso', 'licencia_frente', 'licencia_reverso'] as const;

export type LecturaConNacimiento = {
  paso: string;
  lectura: {
    nacimiento?: unknown;
    confianzaNacimiento?: unknown;
    confianza?: unknown;
  } | null;
};

export type NacimientoPropuesto = { fecha: string; confianza: number; paso: string };

/** Una fecha AAAA-MM-DD real y de una persona que puede trabajar (entre 14 y 100 años). */
export function fechaNacimientoValida(texto: unknown, hoy = new Date()): string | null {
  const s = String(texto ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [a, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(Date.UTC(a, mes - 1, dia));
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== dia)
    return null;
  const anios = (hoy.getTime() - f.getTime()) / (365.25 * 86_400_000);
  return anios >= 14 && anios <= 100 ? s : null;
}

/**
 * C-CONFIANZA-LEIDA (25 nov 2026, producción: lecturas con la fecha y sin confianza útil). Una confianza
 * como la devuelva el modelo, en número de 0 a 100: acepta número o texto («95», «95 %», «0,95»), y la
 * escala de 0 a 1 (0.95 → 95). Lo que no es un número → null. Pura; la usan la lectura y el relleno.
 */
export function confianzaDe(x: unknown): number | null {
  const texto = typeof x === 'string' ? x.trim().replace('%', '').replace(',', '.').trim() : null;
  const n = typeof x === 'number' ? x : texto ? Number(texto) : Number.NaN;
  if (!Number.isFinite(n) || n < 0) return null;
  // Escala de 0 a 1: 0.95 quiere decir 95. Un 1 exacto se toma como 1 % (el modelo usa 0–100).
  const escalado = n > 0 && n < 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, Math.round(escalado)));
}
const numero = confianzaDe;

/** La fecha de nacimiento leída en sus documentos, con su confianza, o null si no se leyó. */
export function nacimientoDeLecturas(
  lecturas: readonly LecturaConNacimiento[],
  hoy = new Date(),
): NacimientoPropuesto | null {
  for (const paso of ORDEN_PASOS) {
    for (const l of lecturas) {
      if (l.paso !== paso || !l.lectura) continue;
      const fecha = fechaNacimientoValida(l.lectura.nacimiento, hoy);
      if (!fecha) continue;
      // Solo la confianza propia de la fecha: sin ella, la fecha se propone pero nunca se guarda sola.
      const confianza = numero(l.lectura.confianzaNacimiento) ?? 0;
      return { fecha, confianza, paso };
    }
  }
  return null;
}

/** ¿La propuesta se guarda sola al aprobar la identidad? Solo con la confianza en verde. */
export const nacimientoSeGuardaSolo = (p: NacimientoPropuesto | null): p is NacimientoPropuesto =>
  Boolean(p && p.confianza >= CONFIANZA_NACIMIENTO);
