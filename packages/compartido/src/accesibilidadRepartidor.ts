/**
 * C-AUDITIVA-REPARTIDOR (2 nov 2026), como Uber y DoorDash: el repartidor sordo o con dificultad
 * auditiva no oye el sonido de una oferta, así que la vibración es más larga y se repite. Lógica pura.
 */
export function patronVibracionOferta(dificultadAuditiva: boolean): number[] {
  return dificultadAuditiva ? [0, 900, 300, 900, 300, 900, 300, 900] : [0, 400, 200, 400];
}
