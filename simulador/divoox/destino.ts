import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Contra qué servidor corre el simulador de Divoox. Todos los países (es una pieza de pruebas).
 *
 * - LOCAL (por defecto): el servidor de Divoox armado en esta computadora en `.simulador/` (puerto
 *   8791), con Stripe y Twilio simulados en sus propios puertos. Base nueva en cada corrida; no
 *   escribe ni una fila en el sitio de pruebas. No choca con `npm run recorrido` (.recorrido, 8790).
 * - SITIO DE PRUEBAS: con SIMULADOR_URL (o RECORRIDO_URL) y el secreto del reloj. Stripe en modo
 *   prueba de verdad. NUNCA producción: la misma guarda de dirección que usan los recorridos.
 */
export type Destino = {
  modo: 'local' | 'staging';
  base: string;
  /** Secreto de las rutas de diagnóstico (x-reloj-secreto). Solo por variable de entorno o archivo local. */
  secreto: string;
  /** Solo en local: el secreto con el que el Stripe simulado «firma» sus avisos. */
  secretoAviso?: string;
  /** Solo en local: el Stripe simulado (para anotar que un cobro sigue sin pagar). */
  stripeSimulado?: string;
};

const RAIZ = join(import.meta.dirname, '..', '..');
export const CARPETA_LOCAL = '.simulador';
export const PUERTO_LOCAL = Number(process.env.PUERTO_SIMULADOR ?? 8791);
const PUERTO_STRIPE = Number(process.env.PUERTO_STRIPE_SIMULADOR ?? 12121);
const PUERTO_TWILIO = Number(process.env.PUERTO_TWILIO_SIMULADOR ?? 12122);

/** La guarda de siempre: solo el sitio de pruebas. */
export function exigirSitioDePruebas(url: string): void {
  if (!/^https:\/\/(staging\.tumbite\.com|tumbite-pruebas\.sitios\.dev)\/?$/.test(url))
    throw new Error(
      `El simulador remoto solo corre contra el sitio de pruebas (no contra ${url}).`,
    );
}

export function destinoDesdeEntorno(): Destino {
  const url = process.env.SIMULADOR_URL ?? process.env.RECORRIDO_URL;
  if (url) {
    exigirSitioDePruebas(url);
    const secreto = process.env.SIMULADOR_SECRETO ?? process.env.RECORRIDO_SECRETO ?? '';
    if (!secreto) throw new Error('Falta el secreto del sitio de pruebas (SIMULADOR_SECRETO).');
    return { modo: 'staging', base: url.replace(/\/$/, ''), secreto };
  }
  const datos = join(RAIZ, CARPETA_LOCAL, 'datos.json');
  if (!existsSync(datos))
    throw new Error('No está armado el servidor local del simulador (corre «npm run simulador»).');
  const d = JSON.parse(readFileSync(datos, 'utf8')) as {
    url: string;
    relojSecreto: string;
    secretoAviso: string;
  };
  return {
    modo: 'local',
    base: d.url,
    secreto: d.relojSecreto,
    secretoAviso: d.secretoAviso,
    stripeSimulado: `http://localhost:${PUERTO_STRIPE}`,
  };
}

const responde = async (url: string) => {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
};

/**
 * Arma y levanta el servidor local (base nueva) y devuelve cómo apagarlo. Si ya hay uno
 * respondiendo en el puerto y SIMULADOR_REUSAR=1, lo reusa tal cual (para correr escenarios sueltos).
 */
export async function levantarServidorLocal(): Promise<() => void> {
  const url = `http://localhost:${PUERTO_LOCAL}`;
  if (process.env.SIMULADOR_REUSAR === '1' && (await responde(`${url}/datos/salud`)))
    return () => {};
  const env = {
    ...process.env,
    CARPETA_RECORRIDO: CARPETA_LOCAL,
    SOLO_SERVIDOR: '1',
    PUERTO_RECORRIDO: String(PUERTO_LOCAL),
    PUERTO_STRIPE: String(PUERTO_STRIPE),
    PUERTO_TWILIO: String(PUERTO_TWILIO),
  };
  execFileSync('node', ['scripts/recorrido/preparar.mjs'], { cwd: RAIZ, env, stdio: 'inherit' });
  const hijos: ChildProcess[] = [];
  const lanzar = (cmd: string, args: string[]) => {
    const h = spawn(cmd, args, { cwd: RAIZ, env, stdio: ['ignore', 'ignore', 'pipe'] });
    let errores = '';
    h.stderr?.on('data', (d: Buffer) => {
      errores = (errores + d.toString()).slice(-4000);
    });
    h.on('exit', (codigo) => {
      if (codigo && codigo !== 143 && codigo !== 0)
        console.error(`simulador: ${cmd} ${args.join(' ')} terminó con ${codigo}\n${errores}`);
    });
    hijos.push(h);
  };
  lanzar('node', ['scripts/recorrido/stripe-simulado.mjs']);
  lanzar('node', ['scripts/recorrido/twilio-simulado.mjs']);
  lanzar('npx', [
    'wrangler',
    'dev',
    '-c',
    `${CARPETA_LOCAL}/wrangler.jsonc`,
    '--port',
    String(PUERTO_LOCAL),
    '--persist-to',
    `${CARPETA_LOCAL}/estado`,
  ]);
  const apagar = () => {
    for (const h of hijos) if (!h.killed) h.kill('SIGTERM');
  };
  const hasta = Date.now() + 120_000;
  while (!(await responde(`${url}/datos/salud`))) {
    if (Date.now() > hasta) {
      apagar();
      throw new Error('El servidor local del simulador no arrancó en 2 minutos.');
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  return apagar;
}
