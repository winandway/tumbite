import { spawn } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Candado C-SEMAFORO-PACIENCIA (13 oct 2026): el sitio de pruebas a veces tarda más de 12 minutos
 * en tomar una versión, y la publicación se frenaba sola. Ahora espera 25 minutos y a los 8 le da
 * un empujón a la rama de pruebas, en una carpeta aparte para no tocar lo que va a producción.
 *
 * C-SEMAFORO-INSISTE (20 nov 2026): la plataforma se quedó en «subiendo el paquete», se rindió a
 * los tres intentos y el único empujón no alcanzó: la rama del asistente de Driver no llegó nunca a
 * pruebas. Ahora espera 45 minutos, empuja cada 8 y, si falla, imprime el registro de la plataforma.
 */
const leer = (...r: string[]) => readFileSync(join(__dirname, '..', '..', '..', ...r), 'utf8');

describe('semáforo de la publicación', () => {
  const script = leer('scripts', 'semaforo.sh');
  const flujo = leer('.github', 'workflows', 'publicar.yml');
  it('espera hasta 45 minutos y da un empujón cada 8', () => {
    expect(script).toMatch(/SEMAFORO_INTENTOS:-180/);
    expect(script).toMatch(/\$\(\(i % EMPUJON\)\) = 0/);
    expect(script).toMatch(/SEMAFORO_EMPUJON:-32/);
    expect(script).toMatch(/commit -q --allow-empty/);
  });
  it('el empujón va en una carpeta aparte, nunca cambia la rama de trabajo', () => {
    expect(script).toMatch(/git worktree add/);
    expect(script).not.toMatch(/git checkout/);
  });
  it('C-VERIFY-NO-SE-CANCELA: en la principal un commit nuevo no cancela la verificación en curso', () => {
    const verify = readFileSync(
      join(__dirname, '..', '..', '..', '.github', 'workflows', 'verify.yml'),
      'utf8',
    );
    expect(verify).toContain("cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}");
    expect(verify).not.toMatch(/cancel-in-progress: true/);
  });

  it('dos publicaciones nunca corren a la vez', () => {
    expect(flujo).toMatch(/concurrency:\n\s+group: publicar\n\s+cancel-in-progress: false/);
  });
  it('la publicación le pasa la rama de pruebas y le da tiempo de sobra', () => {
    expect(flujo).toMatch(
      /semaforo\.sh "\$\{\{ vars\.URL_PRUEBAS \}\}" "\$\{VERSION:0:7\}" yapanel-pruebas/,
    );
    expect(flujo).toMatch(/yapanel-pruebas\n\s+timeout-minutes: 50/);
  });

  it('los tres pasos del semáforo reciben la llave para leer el registro de la plataforma', () => {
    const rama = leer('.github', 'workflows', 'pruebas-rama.yml');
    expect(rama).toMatch(
      /YAD_LLAVE_SITIO: \$\{\{ secrets\.YAD_LLAVE_PRUEBAS \}\}\n\s+run: bash scripts\/semaforo/,
    );
    expect(flujo).toMatch(
      /YAD_LLAVE_SITIO: \$\{\{ secrets\.YAD_LLAVE_PRUEBAS \}\}\n\s+run: bash scripts\/semaforo/,
    );
    expect(flujo).toMatch(
      /YAD_LLAVE_SITIO: \$\{\{ secrets\.YAD_LLAVE_PRODUCCION \}\}\n\s+run: bash scripts\/semaforo/,
    );
  });
});

/** Corre el guion de verdad contra un sitio de mentira y un «git» de mentira que anota los empujones. */
async function correr(vueltasViejas: number, intentos: number) {
  const dir = mkdtempSync(join(tmpdir(), 'semaforo-'));
  const anotado = join(dir, 'git.log');
  writeFileSync(anotado, '');
  writeFileSync(join(dir, 'git'), `#!/bin/sh\necho "$@" >> "${anotado}"\nexit 0\n`);
  chmodSync(join(dir, 'git'), 0o755);
  let vistas = 0;
  const pedidas: string[] = [];
  const sitio = createServer((req, res) => {
    const ruta = (req.url ?? '').split('?')[0] ?? '';
    pedidas.push(`${req.method} ${ruta}`);
    if (ruta === '/') {
      vistas += 1;
      const v = vistas > vueltasViejas ? 'nueva12' : 'vieja00';
      res.end(`<meta name="version" content="${v}">`);
    } else if (ruta === '/datos/salud') res.end('{"commit":"nueva12"}');
    else if (ruta === '/estado_del_sitio') res.end('{"al_dia":false,"minutos_de_atraso":45}');
    else if (ruta === '/leer_registro') res.end('[{"tipo":"publicacion_atascada"}]');
    else res.end('<h1>ok</h1>');
  });
  await new Promise<void>((r) => sitio.listen(0, '127.0.0.1', r));
  const puerto = (sitio.address() as { port: number }).port;
  const url = `http://127.0.0.1:${puerto}`;
  let salida = '';
  const codigo = await new Promise<number>((r) => {
    const p = spawn(
      'bash',
      [join(__dirname, '..', '..', '..', 'scripts', 'semaforo.sh'), url, 'nueva12', 'rama-x'],
      {
        env: {
          ...process.env,
          PATH: `${dir}:${process.env.PATH ?? ''}`,
          SEMAFORO_INTENTOS: String(intentos),
          SEMAFORO_EMPUJON: '2',
          SEMAFORO_PAUSA: '0',
          SEMAFORO_PAUSA_SERVIDOR: '0',
          YAD_LLAVE_SITIO: 'llave-de-mentira',
          YAD_API: url,
        },
      },
    );
    p.stdout.on('data', (d) => (salida += String(d)));
    p.stderr.on('data', (d) => (salida += String(d)));
    p.on('close', (c) => r(c ?? 1));
  });
  await new Promise((r) => sitio.close(r));
  const empujones = readFileSync(anotado, 'utf8')
    .split('\n')
    .filter((l) => l.includes('--allow-empty')).length;
  return { codigo, salida, empujones, pedidas };
}

describe('C-SEMAFORO-INSISTE: el guion corriendo de verdad', () => {
  it('insiste con un empujón cada tanto, no uno solo, y pasa cuando la versión por fin llega', async () => {
    const r = await correr(7, 12);
    expect(r.empujones).toBe(3);
    // C-SEMAFORO-REPUBLICA: en cada empujón también se le pide a la plataforma republicar.
    expect(r.pedidas.filter((x) => x === 'POST /republicar')).toHaveLength(3);
    expect(r.codigo).toBe(0);
    expect(r.salida).toContain('El servidor confirma nueva12');
  }, 30_000);
  it('si la versión no llega nunca, falla y muestra lo que dice el registro de la plataforma', async () => {
    const r = await correr(999, 5);
    expect(r.codigo).toBe(1);
    expect(r.empujones).toBe(2);
    expect(r.pedidas).toContain('POST /estado_del_sitio');
    expect(r.pedidas).toContain('POST /leer_registro');
    expect(r.salida).toContain('publicacion_atascada');
  }, 30_000);
});
