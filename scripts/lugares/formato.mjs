// C-REGISTRO-TODO-EL-PAIS · formato 2 del catálogo de lugares (25 nov 2026). Compacto para que el
// paquete del sitio no engorde (C-PAQUETE-DIETA): de 3,4 MB a unos 2 MB, sin perder ningún lugar.
//
//   { "v": 2, "m": [municipios…], "e": [estados…] (solo «principales»),
//     "f": [[id, ciudad, municipio, lat, lng, estado?], …] }
//
// - id: el número de GeoNames (el lugarId es «gn:<id>»).
// - municipio: posición en «m» (-1 = sin municipio). Antes se repetía el nombre en cada fila.
// - lat y lng: enteros en milésimas de grado (3 decimales, unos 110 m).
// - la población no viaja: las filas van de la más poblada a la menos, y el orden es el peso.
// - estado (solo «principales»): posición en «e».
// Lo lee `leerArchivoCatalogo` (packages/compartido/src/catalogoLugares.ts).

/** Filas del formato 1 ([`gn:id`, ciudad, municipio, lat, lng, poblacion, estado?]), ya ordenadas. */
export function compactar(filas, conEstado = false) {
  const m = [...new Set(filas.map((f) => f[2]).filter(Boolean))].sort();
  const mi = new Map(m.map((x, i) => [x, i]));
  const e = conEstado ? [...new Set(filas.map((f) => f[6]))].sort() : null;
  const ei = e ? new Map(e.map((x, i) => [x, i])) : null;
  const f = filas.map((r) => {
    const id = Number(String(r[0]).replace(/^gn:/, ''));
    if (!Number.isInteger(id) || id <= 0) throw new Error(`id raro: ${r[0]}`);
    const fila = [
      id,
      r[1],
      r[2] ? mi.get(r[2]) : -1,
      Math.round(r[3] * 1000),
      Math.round(r[4] * 1000),
    ];
    if (ei) fila.push(ei.get(r[6]));
    return fila;
  });
  return { v: 2, m, ...(e ? { e } : {}), f };
}
