// Sube a Google Play el ícono, el gráfico destacado y las capturas con título de las tres apps, en
// inglés y en español, reemplazando las anteriores (11 nov 2026, C-ICONOS-POR-APP: cada app con su
// color y su «para quién es», para que las tres fichas no se vean iguales). Todos los países.
// Las piezas salen de capturas-tiendas-con-titulo/<app>/Google Play/ (fuera de git):
//   node scripts/marca/fichas-tiendas.mjs && node scripts/marca/graficos-google-play.mjs
// Uso: node scripts/tiendas/imagenes-google-play.mjs [paquete]
//   PIEZAS=featureGraphic,icon  sube solo esas piezas (las demás de la ficha no se tocan).
// Cambiar la ficha manda la ficha a revisión de Google; no toca la versión publicada de la app.
// C-LAMINA-PLAY-COLOR-APP (26 nov 2026): antes de subir, cada gráfico destacado se mide en sus
// píxeles; si no lleva el color de su app (lámina vieja, negra), no se sube nada de esa app.
// C-PLAY-NO-CANCELAR: si la app tiene una versión en revisión (candado play-en-revision), no se
// toca su ficha: cualquier cambio confirmado cancela la revisión en curso.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { LAMINAS, colorDeApp, comprobarIcono, comprobarLamina } from '../marca/lamina-play.mjs';
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
        // La captura del retiro al banco no se sube mientras los retiros estén apagados (auditor
        // de tiendas, 11 nov 2026): la ficha solo muestra lo que la app hace hoy.
        .filter((n) => n.endsWith('.png') && !n.includes('retiro-al-banco'))
        .sort()
        .map((n) => join(dir, n))
    : [];

const solo = process.argv[2];
const soloPiezas = process.env.PIEZAS ? new Set(process.env.PIEZAS.split(',')) : null;
for (const [paquete, carpeta] of Object.entries(APPS)) {
  if (solo && solo !== paquete) continue;
  if (existsSync(join(homedir(), '.config', 'tumbite', 'play-en-revision', paquete)))
    throw new Error(`${paquete}: tiene una versión en revisión de Google; no se toca su ficha`);
  const base = join(RAIZ, 'capturas-tiendas-con-titulo', carpeta, 'Google Play');
  const lamina = LAMINAS.find((l) => l.paquete === paquete);
  if (!lamina) throw new Error(`${paquete}: sin lámina en lamina-play.mjs`);
  await comprobarIcono(readFileSync(join(base, 'icono-512.png')), colorDeApp(lamina.app), carpeta);
  for (const idioma of new Set(IDIOMAS.values()))
    await comprobarLamina(
      readFileSync(join(base, `grafico-destacado-${idioma}.png`)),
      colorDeApp(lamina.app),
      `${carpeta} ${idioma}`,
    );
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
        if (soloPiezas && !soloPiezas.has(tipo)) continue;
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
