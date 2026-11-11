// Sube a Google Play el ícono, el gráfico destacado y las capturas con título de las tres apps, en
// inglés y en español, reemplazando las anteriores (11 nov 2026, C-ICONOS-POR-APP: cada app con su
// color y su «para quién es», para que las tres fichas no se vean iguales). Todos los países.
// Las piezas salen de capturas-tiendas-con-titulo/<app>/Google Play/ (fuera de git):
//   node scripts/marca/fichas-tiendas.mjs && node scripts/marca/graficos-google-play.mjs
// Uso: node scripts/tiendas/imagenes-google-play.mjs [paquete]
// Cambiar la ficha manda la ficha a revisión de Google; no toca la versión publicada de la app.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { googlePlay } from './google-play.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const APPS = {
  'com.windoce.tumbite': 'Divoox (cliente)',
  'com.windoce.tumbite.driver': 'Divoox Driver (repartidor)',
  'com.windoce.tumbite.restaurants': 'Divoox Restaurants (restaurante)',
};
const IDIOMAS = new Map([
  ['en-US', 'English'],
  ['es-419', 'Español'],
  ['es-ES', 'Español'],
  ['es-US', 'Español'],
]);
const pngs = (dir) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((n) => n.endsWith('.png'))
        .sort()
        .map((n) => join(dir, n))
    : [];

const solo = process.argv[2];
for (const [paquete, carpeta] of Object.entries(APPS)) {
  if (solo && solo !== paquete) continue;
  const base = join(RAIZ, 'capturas-tiendas-con-titulo', carpeta, 'Google Play');
  const { pedir, editar } = await googlePlay(paquete);
  await editar(async (id) => {
    const fichas = (await pedir(`/edits/${id}/listings`, { metodo: 'GET' })).listings ?? [];
    for (const { language } of fichas) {
      const idioma = IDIOMAS.get(language);
      if (!idioma) continue;
      const tableta = pngs(join(base, idioma, 'Tableta'));
      const piezas = {
        icon: [join(base, 'icono-512.png')],
        featureGraphic: [join(base, `grafico-destacado-${idioma}.png`)],
        phoneScreenshots: pngs(join(base, idioma, 'Celular')),
        ...(tableta.length ? { sevenInchScreenshots: tableta, tenInchScreenshots: tableta } : {}),
      };
      for (const [tipo, archivos] of Object.entries(piezas)) {
        if (!archivos.length || !archivos.every((a) => existsSync(a)))
          throw new Error(`${paquete} ${language}: faltan las piezas de ${tipo}`);
        await pedir(`/edits/${id}/listings/${language}/${tipo}`, { metodo: 'DELETE' });
        for (const a of archivos)
          await pedir(`/edits/${id}/listings/${language}/${tipo}`, {
            subir: true,
            binario: readFileSync(a),
            tipo: 'image/png',
          });
        console.log(`${paquete} ${language} ${tipo}: ${archivos.length}`);
      }
    }
  });
  console.log(`imágenes de la ficha listas: ${paquete}`);
}
