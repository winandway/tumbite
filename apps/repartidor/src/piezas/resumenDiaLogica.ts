/**
 * C-HOY-VIAJES (22 nov 2026, Gerencia): la tarjeta «Hoy» del inicio cuenta lo que el conductor hizo
 * hoy con la palabra de su trabajo. Quien solo llevó pasajeros ve «Viajes»; quien solo repartió,
 * «Entregas»; con las dos cosas (o todavía sin nada), «Entregas», que es la palabra de siempre.
 */
export function palabraDeHoy(entregas: number, carreras: number): 'entregas' | 'viajes' {
  return carreras > 0 && entregas === 0 ? 'viajes' : 'entregas';
}
