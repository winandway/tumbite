// Cuentas fijas de prueba en el SITIO DE PRUEBAS (nunca producción): cliente, restaurante y
// repartidor, con un solo correo y sus alias (tucorreo+cliente@…, +restaurante, +repartidor).
// Todo llega a la misma bandeja. La contraseña la escribe la persona en la terminal, oculta:
// no se guarda en ningún archivo, no va en la dirección ni en el historial.
// Si una cuenta ya existe, la deja como está y lo dice.
//
// Uso: node scripts/staging/cuentas-prueba.mjs            (pregunta el correo y la contraseña)
//      URL_PRUEBAS=http://localhost:8787 node …            (para probar el guion en local)
import { createInterface } from 'node:readline';

const base = process.env.URL_PRUEBAS ?? 'https://staging.tumbite.com';
if (!/^https:\/\/staging\.tumbite\.com$|^http:\/\/localhost:\d+$/.test(base)) {
  console.error('Solo se corre contra el sitio de pruebas (o localhost). Nunca contra producción.');
  process.exit(1);
}

const CUENTAS = [
  { papel: 'cliente', rol: 'cliente', nombre: 'Prueba Cliente' },
  { papel: 'restaurante', rol: 'restaurante', nombre: 'Prueba Restaurante' },
  { papel: 'repartidor', rol: 'repartidor', nombre: 'Prueba Repartidor' },
];

/** tucorreo@gmail.com + «cliente» → tucorreo+cliente@gmail.com */
export function alias(correo, papel) {
  const [usuario, dominio] = correo.trim().toLowerCase().split('@');
  return `${usuario.split('+')[0]}+${papel}@${dominio}`;
}

// Una sola entrada para todas las preguntas, y cada línea que llega queda en fila: así no se
// pierde nada aunque lleguen varias de golpe.
let rl = null;
let ocultar = false;
const fila = [];
const esperando = [];
function preguntar(texto, oculto = false) {
  if (!rl) {
    rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: process.stdin.isTTY,
    });
    const escribir = rl._writeToOutput.bind(rl);
    // Mientras se escribe la contraseña, en la pantalla no aparece nada.
    rl._writeToOutput = (t) => {
      if (!ocultar) escribir(t);
    };
    rl.on('line', (l) => (esperando.length ? esperando.shift()(l) : fila.push(l)));
  }
  process.stdout.write(texto);
  ocultar = oculto;
  return new Promise((resolve) => {
    const listo = (r) => {
      ocultar = false;
      if (oculto) process.stdout.write('\n');
      resolve(r);
    };
    if (fila.length) listo(fila.shift());
    else esperando.push(listo);
  });
}

/** Un correo con una sola arroba y un dominio con punto. */
export function correoValido(c) {
  if (/\s/.test(c)) return false;
  const partes = c.split('@');
  if (partes.length !== 2 || !partes[0]) return false;
  const trozos = partes[1].split('.');
  return trozos.length >= 2 && trozos.every((t) => t.length > 0);
}

async function crear(c, correo, clave) {
  const r = await fetch(`${base}/datos/cuentas/registro`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-idioma': 'es' },
    body: JSON.stringify({ nombre: c.nombre, correo, clave, rol: c.rol, idioma: 'es' }),
  });
  if (r.ok) return 'creada';
  if (r.status === 409) return 'ya existía (no se tocó)';
  const d = await r.json().catch(() => ({}));
  return `no se pudo: ${d.error ?? r.status}`;
}

if (process.argv[1]?.endsWith('cuentas-prueba.mjs')) {
  const correo = (await preguntar('Tu correo (por ejemplo, tucorreo@gmail.com): ')).trim();
  if (!correoValido(correo)) {
    console.error('Ese correo no parece válido.');
    process.exit(1);
  }
  const clave = await preguntar(
    'Contraseña de pruebas (no se muestra; mínimo 8 caracteres): ',
    true,
  );
  if (clave.length < 8) {
    console.error('La contraseña de pruebas necesita al menos 8 caracteres.');
    process.exit(1);
  }
  const repetida = await preguntar('Repítela: ', true);
  if (repetida !== clave) {
    console.error('Las dos contraseñas no coinciden. No se creó nada.');
    process.exit(1);
  }
  console.log(`\nSitio: ${base}`);
  for (const c of CUENTAS) {
    const a = alias(correo, c.papel);
    console.log(`  ${c.papel.padEnd(12)} ${a.padEnd(40)} ${await crear(c, a, clave)}`);
  }
  console.log(
    '\nGuarda la contraseña de pruebas en tu gestor de contraseñas. Úsala solo en el sitio de pruebas.',
  );
  rl?.close();
}
