/**
 * Entrega 3 · C-PAUSA-SIN-SENAL (16 oct 2026): ¿la app o el panel del restaurante están
 * escuchando pedidos? Como el «Tablet Heartbeat» de DoorDash (5 minutos sin recibir → pausa).
 * Ficha: docs/investigaciones-rea/2026-10-16-pausa-sin-senal.md.
 */
export const PAUSA_SIN_SENAL_MINUTOS = 5;

/**
 * `senalEn` viene de la base en UTC («AAAA-MM-DD HH:MM:SS»). Sin marca todavía (NULL) cuenta como
 * con señal: así, al publicar, ningún restaurante se cierra de golpe. Con `minutos` en 0 la pausa
 * está apagada.
 */
export function conSenal(
  senalEn: string | null | undefined,
  ahora: Date = new Date(),
  minutos: number = PAUSA_SIN_SENAL_MINUTOS,
): boolean {
  if (!minutos || minutos <= 0) return true;
  if (!senalEn) return true;
  const t = Date.parse(`${senalEn.replace(' ', 'T')}${senalEn.endsWith('Z') ? '' : 'Z'}`);
  if (Number.isNaN(t)) return true;
  return ahora.getTime() - t <= minutos * 60_000;
}
