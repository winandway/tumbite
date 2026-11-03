// Capturas REALES de la bandeja «Para aprobar» del equipo (SIG-4, C-CONTROL-DUAL) para Docs.
// Abre el panel compilado (apps/panel/dist) con «vite preview» y responde las peticiones /datos con
// datos neutros: la pantalla es la de verdad, con datos de ejemplo. No toca ninguna base ni mueve
// dinero. Se fotografía solo el contenido de la sección (sin la dirección del equipo).
// Salida: docs/capturas/funciones/doble-firma-<es|en>.png y apps/panel/public/docs/doble-firma-<es|en>.webp
// Uso: npm run build -w @tumbite/panel && node scripts/docs/capturas-doble-firma.mjs
import fs from 'node:fs';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { chromium } from 'playwright';

const RAIZ = process.cwd();
const ORIGINALES = join(RAIZ, 'docs', 'capturas', 'funciones');
const WEB = join(RAIZ, 'apps', 'panel', 'public', 'docs');
fs.mkdirSync(ORIGINALES, { recursive: true });
const PUERTO = 4319;

const vista = spawn('npx', ['vite', 'preview', '--port', String(PUERTO), '--strictPort'], {
  cwd: join(RAIZ, 'apps', 'panel'),
  stdio: 'ignore',
});
for (let i = 0; i < 60; i++) {
  const ok = await fetch(`http://localhost:${PUERTO}/panel`).then(
    (r) => r.ok,
    () => false,
  );
  if (ok) break;
  await new Promise((r) => setTimeout(r, 500));
}

const pendiente = (id, tipo, monto, motivo, quien, hora) => ({
  id,
  tipo,
  objeto: 'x',
  monto,
  moneda: 'USD',
  motivo,
  estado: 'pendiente',
  nota: null,
  error: null,
  pedidoPor: 'otra',
  pedidoPorNombre: quien,
  creadoEn: `2026-11-02 ${hora}`,
  revisadoPorNombre: null,
});
const BANDEJA = (idioma) => ({
  pendientes: [
    pendiente(
      'a1',
      'ajuste_billetera',
      25000,
      idioma === 'es'
        ? 'Compensación acordada con la empresa'
        : 'Compensation agreed with the business',
      'Soporte Operaciones',
      '10:12',
    ),
    pendiente(
      'a2',
      'devolucion_pedido',
      14800,
      idioma === 'es' ? 'Pedido completo equivocado' : 'Entire order was wrong',
      'Soporte Atención',
      '10:40',
    ),
  ],
  recientes: [
    {
      ...pendiente('a0', 'reembolso_recarga', 30000, '', 'Soporte Operaciones', '09:05'),
      estado: 'aprobada',
      revisadoPorNombre: 'Soporte Finanzas',
    },
  ],
  umbrales: { USD: 10000, MXN: 200000, COP: 400000, VES: 4000000 },
  miPerfil: 'total',
  puedoAprobar: true,
  aprobadoresAparte: 2,
});

const navegador = await chromium.launch();
try {
  for (const idioma of ['es', 'en']) {
    const pagina = await navegador.newPage({
      viewport: { width: 1180, height: 1100 },
      deviceScaleFactor: 2,
    });
    await pagina.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    await pagina.route('**/datos/**', (ruta) => {
      const u = new URL(ruta.request().url()).pathname;
      const json = (d) =>
        ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
      if (u === '/datos/cuentas/yo')
        return json({
          usuario: {
            id: 'yo',
            nombre: 'Soporte Finanzas',
            correo: 'finanzas@ejemplo.com',
            rol: 'admin',
          },
        });
      if (u === '/datos/admin/ruta') return json({ ruta: null });
      if (u === '/datos/admin/aprobaciones-dinero') return json(BANDEJA(idioma));
      return json({});
    });
    await pagina.goto(`http://localhost:${PUERTO}/panel/approvals`);
    const seccion = pagina.locator('section.super').first();
    await seccion.waitFor();
    // Ni la cabecera fija ni los límites (el monto de corte no se publica).
    await pagina.addStyleTag({
      content:
        'header.cabecera{display:none!important} .super > h2, .super > h2 ~ *{display:none!important}',
    });
    await pagina.waitForTimeout(400);
    const png = join(ORIGINALES, `doble-firma-${idioma}.png`);
    await seccion.screenshot({ path: png });
    const webp = join(WEB, `doble-firma-${idioma}.webp`);
    execFileSync('cwebp', ['-quiet', '-q', '82', '-resize', '900', '0', png, '-o', webp]);
    console.log('listo', webp);
    await pagina.close();
  }
} finally {
  await navegador.close();
  vista.kill();
}
