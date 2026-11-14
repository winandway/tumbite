import { expect, test } from './fixtures';

/**
 * C-APP-INSTALABLE (13 nov 2026): las tres apps web se pueden agregar a la pantalla de inicio y
 * quedan como aplicación, cada una con su nombre, su ícono y su color. Si la compilación deja de
 * escribir el manifiesto o de enlazarlo, esta prueba se pone en rojo. Todos los países.
 */
const APPS = [
  { base: '/app', nombre: 'Divoox', color: '#F20D20' },
  { base: '/driver', nombre: 'Divoox Driver', color: '#1F4D69' },
  { base: '/restaurant', nombre: 'Divoox Restaurants', color: '#101010' },
] as const;

for (const a of APPS) {
  test(`${a.nombre} se instala como aplicación desde la web`, async ({ request }) => {
    const pagina = await request.get(`${a.base}/`);
    expect(pagina.ok()).toBe(true);
    const html = await pagina.text();
    expect(html).toContain(`<link rel="manifest" href="${a.base}/manifest.json"/>`);
    expect(html).toContain(
      `<link rel="apple-touch-icon" href="${a.base}/instalable/icono-180.png"/>`,
    );
    expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes"/>');

    const r = await request.get(`${a.base}/manifest.json`);
    expect(r.ok()).toBe(true);
    const m = (await r.json()) as {
      name: string;
      start_url: string;
      scope: string;
      display: string;
      theme_color: string;
      icons: { src: string; sizes: string }[];
    };
    expect(m.name).toBe(a.nombre);
    expect(m.start_url).toBe(`${a.base}/`);
    expect(m.scope).toBe(`${a.base}/`);
    expect(m.display).toBe('standalone');
    expect(m.theme_color).toBe(a.color);
    expect(m.icons.map((i) => i.sizes)).toEqual(['192x192', '512x512']);
    for (const i of [...m.icons.map((x) => x.src), `${a.base}/instalable/icono-180.png`]) {
      const img = await request.get(i);
      expect(img.ok(), i).toBe(true);
      expect(img.headers()['content-type']).toContain('image/png');
    }
    // C-AVISOS-WEB: el trabajador de avisos vive en la carpeta de la app y se sirve como JavaScript.
    const sw = await request.get(`${a.base}/avisos-sw.js`);
    expect(sw.ok()).toBe(true);
    expect(sw.headers()['content-type']).toContain('javascript');
    expect(await sw.text()).toContain("addEventListener('push'");
  });
}
